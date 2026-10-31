use flate2::read::ZlibDecoder;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::fs::{self, File};
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

pub const MAX_SOURCE_BYTES: usize = 256 * 1024;
pub const MAX_CASE_BYTES: usize = 64 * 1024;
pub const MAX_SUITE_BYTES: usize = 2 * 1024 * 1024;
pub const MAX_CASES: usize = 100;
pub const MAX_NOTES_BYTES: usize = 64 * 1024;
const MAX_DECOMPRESSED_BYTES: usize = 4 * 1024 * 1024;
static PROBLEMS_ROOT: OnceLock<PathBuf> = OnceLock::new();

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProblemMeta {
    pub title: String,
    pub slug: String,
    pub difficulty: String,
    pub time_limit_ms: u64,
    pub memory_limit_mb: u64,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub templates: HashMap<String, String>,
}
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TestCase {
    pub id: usize,
    pub input: String,
    pub expected_output: String,
    #[serde(default)]
    pub is_sample: bool,
}
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProblemDetail {
    pub meta: ProblemMeta,
    pub statement_markdown: String,
    pub sample_testcases: Vec<TestCase>,
}

pub fn configure_root(root: PathBuf) -> Result<(), String> {
    reject_link(&root)?;
    let root = root.canonicalize().map_err(|e| e.to_string())?;
    PROBLEMS_ROOT
        .set(root)
        .map_err(|_| "Problem root already configured".into())
}
pub fn get_problems_root() -> PathBuf {
    if let Some(root) = PROBLEMS_ROOT.get() {
        return root.clone();
    }
    // Development and tests use the checkout, never the launch directory.
    if cfg!(debug_assertions) {
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../problems")
    } else {
        // Release startup must configure Tauri's resource directory first.
        PathBuf::new()
    }
}
pub fn validate_slug(slug: &str) -> Result<(), String> {
    let reserved = matches!(slug, "con" | "prn" | "aux" | "nul")
        || (slug.len() == 4
            && (slug.starts_with("com") || slug.starts_with("lpt"))
            && matches!(slug.as_bytes()[3], b'1'..=b'9'));
    if slug.is_empty()
        || slug.len() > 64
        || reserved
        || slug.starts_with('-')
        || slug.ends_with('-')
        || !slug
            .bytes()
            .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-')
    {
        return Err("Invalid problem slug".into());
    }
    Ok(())
}
pub fn validate_limits(time_ms: u64, memory_mb: u64) -> Result<(), String> {
    if !(10..=10_000).contains(&time_ms) || !(16..=512).contains(&memory_mb) {
        return Err("Limits must be 10-10000 ms and 16-512 MiB".into());
    }
    Ok(())
}
pub fn validate_testcases(cases: &[TestCase]) -> Result<(), String> {
    if cases.is_empty() || cases.len() > MAX_CASES {
        return Err(format!("A suite must contain 1-{MAX_CASES} cases"));
    }
    let mut ids = HashSet::new();
    let mut total = 0usize;
    for case in cases {
        if case.id == 0 || !ids.insert(case.id) {
            return Err("Case IDs must be positive and unique".into());
        }
        if case.input.len() > MAX_CASE_BYTES || case.expected_output.len() > MAX_CASE_BYTES {
            return Err("Testcase input/output exceeds 64 KiB".into());
        }
        total += case.input.len() + case.expected_output.len();
        if total > MAX_SUITE_BYTES {
            return Err("Test suite exceeds 2 MiB".into());
        }
    }
    Ok(())
}
fn reject_link(path: &Path) -> Result<(), String> {
    let meta = fs::symlink_metadata(path).map_err(|e| format!("{}: {e}", path.display()))?;
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        if meta.file_attributes() & 0x400 != 0 {
            return Err("Problem resources cannot contain reparse points".into());
        }
    }
    if meta.file_type().is_symlink() {
        return Err("Problem resources cannot contain symbolic links".into());
    }
    Ok(())
}
fn pack_dir(root: &Path, slug: &str) -> Result<PathBuf, String> {
    validate_slug(slug)?;
    if root.as_os_str().is_empty() {
        return Err("Problem resources are not configured".into());
    }
    reject_link(root)?;
    let root = root.canonicalize().map_err(|e| e.to_string())?;
    let path = root.join(slug);
    reject_link(&path)?;
    let path = path.canonicalize().map_err(|e| e.to_string())?;
    if !path.starts_with(&root) || !path.is_dir() {
        return Err("Problem path escapes its resource root".into());
    }
    Ok(path)
}
fn read_bounded(path: &Path, max: usize) -> Result<Vec<u8>, String> {
    reject_link(path)?;
    let mut options = fs::OpenOptions::new();
    options.read(true);
    #[cfg(windows)]
    {
        use std::os::windows::fs::OpenOptionsExt;
        // Open a substituted reparse point itself, rather than following its target.
        options.custom_flags(0x0020_0000);
    }
    let file: File = options.open(path).map_err(|e| e.to_string())?;
    let meta = file.metadata().map_err(|e| e.to_string())?;
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        if meta.file_attributes() & 0x400 != 0 {
            return Err("Resource was replaced with a reparse point".into());
        }
    }
    if !meta.is_file() || meta.len() > max as u64 {
        return Err(format!(
            "Resource exceeds {max} bytes or is not a regular file"
        ));
    }
    read_limit(file, max)
}
fn read_limit(reader: impl Read, max: usize) -> Result<Vec<u8>, String> {
    let mut bytes = Vec::new();
    reader
        .take(max as u64 + 1)
        .read_to_end(&mut bytes)
        .map_err(|e| e.to_string())?;
    if bytes.len() > max {
        return Err(format!("Resource exceeds {max} bytes"));
    }
    Ok(bytes)
}
fn load_meta(dir: &Path, slug: &str) -> Result<ProblemMeta, String> {
    let meta: ProblemMeta =
        serde_json::from_slice(&read_bounded(&dir.join("meta.json"), 256 * 1024)?)
            .map_err(|e| e.to_string())?;
    validate_limits(meta.time_limit_ms, meta.memory_limit_mb)?;
    if meta.slug != slug
        || meta.title.trim().is_empty()
        || meta.title.len() > 256
        || !matches!(meta.difficulty.as_str(), "Easy" | "Medium" | "Hard")
        || meta.tags.len() > 32
        || meta.tags.iter().any(|t| t.len() > 64)
        || meta.templates.len() > 2
        || meta.templates.iter().any(|(lang, code)| {
            !matches!(lang.as_str(), "cpp" | "python") || code.len() > MAX_SOURCE_BYTES
        })
    {
        return Err("Invalid problem metadata".into());
    }
    Ok(meta)
}
pub fn scan_all_problems() -> Result<Vec<ProblemMeta>, String> {
    let root = get_problems_root();
    reject_link(&root)?;
    let mut list = Vec::new();
    for (count, entry) in fs::read_dir(&root).map_err(|e| e.to_string())?.enumerate() {
        if count >= 1000 {
            return Err("Problem catalog exceeds 1000 entries".into());
        }
        let entry = entry.map_err(|e| e.to_string())?;
        reject_link(&entry.path())?;
        if entry.file_type().map_err(|e| e.to_string())?.is_dir() {
            let slug = entry
                .file_name()
                .into_string()
                .map_err(|_| "Invalid slug encoding")?;
            list.push(load_meta(&pack_dir(&root, &slug)?, &slug)?);
        }
    }
    list.sort_by(|a, b| a.title.cmp(&b.title));
    Ok(list)
}
pub fn load_problem_detail(slug: &str) -> Result<ProblemDetail, String> {
    load_problem_detail_from(&get_problems_root(), slug)
}
pub fn load_problem_detail_from(root: &Path, slug: &str) -> Result<ProblemDetail, String> {
    let dir = pack_dir(root, slug)?;
    let meta = load_meta(&dir, slug)?;
    let statement_markdown =
        String::from_utf8(read_bounded(&dir.join("statement.md"), 512 * 1024)?)
            .map_err(|e| e.to_string())?;
    let sample_testcases = load_testcases_from(root, slug)?
        .into_iter()
        .filter(|tc| tc.is_sample)
        .collect();
    Ok(ProblemDetail {
        meta,
        statement_markdown,
        sample_testcases,
    })
}
pub fn load_testcases(slug: &str) -> Result<Vec<TestCase>, String> {
    load_testcases_from(&get_problems_root(), slug)
}
pub fn load_testcases_from(root: &Path, slug: &str) -> Result<Vec<TestCase>, String> {
    let dir = pack_dir(root, slug)?;
    let bin = dir.join("testcases.bin");
    let bytes = match fs::symlink_metadata(&bin) {
        Ok(_) => {
            let compressed = read_bounded(&bin, MAX_SUITE_BYTES)?;
            read_limit(ZlibDecoder::new(&compressed[..]), MAX_DECOMPRESSED_BYTES)?
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            read_bounded(&dir.join("testcases.json"), MAX_DECOMPRESSED_BYTES)?
        }
        Err(e) => return Err(e.to_string()),
    };
    let cases: Vec<TestCase> = serde_json::from_slice(&bytes).map_err(|e| e.to_string())?;
    validate_testcases(&cases)?;
    Ok(cases)
}
