pub mod db;
pub mod problem;
pub mod runner;

pub mod commands {
    use crate::db::{BreachRecord, SubmissionRecord, UserProgress};
    use crate::problem::{ProblemDetail, ProblemMeta};
    use crate::runner::BatchRunResult;
    use crate::AppState;
    use serde::{Deserialize, Serialize};
    use tauri::{Emitter, State, Window};

    #[derive(Debug, Serialize, Deserialize, Clone)]
    pub struct ProblemListItem {
        pub title: String,
        pub slug: String,
        pub difficulty: String,
        pub time_limit_ms: u64,
        pub memory_limit_mb: u64,
        pub tags: Vec<String>,
        pub status: String,
        pub best_runtime_ms: Option<u64>,
        pub total_submissions: u64,
        pub is_bookmarked: bool,
        pub is_redo: bool,
    }

    #[tauri::command]
    pub fn list_problems() -> Result<Vec<ProblemMeta>, String> {
        crate::problem::scan_all_problems()
    }

    #[tauri::command]
    pub fn get_problems_metadata(
        state: State<'_, AppState>,
    ) -> Result<Vec<ProblemListItem>, String> {
        let metas = crate::problem::scan_all_problems()?;
        let bookmarks = state.db.get_bookmarks().map_err(|e| e.to_string())?;
        let redo_marks = state.db.get_redo_marks().map_err(|e| e.to_string())?;

        let mut items = Vec::new();
        for meta in metas {
            let (status, best_runtime_ms, total_submissions) = state
                .db
                .get_problem_stats(&meta.slug)
                .map_err(|e| e.to_string())?;

            let is_bookmarked = bookmarks.contains(&meta.slug);
            let is_redo = redo_marks.contains(&meta.slug);

            items.push(ProblemListItem {
                title: meta.title,
                slug: meta.slug,
                difficulty: meta.difficulty,
                time_limit_ms: meta.time_limit_ms,
                memory_limit_mb: meta.memory_limit_mb,
                tags: meta.tags,
                status,
                best_runtime_ms,
                total_submissions,
                is_bookmarked,
                is_redo,
            });
        }

        Ok(items)
    }

