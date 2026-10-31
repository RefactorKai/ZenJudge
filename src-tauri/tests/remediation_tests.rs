//! Bounded regressions converted from the audit's vulnerability-observation probes.
//! No hostile child is launched. These prove rejection, not working containment.
use std::{
    fs,
    io::Write,
    path::PathBuf,
    sync::{Arc, Mutex},
    time::SystemTime,
};
use tauri::Manager;
use zenjudge_lib::{
    commands,
    db::Database,
    problem::{self, TestCase},
    runner::{self, Verdict},
    AppState, LockInStatus,
};

fn fixture(name: &str) -> PathBuf {
    let root = std::env::temp_dir().join(format!(
        "zj_regression_{}_{}_{name}",
        std::process::id(),
        SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    fs::create_dir(&root).unwrap();
    root
}
fn pack(root: &std::path::Path) -> PathBuf {
    let dir = root.join("canary");
    fs::create_dir(&dir).unwrap();
    fs::write(dir.join("meta.json"), r#"{"title":"Canary","slug":"canary","difficulty":"Easy","time_limit_ms":100,"memory_limit_mb":64}"#).unwrap();
    fs::write(dir.join("statement.md"), "Harmless statement").unwrap();
    fs::write(
        dir.join("testcases.json"),
        r#"[{"id":1,"input":"","expected_output":"","is_sample":true}]"#,
    )
    .unwrap();
    dir
}
fn case() -> TestCase {
    TestCase {
        id: 1,
        input: String::new(),
        expected_output: String::new(),
        is_sample: true,
    }
}

#[test]
fn public_progress_reports_zero_streak_for_empty_or_old_history() {
    let db = Database::new(fixture("streak").join("synthetic.db")).unwrap();
    assert_eq!(db.get_user_progress(5).unwrap().current_streak_days, 0);
    db.insert_submission("canary", "python", "Accepted (AC)", 1, 1, "synthetic", None)
        .unwrap();
    assert_eq!(db.get_user_progress(5).unwrap().current_streak_days, 1);
    db.conn
        .lock()
        .unwrap()
        .execute(
            "UPDATE submissions SET timestamp = '2000-01-01T00:00:00Z'",
            [],
        )
        .unwrap();
    let progress = db.get_user_progress(5).unwrap();
    assert_eq!(progress.current_streak_days, 0);
    assert_eq!(progress.total_submissions, 1);
    assert_eq!(progress.solved_count, 1);
}

#[test]
fn all_compilation_forms_fail_closed_without_artifacts() {
    let before: Vec<_> = fs::read_dir(std::env::temp_dir())
        .unwrap()
        .flatten()
        .filter(|e| e.file_name().to_string_lossy().starts_with("zenjudge_"))
        .map(|e| e.path())
        .collect();
    let source = "#warning finite warning\n".repeat(500) + "int main() {}";
    for (lang, code) in [
        ("cpp", source.as_str()),
        ("cpp", "#/**/include \"outside-canary.h\""),
        ("cpp", "%:include \"outside-canary.h\""),
        ("cpp", "#inc\\\nlude \"outside-canary.h\""),
        ("python", "print('harmless')"),
    ] {
        let (verdict, message) = runner::prepare_execution(lang, code, "release").unwrap_err();
        assert_eq!(verdict, Verdict::ExecutionUnavailable);
        assert_eq!(message, runner::ISOLATION_UNAVAILABLE);
    }
    let after: Vec<_> = fs::read_dir(std::env::temp_dir())
        .unwrap()
        .flatten()
        .filter(|e| e.file_name().to_string_lossy().starts_with("zenjudge_"))
        .map(|e| e.path())
        .collect();
    assert_eq!(
        before, after,
        "Rejected preparation must not create staging or jail directories"
    );
}

#[test]
fn batch_rejects_empty_suites_extreme_limits_and_valid_jobs() {
    assert_ne!(
        runner::run_testcases_batch("python", "pass", "release", &[], 100, 64).verdict,
        Verdict::Accepted
    );
    for (time, memory) in [(0, 64), (u64::MAX, 64), (100, u64::MAX)] {
        assert_eq!(
            runner::run_testcases_batch("python", "pass", "release", &[case()], time, memory)
                .verdict,
            Verdict::RuntimeError
        );
    }
    let result = runner::run_testcases_batch("python", "print('5')", "debug", &[case()], 100, 64);
    assert_eq!(result.verdict, Verdict::ExecutionUnavailable);
    assert_eq!(result.passed_count, 0);
    assert!(result.cases.is_empty());
    assert!(runner::validate_source(
        "python",
        &"x".repeat(problem::MAX_SOURCE_BYTES + 1),
        "debug"
    )
    .is_err());
    assert!(runner::validate_source("python", "pass", "arbitrary").is_err());
}

#[test]
fn full_output_suffix_is_never_ignored_and_diff_is_bounded() {
    let expected = "A".repeat(runner::MAX_OUTPUT_BYTES);
    let actual = expected.clone() + "WRONG_SUFFIX";
    assert!(!runner::normalize_and_compare(&actual, &expected).is_match);
    let diff = runner::normalize_and_compare(&"x".repeat(1024), &"y".repeat(1024));
    assert!(!diff.is_match);
    assert!(diff.diff_message.unwrap().len() < 1200);
    // Capture/truncation integration is retired with the host runner. A future
    // worker must additionally reject overflow before reaching this comparator.
}

#[test]
fn pack_paths_and_resource_limits_are_enforced_by_loaders() {
    let root = fixture("packs");
    let dir = pack(&root);
    assert!(problem::load_problem_detail_from(&root, "canary").is_ok());
    for slug in [
        "../canary",
        "..\\canary",
        "C:\\canary",
        "\\\\?\\C:\\canary",
        "/canary",
        "con",
        "lpt1",
        "canary/child",
        "a:b",
    ] {
        assert!(
            problem::load_problem_detail_from(&root, slug).is_err(),
            "{slug}"
        );
        assert!(problem::load_testcases_from(&root, slug).is_err(), "{slug}");
    }
    fs::write(dir.join("testcases.json"), "[]").unwrap();
    assert!(problem::load_testcases_from(&root, "canary").is_err());
    fs::write(
        dir.join("testcases.json"),
        serde_json::to_vec(&vec![case(); problem::MAX_CASES + 1]).unwrap(),
    )
    .unwrap();
    assert!(problem::load_testcases_from(&root, "canary").is_err());
    fs::write(
        dir.join("testcases.json"),
        serde_json::to_vec(&vec![case(), case()]).unwrap(),
    )
    .unwrap();
    assert!(problem::load_testcases_from(&root, "canary").is_err());
    fs::write(dir.join("meta.json"), r#"{"title":"Canary","slug":"canary","difficulty":"Easy","time_limit_ms":18446744073709551615,"memory_limit_mb":64}"#).unwrap();
    assert!(problem::load_problem_detail_from(&root, "canary").is_err());
}

#[test]
fn compressed_input_is_bounded_and_corruption_never_falls_back() {
    let root = fixture("compressed");
    let dir = pack(&root);
    let bin = dir.join("testcases.bin");
    fs::write(&bin, b"invalid zlib").unwrap();
    assert!(problem::load_testcases_from(&root, "canary").is_err());
    let mut encoder = flate2::write::ZlibEncoder::new(Vec::new(), flate2::Compression::fast());
    // Finite 4 MiB + 1: one byte beyond the parent decompression budget.
    for _ in 0..1024 {
        encoder.write_all(&[b' '; 4096]).unwrap();
    }
    encoder.write_all(b" ").unwrap();
    fs::write(&bin, encoder.finish().unwrap()).unwrap();
    assert!(problem::load_testcases_from(&root, "canary").is_err());
    let file = fs::File::create(&bin).unwrap();
    file.set_len(problem::MAX_SUITE_BYTES as u64 + 1).unwrap();
    drop(file);
    assert!(problem::load_testcases_from(&root, "canary").is_err());
}

#[cfg(windows)]
#[test]
fn junction_pack_is_rejected_without_reading_outside_root() {
    let base = fixture("junction");
    let root = base.join("problems");
    let outside = base.join("outside");
    fs::create_dir(&root).unwrap();
    fs::create_dir(&outside).unwrap();
    pack(&outside);
    let link = root.join("canary");
    let target = outside.join("canary");
    let status = std::process::Command::new("powershell.exe")
        .args(["-NoProfile", "-NonInteractive", "-Command", "New-Item -ItemType Junction -Path $env:ZJ_REGRESSION_LINK -Target $env:ZJ_REGRESSION_TARGET | Out-Null"])
        .env("ZJ_REGRESSION_LINK", &link).env("ZJ_REGRESSION_TARGET", &target).status().unwrap();
    assert!(
        status.success(),
        "Junction regression requires creation in disposable fixture"
    );
    assert!(problem::load_problem_detail_from(&root, "canary").is_err());
    assert!(problem::load_testcases_from(&root, "canary").is_err());
    fs::remove_dir(&link).unwrap(); // Unlink only this audit-created junction.
    assert!(target.join("statement.md").exists());
}

#[test]
fn actual_commands_reject_execution_and_surface_storage_failure() {
    let root = fixture("commands");
    let db = Database::new(root.join("test.db")).unwrap();
    let id = db
        .insert_submission(
            "canary",
            "python",
            "Accepted (AC)",
            1,
            1,
            "saved",
            Some("notes"),
        )
        .unwrap();
    let app = tauri::test::mock_builder()
        .manage(AppState {
            db,
            lock_in: Arc::new(Mutex::new(LockInStatus {
                is_active: false,
                problem_slug: None,
                strikes: 0,
            })),
        })
        .invoke_handler(tauri::generate_handler![
            commands::run_sample_code,
            commands::submit_code
        ])
        .build(tauri::test::mock_context(tauri::test::noop_assets()))
        .unwrap();
    let webview = tauri::WebviewWindowBuilder::new(&app, "main", Default::default())
        .build()
        .unwrap();
    for cmd in ["run_sample_code", "submit_code"] {
        let response = tauri::test::get_ipc_response(
            &webview,
            tauri::webview::InvokeRequest {
                cmd: cmd.into(),
                callback: tauri::ipc::CallbackFn(0),
                error: tauri::ipc::CallbackFn(1),
                url: "http://tauri.localhost".parse().unwrap(),
                body: tauri::ipc::InvokeBody::Json(
                    serde_json::json!({"slug":"canary","lang":"python","code":"print('harmless')","customInput":"2 3\n"}),
                ),
                headers: Default::default(),
                invoke_key: tauri::test::INVOKE_KEY.into(),
            },
        );
        assert_eq!(
            response.unwrap_err(),
            serde_json::json!(runner::ISOLATION_UNAVAILABLE)
        );
    }
    let state = app.state::<AppState>();
    assert_eq!(
        state.db.get_submissions("canary").unwrap().len(),
        1,
        "Rejected jobs must not create submission records"
    );
    state
        .db
        .conn
        .lock()
        .unwrap()
        .execute_batch("PRAGMA query_only=ON")
        .unwrap();
    assert!(commands::update_submission_notes(state.clone(), id, "new notes".into()).is_err());
    assert!(state.db.insert_breach("canary", 1, "synthetic").is_err());
    assert_eq!(
        state.db.get_submissions("canary").unwrap()[0]
            .notes
            .as_deref(),
        Some("notes")
    );
}

#[test]
fn wal_import_preserves_data_and_never_overwrites_destination() {
    let root = fixture("import");
    let source = root.join("old.db");
    let db = Database::new(source.clone()).unwrap();
    db.insert_submission(
        "canary",
        "python",
        "Accepted (AC)",
        1,
        1,
        "synthetic",
        Some("keep notes"),
    )
    .unwrap();
    db.insert_breach("canary", 1, "synthetic").unwrap();
    let dest = zenjudge_lib::resolve_db_path(&root.join("appdata"));
    zenjudge_lib::import_legacy_database(&source, &dest).unwrap();
    let copy = Database::new(dest.clone()).unwrap();
    assert_eq!(
        copy.get_submissions("canary").unwrap()[0].notes.as_deref(),
        Some("keep notes")
    );
    assert_eq!(copy.get_breaches("canary").unwrap().len(), 1);
    db.insert_submission("canary", "cpp", "Wrong Answer (WA)", 1, 1, "later", None)
        .unwrap();
    zenjudge_lib::import_legacy_database(&source, &dest).unwrap();
    assert_eq!(copy.get_submissions("canary").unwrap().len(), 1);
    assert_eq!(db.get_submissions("canary").unwrap().len(), 2);
    let conn = copy.conn.lock().unwrap();
    assert_eq!(
        conn.query_row("PRAGMA journal_mode", [], |r| r.get::<_, String>(0))
            .unwrap(),
        "wal"
    );
    assert_eq!(
        conn.query_row("PRAGMA busy_timeout", [], |r| r.get::<_, u64>(0))
            .unwrap(),
        5000
    );
}

#[test]
fn migration_keeps_old_rows_and_reports_invalid_schema_or_import() {
    let root = fixture("migration");
    let source = root.join("legacy.db");
    let conn = rusqlite::Connection::open(&source).unwrap();
    conn.execute_batch("CREATE TABLE submissions (id INTEGER PRIMARY KEY, timestamp TEXT NOT NULL, problem_slug TEXT NOT NULL, language TEXT NOT NULL, verdict TEXT NOT NULL, runtime_ms INTEGER NOT NULL, memory_kb INTEGER NOT NULL, code TEXT NOT NULL); INSERT INTO submissions VALUES (1, '2026-10-31', 'canary', 'python', 'Accepted (AC)', 1, 1, 'keep source');").unwrap();
    drop(conn);
    let db = Database::new(source).unwrap();
    let rows = db.get_submissions("canary").unwrap();
    assert_eq!(rows[0].code, "keep source");
    assert!(rows[0].notes.is_none());
    let invalid = root.join("invalid.db");
    fs::write(&invalid, b"not a database").unwrap();
    assert!(Database::new(invalid.clone()).is_err());
    let destination = root.join("import.db");
    assert!(zenjudge_lib::import_legacy_database(&invalid, &destination).is_err());
    assert!(!destination.exists());
    fs::write(
        destination.with_extension("db.importing"),
        b"stale import must be retained",
    )
    .unwrap();
    let valid = root.join("legacy.db");
    assert!(zenjudge_lib::import_legacy_database(&valid, &destination).is_err());
    assert_eq!(
        fs::read(destination.with_extension("db.importing")).unwrap(),
        b"stale import must be retained"
    );
}

#[test]
fn shipped_demos_have_independently_verified_expected_answers() {
    for slug in ["demo-signal-sum", "demo-quiet-run", "demo-rising-steps"] {
        let cases = problem::load_testcases(slug).unwrap();
        assert_eq!(cases.len(), 6);
        for case in cases {
            let words: Vec<i64> = case
                .input
                .split_whitespace()
                .map(|s| s.parse().unwrap())
                .collect();
            assert_eq!(words[0] as usize, words.len() - 1);
            let values = &words[1..];
            let expected: i64 = match slug {
                "demo-signal-sum" => values.iter().sum(),
                "demo-quiet-run" => values
                    .split(|n| *n == 1)
                    .map(|run| run.len() as i64)
                    .max()
                    .unwrap_or(0),
                "demo-rising-steps" => {
                    values.windows(2).filter(|pair| pair[1] > pair[0]).count() as i64
                }
                _ => unreachable!(),
            };
            assert_eq!(
                case.expected_output.trim(),
                expected.to_string(),
                "{slug} case {}",
                case.id
            );
        }
    }
}
