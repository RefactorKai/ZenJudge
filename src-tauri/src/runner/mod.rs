use serde::{Deserialize, Serialize};

// The former host runner was retired after F01-F03. A restricted token, Job
// Object, source filter, and working directory do not isolate file/network I/O.
pub const MAX_OUTPUT_BYTES: usize = 4 * 1024 * 1024;
pub const ISOLATION_UNAVAILABLE: &str = "Compilation and execution are disabled: no verified filesystem/network isolation boundary is installed.";

pub fn require_isolation() -> Result<(), String> {
    // No environment variable, profile, or renderer request may bypass this gate.
    Err(ISOLATION_UNAVAILABLE.to_string())
}

pub fn validate_source(language: &str, code: &str, profile: &str) -> Result<(), String> {
    if !matches!(language, "cpp" | "c++" | "python" | "py") {
        return Err("Unsupported language".into());
    }
    if !matches!(profile, "debug" | "release") {
        return Err("Unsupported compiler profile".into());
    }
    if code.len() > crate::problem::MAX_SOURCE_BYTES || code.contains('\0') {
        return Err("Source exceeds 256 KiB or contains NUL".into());
    }
    Ok(())
}

fn preview(line: &str) -> String {
    line.chars().take(256).collect()
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub enum Verdict {
    #[serde(rename = "Execution Unavailable")]
    ExecutionUnavailable,
    #[serde(rename = "Accepted (AC)")]
    Accepted,
    #[serde(rename = "Wrong Answer (WA)")]
    WrongAnswer,
    #[serde(rename = "Time Limit Exceeded (TLE)")]
    TimeLimitExceeded,
    #[serde(rename = "Memory Limit Exceeded (MLE)")]
    MemoryLimitExceeded,
    #[serde(rename = "Runtime Error (RTE)")]
    RuntimeError,
    #[serde(rename = "Compile Error (CE)")]
    CompileError,
}

impl Verdict {
    pub fn as_str(&self) -> &'static str {
        match self {
            Verdict::ExecutionUnavailable => "Execution Unavailable",
            Verdict::Accepted => "Accepted (AC)",
            Verdict::WrongAnswer => "Wrong Answer (WA)",
            Verdict::TimeLimitExceeded => "Time Limit Exceeded (TLE)",
            Verdict::MemoryLimitExceeded => "Memory Limit Exceeded (MLE)",
            Verdict::RuntimeError => "Runtime Error (RTE)",
            Verdict::CompileError => "Compile Error (CE)",
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TestCaseResult {
    pub case_id: usize,
    pub is_sample: bool,
    pub verdict: Verdict,
    pub runtime_ms: u64,
    pub memory_kb: u64,
    pub stdout: String,
    pub stderr: String,
    pub diff: Option<String>,
    pub input: String,
    pub expected_output: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BatchRunResult {
    pub verdict: Verdict,
    pub passed_count: usize,
    pub total_count: usize,
    pub max_runtime_ms: u64,
    pub max_memory_kb: u64,
    pub compile_error: Option<String>,
    pub cases: Vec<TestCaseResult>,
}

pub struct NormalizedDiff {
    pub is_match: bool,
    pub diff_message: Option<String>,
}

fn trim_trailing_empty<'a>(lines: &'a [&'a str]) -> &'a [&'a str] {
    let mut end = lines.len();
    while end > 0 && lines[end - 1].is_empty() {
        end -= 1;
    }
    &lines[..end]
}

pub fn normalize_and_compare(actual: &str, expected: &str) -> NormalizedDiff {
    if actual.len() > MAX_OUTPUT_BYTES || expected.len() > MAX_OUTPUT_BYTES {
        return NormalizedDiff {
            is_match: false,
            diff_message: Some("Output exceeds comparison budget".into()),
        };
    }
    let norm_actual: Vec<&str> = actual
        .lines()
        .map(|l| l.trim_end_matches(['\r', ' ', '\t']))
        .collect();
    let norm_expected: Vec<&str> = expected
        .lines()
        .map(|l| l.trim_end_matches(['\r', ' ', '\t']))
        .collect();

    let actual_lines = trim_trailing_empty(&norm_actual);
    let expected_lines = trim_trailing_empty(&norm_expected);

    if actual_lines == expected_lines {
        return NormalizedDiff {
            is_match: true,
            diff_message: None,
        };
    }

    let min_len = actual_lines.len().min(expected_lines.len());
    for i in 0..min_len {
        if actual_lines[i] != expected_lines[i] {
            return NormalizedDiff {
                is_match: false,
                diff_message: Some(format!(
                    "Line {} mismatch:\n  Expected: \"{}\"\n  Got:      \"{}\"",
                    i + 1,
                    preview(expected_lines[i]),
                    preview(actual_lines[i])
                )),
            };
        }
    }

    if actual_lines.len() < expected_lines.len() {
        NormalizedDiff {
            is_match: false,
            diff_message: Some(format!(
                "Output was shorter than expected: got {} lines, expected {} lines.\nMissing: \"{}\"",
                actual_lines.len(),
                expected_lines.len(),
                preview(expected_lines[min_len])
            )),
        }
    } else {
        NormalizedDiff {
            is_match: false,
            diff_message: Some(format!(
                "Output had extra lines: got {} lines, expected {} lines.\nExtra: \"{}\"",
                actual_lines.len(),
                expected_lines.len(),
                preview(actual_lines[min_len])
            )),
        }
    }
}

// Opaque: callers cannot fabricate artifacts to bypass preparation.
#[derive(Debug)]
pub struct ExecutionArtifacts {
    _private: (),
}

pub fn prepare_execution(
    language: &str,
    code: &str,
    profile: &str,
) -> Result<ExecutionArtifacts, (Verdict, String)> {
    validate_source(language, code, profile).map_err(|e| (Verdict::CompileError, e))?;
    require_isolation().map_err(|e| (Verdict::ExecutionUnavailable, e))?;
    Err((Verdict::ExecutionUnavailable, ISOLATION_UNAVAILABLE.into()))
}

#[allow(clippy::too_many_arguments)]
pub fn execute_single_testcase(
    _artifacts: &ExecutionArtifacts,
    case_id: usize,
    is_sample: bool,
    _input: &str,
    _expected_output: &str,
    _time_limit_ms: u64,
    _memory_limit_mb: u64,
) -> TestCaseResult {
    TestCaseResult {
        case_id,
        is_sample,
        verdict: Verdict::ExecutionUnavailable,
        runtime_ms: 0,
        memory_kb: 0,
        stdout: String::new(),
        stderr: ISOLATION_UNAVAILABLE.into(),
        diff: None,
        input: String::new(),
        expected_output: String::new(),
    }
}

pub fn run_testcases_batch(
    language: &str,
    code: &str,
    profile: &str,
    testcases: &[crate::problem::TestCase],
    time_limit_ms: u64,
    memory_limit_mb: u64,
) -> BatchRunResult {
    let error = crate::problem::validate_limits(time_limit_ms, memory_limit_mb)
        .and_then(|_| crate::problem::validate_testcases(testcases))
        .and_then(|_| validate_source(language, code, profile));
    let (verdict, message) = match error {
        Err(e) => (Verdict::RuntimeError, e),
        Ok(()) => (Verdict::ExecutionUnavailable, ISOLATION_UNAVAILABLE.into()),
    };
    BatchRunResult {
        verdict,
        passed_count: 0,
        total_count: testcases.len(),
        max_runtime_ms: 0,
        max_memory_kb: 0,
        compile_error: Some(message),
        cases: Vec::new(),
    }
}
