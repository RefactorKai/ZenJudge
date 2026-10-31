use rusqlite::{params, Connection, OptionalExtension, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::path::PathBuf;
use std::sync::Mutex;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BreachRecord {
    pub id: i64,
    pub timestamp: String,
    pub problem_slug: String,
    pub strike_index: u32,
    pub reason: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SubmissionRecord {
    pub id: i64,
    pub timestamp: String,
    pub problem_slug: String,
    pub language: String,
    pub verdict: String,
    pub runtime_ms: u64,
    pub memory_kb: u64,
    pub code: String,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UserProgress {
    pub total_problems: usize,
    pub solved_count: usize,
    pub attempted_count: usize,
    pub current_streak_days: u32,
    pub total_submissions: usize,
}

pub struct Database {
    pub conn: Mutex<Connection>,
}

impl Database {
    pub fn new(db_path: PathBuf) -> Result<Self> {
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|_| rusqlite::Error::InvalidPath(parent.to_path_buf()))?;
        }
        let conn = Connection::open(&db_path)?;
        conn.busy_timeout(std::time::Duration::from_millis(5000))?;
        conn.execute_batch(
            r#"
            PRAGMA journal_mode = WAL;
            PRAGMA busy_timeout = 5000;
            PRAGMA synchronous = NORMAL;
            PRAGMA foreign_keys = ON;
            "#,
        )?;
        let db = Self {
            conn: Mutex::new(conn),
        };
        db.migrate()?;
        Ok(db)
    }

    fn migrate(&self) -> Result<()> {
        let mut conn = self.conn.lock().unwrap();
        let tx = conn.transaction()?;
        tx.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS schema_version (
                version INTEGER PRIMARY KEY
            );

            CREATE TABLE IF NOT EXISTS breaches (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                problem_slug TEXT NOT NULL,
                strike_index INTEGER NOT NULL,
                reason TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS submissions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                problem_slug TEXT NOT NULL,
                language TEXT NOT NULL,
                verdict TEXT NOT NULL,
                runtime_ms INTEGER NOT NULL,
                memory_kb INTEGER NOT NULL,
                code TEXT NOT NULL,
                notes TEXT
            );

            CREATE TABLE IF NOT EXISTS lock_in_sessions (
                session_id TEXT PRIMARY KEY,
                problem_slug TEXT NOT NULL,
                start_time TEXT NOT NULL,
                end_time TEXT,
                status TEXT NOT NULL,
                strikes INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS bookmarks (
                problem_slug TEXT PRIMARY KEY,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS redo_marks (
                problem_slug TEXT PRIMARY KEY,
                created_at TEXT NOT NULL
            );
            "#,
        )?;
        let has_notes: bool = tx.query_row(
            "SELECT EXISTS(SELECT 1 FROM pragma_table_info('submissions') WHERE name = 'notes')",
            [],
            |row| row.get(0),
        )?;
        if !has_notes {
            tx.execute("ALTER TABLE submissions ADD COLUMN notes TEXT", [])?;
        }
        tx.commit()
    }

    pub fn insert_breach(&self, problem_slug: &str, strike_index: u32, reason: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let now = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO breaches (timestamp, problem_slug, strike_index, reason) VALUES (?1, ?2, ?3, ?4)",
            params![now, problem_slug, strike_index, reason],
        )?;
        Ok(())
    }

    pub fn get_breaches(&self, problem_slug: &str) -> Result<Vec<BreachRecord>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, timestamp, problem_slug, strike_index, reason FROM breaches WHERE problem_slug = ?1 ORDER BY id DESC LIMIT 50",
        )?;
        let rows = stmt.query_map(params![problem_slug], |row| {
            Ok(BreachRecord {
                id: row.get(0)?,
                timestamp: row.get(1)?,
                problem_slug: row.get(2)?,
                strike_index: row.get(3)?,
                reason: row.get(4)?,
            })
        })?;

        let mut results = Vec::new();
        for r in rows {
            results.push(r?);
        }
        Ok(results)
    }

    #[allow(clippy::too_many_arguments)] // Preserve the existing command/storage contract.
    pub fn insert_submission(
        &self,
        problem_slug: &str,
        language: &str,
        verdict: &str,
        runtime_ms: u64,
        memory_kb: u64,
        code: &str,
        notes: Option<&str>,
    ) -> Result<i64> {
        let conn = self.conn.lock().unwrap();
        let now = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO submissions (timestamp, problem_slug, language, verdict, runtime_ms, memory_kb, code, notes)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![now, problem_slug, language, verdict, runtime_ms as i64, memory_kb as i64, code, notes],
        )?;
        Ok(conn.last_insert_rowid())
    }

    pub fn update_submission_notes(&self, submission_id: i64, notes: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let changed = conn.execute(
            "UPDATE submissions SET notes = ?1 WHERE id = ?2",
            params![notes, submission_id],
        )?;
        if changed == 0 {
            return Err(rusqlite::Error::QueryReturnedNoRows);
        }
        Ok(())
    }

    pub fn get_submissions(&self, problem_slug: &str) -> Result<Vec<SubmissionRecord>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, timestamp, problem_slug, language, verdict, runtime_ms, memory_kb, code, notes
             FROM submissions WHERE problem_slug = ?1 ORDER BY id DESC LIMIT 50",
        )?;
        let rows = stmt.query_map(params![problem_slug], |row| {
            let runtime: i64 = row.get(5)?;
            let memory: i64 = row.get(6)?;
            Ok(SubmissionRecord {
                id: row.get(0)?,
                timestamp: row.get(1)?,
                problem_slug: row.get(2)?,
                language: row.get(3)?,
                verdict: row.get(4)?,
                runtime_ms: runtime.max(0) as u64,
                memory_kb: memory.max(0) as u64,
                code: row.get(7)?,
                notes: row.get(8)?,
            })
        })?;

        let mut results = Vec::new();
        for r in rows {
            results.push(r?);
        }
        Ok(results)
    }

    pub fn get_problem_stats(&self, slug: &str) -> Result<(String, Option<u64>, u64)> {
        let conn = self.conn.lock().unwrap();
        let total_subs: i64 = conn.query_row(
            "SELECT COUNT(*) FROM submissions WHERE problem_slug = ?1",
            params![slug],
            |row| row.get(0),
        )?;

        if total_subs == 0 {
            return Ok(("unsolved".to_string(), None, 0));
        }

        let ac_count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM submissions WHERE problem_slug = ?1 AND verdict LIKE 'Accepted%'",
            params![slug],
            |row| row.get(0),
        )?;

        let best_runtime: Option<i64> = conn.query_row(
            "SELECT MIN(runtime_ms) FROM submissions WHERE problem_slug = ?1 AND verdict LIKE 'Accepted%'",
            params![slug],
            |row| row.get(0),
        )?;

        let status = if ac_count > 0 {
            "solved".to_string()
        } else {
            "attempted".to_string()
        };

        Ok((
            status,
            best_runtime.map(|r| r.max(0) as u64),
            total_subs as u64,
        ))
    }

    pub fn toggle_bookmark(&self, problem_slug: &str) -> Result<bool> {
        let conn = self.conn.lock().unwrap();
        let exists: bool = conn
            .query_row(
                "SELECT 1 FROM bookmarks WHERE problem_slug = ?1",
                params![problem_slug],
                |_| Ok(true),
            )
            .optional()?
            .unwrap_or(false);

        if exists {
            conn.execute(
                "DELETE FROM bookmarks WHERE problem_slug = ?1",
                params![problem_slug],
            )?;
            Ok(false)
        } else {
            let now = chrono::Utc::now().to_rfc3339();
            conn.execute(
                "INSERT INTO bookmarks (problem_slug, created_at) VALUES (?1, ?2)",
                params![problem_slug, now],
            )?;
            Ok(true)
        }
    }

    pub fn get_bookmarks(&self) -> Result<HashSet<String>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT problem_slug FROM bookmarks")?;
        let rows = stmt.query_map([], |row| row.get::<_, String>(0))?;
        let mut set = HashSet::new();
        for r in rows {
            set.insert(r?);
        }
        Ok(set)
    }

    pub fn toggle_redo(&self, problem_slug: &str) -> Result<bool> {
        let conn = self.conn.lock().unwrap();
        let exists: bool = conn
            .query_row(
                "SELECT 1 FROM redo_marks WHERE problem_slug = ?1",
                params![problem_slug],
                |_| Ok(true),
            )
            .optional()?
            .unwrap_or(false);

        if exists {
            conn.execute(
                "DELETE FROM redo_marks WHERE problem_slug = ?1",
                params![problem_slug],
            )?;
            Ok(false)
        } else {
            let now = chrono::Utc::now().to_rfc3339();
            conn.execute(
                "INSERT INTO redo_marks (problem_slug, created_at) VALUES (?1, ?2)",
                params![problem_slug, now],
            )?;
            Ok(true)
        }
    }

    pub fn get_redo_marks(&self) -> Result<HashSet<String>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT problem_slug FROM redo_marks")?;
        let rows = stmt.query_map([], |row| row.get::<_, String>(0))?;
        let mut set = HashSet::new();
        for r in rows {
            set.insert(r?);
        }
        Ok(set)
    }

    pub fn get_user_progress(&self, total_problems: usize) -> Result<UserProgress> {
        let conn = self.conn.lock().unwrap();
        let solved_count: i64 = conn.query_row(
            "SELECT COUNT(DISTINCT problem_slug) FROM submissions WHERE verdict LIKE 'Accepted%'",
            [],
            |row| row.get(0),
        )?;

        let total_submissions: i64 =
            conn.query_row("SELECT COUNT(*) FROM submissions", [], |row| row.get(0))?;

        let attempted_count: i64 = conn.query_row(
            "SELECT COUNT(DISTINCT problem_slug) FROM submissions WHERE problem_slug NOT IN (
                SELECT DISTINCT problem_slug FROM submissions WHERE verdict LIKE 'Accepted%'
            )",
            [],
            |row| row.get(0),
        )?;

        let streak = current_streak(&conn, chrono::Local::now().date_naive())?;

        Ok(UserProgress {
            total_problems,
            solved_count: solved_count as usize,
            attempted_count: attempted_count as usize,
            current_streak_days: streak,
            total_submissions: total_submissions as usize,
        })
    }
}