    #[tauri::command]
    pub fn get_user_progress(state: State<'_, AppState>) -> Result<UserProgress, String> {
        let metas = crate::problem::scan_all_problems()?;
        state
            .db
            .get_user_progress(metas.len())
            .map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub fn toggle_bookmark(state: State<'_, AppState>, slug: String) -> Result<bool, String> {
        crate::problem::validate_slug(&slug)?;
        state.db.toggle_bookmark(&slug).map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub fn toggle_redo(state: State<'_, AppState>, slug: String) -> Result<bool, String> {
        crate::problem::validate_slug(&slug)?;
        state.db.toggle_redo(&slug).map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub fn update_submission_notes(
        state: State<'_, AppState>,
        submission_id: i64,
        notes: String,
    ) -> Result<(), String> {
        if notes.len() > crate::problem::MAX_NOTES_BYTES || submission_id <= 0 {
            return Err("Invalid submission ID or notes exceed 64 KiB".into());
        }
        state
            .db
            .update_submission_notes(submission_id, &notes)
            .map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub fn get_problem(slug: String) -> Result<ProblemDetail, String> {
        crate::problem::load_problem_detail(&slug)
    }

    #[tauri::command]
    pub fn get_template(slug: String, lang: String) -> Result<String, String> {
        let detail = crate::problem::load_problem_detail(&slug)?;
        let key = lang.to_lowercase();
        if let Some(tpl) = detail.meta.templates.get(&key) {
            Ok(tpl.clone())
        } else {
            Err(format!("No template found for language '{}'", lang))
        }
    }

    #[tauri::command]
    pub fn run_sample_code(
        slug: String,
        lang: String,
        code: String,
        custom_input: Option<String>,
        compiler_profile: Option<String>,
    ) -> Result<BatchRunResult, String> {
        crate::runner::validate_source(
            &lang,
            &code,
            compiler_profile.as_deref().unwrap_or("debug"),
        )?;
        crate::problem::validate_slug(&slug)?;
        if custom_input
            .as_ref()
            .is_some_and(|s| s.len() > crate::problem::MAX_CASE_BYTES)
        {
            return Err("Custom input exceeds 64 KiB".into());
        }
        Err(crate::runner::ISOLATION_UNAVAILABLE.into())
    }

    #[tauri::command]
    pub fn submit_code(
        slug: String,
        lang: String,
        code: String,
        compiler_profile: Option<String>,
    ) -> Result<BatchRunResult, String> {
        crate::runner::validate_source(
            &lang,
            &code,
            compiler_profile.as_deref().unwrap_or("release"),
        )?;
        crate::problem::validate_slug(&slug)?;
        Err(crate::runner::ISOLATION_UNAVAILABLE.into())
    }

    #[tauri::command]
    pub fn toggle_lock_in(
        window: Window,
        state: State<'_, AppState>,
        enable: bool,
        problem_slug: Option<String>,
    ) -> Result<crate::LockInStatus, String> {
        let mut lock = state.lock_in.lock().unwrap();

        if enable {
            let _ = window.set_fullscreen(true);
            let _ = window.set_always_on_top(true);
            let _ = window.set_decorations(false);
            lock.is_active = true;
            lock.problem_slug = problem_slug.clone();
            lock.strikes = 0;
        } else {
            let _ = window.set_fullscreen(false);
            let _ = window.set_always_on_top(false);
            let _ = window.set_decorations(true);
            lock.is_active = false;
            lock.problem_slug = None;
        }

        Ok(lock.clone())
    }

    #[tauri::command]
    pub fn emergency_abort_lock_in(
        window: Window,
        state: State<'_, AppState>,
    ) -> Result<crate::LockInStatus, String> {
        let mut lock = state.lock_in.lock().unwrap();
        let slug = lock
            .problem_slug
            .clone()
            .unwrap_or_else(|| "unknown".to_string());
        lock.strikes += 1;
        let strikes = lock.strikes;

        let _ = window.set_fullscreen(false);
        let _ = window.set_always_on_top(false);
        let _ = window.set_decorations(true);

        lock.is_active = false;
        let persistence = state.db.insert_breach(
            &slug,
            strikes,
            "Emergency Abort (Ctrl+Shift+Q held 3s) - Forfeited attempt",
        );

        let _ = window.emit(
            "zenjudge://abort-event",
            serde_json::json!({
                "problem_slug": slug,
                "strikes": strikes,
                "timestamp": chrono::Utc::now().to_rfc3339()
            }),
        );

        persistence
            .map_err(|e| format!("Lock-In ended, but the abort record was NOT saved: {e}"))?;
        Ok(lock.clone())
    }

    #[tauri::command]
    pub fn get_lock_in_status(state: State<'_, AppState>) -> Result<crate::LockInStatus, String> {
        let lock = state.lock_in.lock().unwrap();
        Ok(lock.clone())
    }

    #[tauri::command]
    pub fn get_submissions(
        state: State<'_, AppState>,
        slug: String,
    ) -> Result<Vec<SubmissionRecord>, String> {
        state.db.get_submissions(&slug).map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub fn get_breaches(
        state: State<'_, AppState>,
        slug: String,
    ) -> Result<Vec<BreachRecord>, String> {
        state.db.get_breaches(&slug).map_err(|e| e.to_string())
    }
}

use db::Database;
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use tauri::{Emitter, Manager};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LockInStatus {
    pub is_active: bool,
    pub problem_slug: Option<String>,
    pub strikes: u32,
}

pub struct AppState {
    pub db: Database,
    pub lock_in: Arc<Mutex<LockInStatus>>,
}

pub fn resolve_db_path(app_data: &std::path::Path) -> std::path::PathBuf {
    app_data.join("zenjudge.db")
}

pub fn import_legacy_database(
    source: &std::path::Path,
    destination: &std::path::Path,
) -> Result<(), Box<dyn std::error::Error>> {
    if destination.exists() || !source.exists() {
        return Ok(());
    }
    if let Some(parent) = destination.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let temporary = destination.with_extension("db.importing");
    // A stale import requires inspection; never overwrite it or the live database.
    let reservation = std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&temporary)?;
    drop(reservation);
    let result = (|| {
        let conn = rusqlite::Connection::open_with_flags(
            source,
            rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY,
        )?;
        conn.backup(rusqlite::DatabaseName::Main, &temporary, None)?;
        let copy = rusqlite::Connection::open(&temporary)?;
        copy.pragma_update(None, "journal_mode", "DELETE")?;
        Ok::<(), rusqlite::Error>(())
    })();
    if let Err(e) = result {
        // Only the newly reserved import file belongs to this operation.
        std::fs::remove_file(&temporary)?;
        return Err(e.into());
    }
    std::fs::rename(&temporary, destination)?;
    Ok(())
}

pub fn run() {
    let lock_in_state = Arc::new(Mutex::new(LockInStatus {
        is_active: false,
        problem_slug: None,
        strikes: 0,
    }));

    let lock_in_for_event = Arc::clone(&lock_in_state);

    tauri::Builder::default()
        .setup(move |app| {
            let root = if cfg!(debug_assertions) {
                std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../problems")
            } else { app.path().resource_dir()?.join("problems") };
            crate::problem::configure_root(root).map_err(std::io::Error::other)?;
            let db_path = resolve_db_path(&app.path().app_data_dir()?);
            let legacy = if cfg!(debug_assertions) {
                std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../data/zenjudge.db")
            } else {
                std::env::current_exe()?.parent().ok_or("Executable has no parent")?.join("data/zenjudge.db")
            };
            import_legacy_database(&legacy, &db_path)?;
            let db = Database::new(db_path)?;
            app.manage(AppState { db, lock_in: lock_in_state });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::list_problems,
            commands::get_problems_metadata,
            commands::get_user_progress,
            commands::toggle_bookmark,
            commands::toggle_redo,
            commands::update_submission_notes,
            commands::get_problem,
            commands::get_template,
            commands::run_sample_code,
            commands::submit_code,
            commands::toggle_lock_in,
            commands::emergency_abort_lock_in,
            commands::get_lock_in_status,
            commands::get_submissions,
            commands::get_breaches
        ])
        .on_window_event(move |window, event| {
            if let tauri::WindowEvent::Focused(focused) = event {
                if !focused {
                    let mut lock = lock_in_for_event.lock().unwrap();
                    if lock.is_active {
                        lock.strikes += 1;
                        let strikes = lock.strikes;
                        let slug = lock
                            .problem_slug
                            .clone()
                            .unwrap_or_else(|| "general".to_string());

                        let app_state = window.state::<AppState>();
                        if let Err(e) = app_state.db.insert_breach(
                            &slug,
                            strikes,
                            "Window lost focus during Lock-In mode",
                        ) {
                            eprintln!("Focus record was NOT saved: {e}");
                            let _ = window.emit("zenjudge://storage-error", "Focus record was NOT saved. Check storage permissions and free space.");
                        }

                        let _ = window.emit(
                            "zenjudge://strike-event",
                            serde_json::json!({
                                "problem_slug": slug,
                                "strikes": strikes,
                                "timestamp": chrono::Utc::now().to_rfc3339()
                            }),
                        );
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
