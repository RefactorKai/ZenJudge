use zenjudge_lib::db::Database;
use zenjudge_lib::problem::{load_problem_detail, load_testcases, scan_all_problems};
use zenjudge_lib::runner::normalize_and_compare;

#[test]
fn test_normalizer_exact_and_whitespace_differences() {
    let actual = "0 1   \r\n";
    let expected = "0 1\n";
    let res = normalize_and_compare(actual, expected);
    assert!(res.is_match, "Should match after normalization");

    let actual2 = "true\r\n\r\n";
    let expected2 = "true\n";
    let res2 = normalize_and_compare(actual2, expected2);
    assert!(res2.is_match, "Trailing empty lines should be ignored");

    let actual3 = "0 2\n";
    let expected3 = "0 1\n";
    let res3 = normalize_and_compare(actual3, expected3);
    assert!(!res3.is_match, "Value mismatch must be detected");
    assert!(res3.diff_message.unwrap().contains("Expected: \"0 1\""));
}

#[test]
fn test_problem_loading_and_decompression() {
    let problems = scan_all_problems().expect("Should scan problems");
    assert!(problems.len() >= 2, "Expected at least two problems");

    let signal_sum = problems
        .iter()
        .find(|p| p.slug == "demo-signal-sum")
        .expect("demo-signal-sum problem exists");
    assert_eq!(signal_sum.title, "Signal Sum");

    let detail =
        load_problem_detail("demo-signal-sum").expect("Should load demo-signal-sum detail");
    assert!(
        !detail.sample_testcases.is_empty(),
        "Demo must have sample cases"
    );

    let all_cases = load_testcases("demo-signal-sum").expect("Should load demo testcases.json");
    assert_eq!(
        all_cases.len(),
        6,
        "Expected 6 test cases for demo-signal-sum"
    );
}

#[test]
fn test_sqlite_persistence() {
    let root = std::env::temp_dir().join(format!(
        "zj_persistence_{}_{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::SystemTime::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    std::fs::create_dir(&root).expect("Fresh disposable fixture");
    let temp_db = root.join("test.db");

    let db = Database::new(temp_db).expect("Init test db");
    db.insert_breach("demo-signal-sum", 1, "Window lost focus")
        .expect("Insert breach");
    let breaches = db.get_breaches("demo-signal-sum").expect("Get breaches");
    assert_eq!(breaches.len(), 1);
    assert_eq!(breaches[0].strike_index, 1);

    let sub_id = db
        .insert_submission(
            "demo-signal-sum",
            "cpp",
            "Accepted (AC)",
            15,
            2048,
            "// code",
            None,
        )
        .expect("Insert submission");
    db.update_submission_notes(sub_id, "O(n) time and O(n) space hash map")
        .expect("Update notes");
    let subs = db
        .get_submissions("demo-signal-sum")
        .expect("Get submissions");
    assert_eq!(subs.len(), 1);
    assert_eq!(subs[0].verdict, "Accepted (AC)");
    assert_eq!(
        subs[0].notes.as_deref(),
        Some("O(n) time and O(n) space hash map")
    );

    // Test redo toggle
    let is_redo = db.toggle_redo("demo-signal-sum").expect("Toggle redo on");
    assert!(is_redo, "Should be marked for redo");
    let redos = db.get_redo_marks().expect("Get redos");
    assert!(redos.contains("demo-signal-sum"));
    let is_redo2 = db.toggle_redo("demo-signal-sum").expect("Toggle redo off");
    assert!(!is_redo2, "Should be unmarked for redo");

    // Test bookmark toggle
    let is_bm = db
        .toggle_bookmark("demo-signal-sum")
        .expect("Toggle bookmark on");
    assert!(is_bm, "Should be bookmarked");
    let bms = db.get_bookmarks().expect("Get bookmarks");
    assert!(bms.contains("demo-signal-sum"));

    let is_bm2 = db
        .toggle_bookmark("demo-signal-sum")
        .expect("Toggle bookmark off");
    assert!(!is_bm2, "Should be unbookmarked");

    // Test problem stats & progress
    let (status, best_time, total_subs) =
        db.get_problem_stats("demo-signal-sum").expect("Get stats");
    assert_eq!(status, "solved");
    assert_eq!(best_time, Some(15));
    assert_eq!(total_subs, 1);

    let progress = db.get_user_progress(5).expect("Get user progress");
    assert_eq!(progress.solved_count, 1);
    assert_eq!(progress.total_submissions, 1);
}