fn current_streak(conn: &Connection, today: chrono::NaiveDate) -> Result<u32> {
    let mut stmt = conn.prepare(
        "SELECT DISTINCT CAST(julianday(?1) - julianday(date(timestamp, 'localtime')) AS INTEGER) AS days_ago
         FROM submissions WHERE days_ago >= 0 ORDER BY days_ago",
    )?;
    let mut rows = stmt.query([today.to_string()])?;
    let mut streak = 0;
    let mut expected_day = 0;
    while let Some(row) = rows.next()? {
        let days_ago: i64 = row.get(0)?;
        // Yesterday's streak stays active until the end of today.
        if streak == 0 && days_ago == 1 {
            expected_day = 1;
        }
        if days_ago != expected_day {
            break;
        }
        streak += 1;
        expected_day += 1;
    }
    Ok(streak)
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::{Days, TimeZone};

    #[test]
    fn streak_counts_consecutive_local_days_without_a_thirty_day_cap() {
        let today = chrono::NaiveDate::from_ymd_opt(2026, 10, 31).unwrap();
        for (days_ago, expected) in [
            (vec![], 0),
            (vec![0], 1),
            (vec![0, 0, 1, 2], 3),
            (vec![1, 2, 3], 3),
            (vec![0, 2, 3], 1),
            (vec![2, 3], 0),
            (vec![100, 101], 0),
            ((0..35).collect(), 35),
        ] {
            let conn = Connection::open_in_memory().unwrap();
            conn.execute_batch("CREATE TABLE submissions (timestamp TEXT NOT NULL)")
                .unwrap();
            for offset in days_ago {
                let day = today.checked_sub_days(Days::new(offset)).unwrap();
                let timestamp = chrono::Local
                    .from_local_datetime(&day.and_hms_opt(12, 0, 0).unwrap())
                    .single()
                    .unwrap()
                    .with_timezone(&chrono::Utc)
                    .to_rfc3339();
                conn.execute("INSERT INTO submissions VALUES (?1)", [timestamp])
                    .unwrap();
            }
            assert_eq!(current_streak(&conn, today).unwrap(), expected);
        }
    }

    #[test]
    fn streak_uses_local_dates_and_ignores_future_or_invalid_timestamps() {
        let today = chrono::NaiveDate::from_ymd_opt(2026, 10, 31).unwrap();
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("CREATE TABLE submissions (timestamp TEXT NOT NULL)")
            .unwrap();
        let timestamp = chrono::Local
            .from_local_datetime(&today.and_hms_opt(0, 30, 0).unwrap())
            .single()
            .unwrap()
            .with_timezone(&chrono::Utc)
            .to_rfc3339();
        for value in [timestamp.as_str(), "2099-01-01T00:00:00Z", "invalid"] {
            conn.execute("INSERT INTO submissions VALUES (?1)", [value])
                .unwrap();
        }
        assert_eq!(current_streak(&conn, today).unwrap(), 1);
    }
}
