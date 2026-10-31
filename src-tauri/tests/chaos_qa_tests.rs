// Legacy bomb/registry/concurrency scenarios are retired, not counted as passes.
use zenjudge_lib::{
    problem::TestCase,
    runner::{run_testcases_batch, Verdict},
};

#[test]
fn repeated_rejected_jobs_never_return_an_accepted_verdict() {
    let cases = [TestCase {
        id: 1,
        input: String::new(),
        expected_output: String::new(),
        is_sample: true,
    }];
    for _ in 0..3 {
        let result = run_testcases_batch("python", "print('harmless')", "release", &cases, 100, 64);
        assert_eq!(result.verdict, Verdict::ExecutionUnavailable);
        assert_eq!(result.passed_count, 0);
        assert!(result.cases.is_empty());
    }
}
