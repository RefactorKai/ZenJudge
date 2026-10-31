// The old monolithic disk/thread/registry probes were unsafe on an unisolated host.
// This suite verifies the currently supported security contract: no execution.
use zenjudge_lib::runner::{prepare_execution, Verdict, ISOLATION_UNAVAILABLE};

#[test]
fn execution_rejects_instead_of_falling_back_to_user_privileges() {
    for lang in ["cpp", "python"] {
        let (verdict, reason) = prepare_execution(lang, "", "release").unwrap_err();
        assert_eq!(verdict, Verdict::ExecutionUnavailable);
        assert_eq!(reason, ISOLATION_UNAVAILABLE);
    }
}
