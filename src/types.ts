export type Verdict =
  | 'Execution Unavailable'
  | 'Accepted (AC)'
  | 'Wrong Answer (WA)'
  | 'Time Limit Exceeded (TLE)'
  | 'Memory Limit Exceeded (MLE)'
  | 'Runtime Error (RTE)'
  | 'Compile Error (CE)';

export interface ProblemMeta {
  title: string;
  slug: string;
  difficulty: string;
  time_limit_ms: number;
  memory_limit_mb: number;
  tags?: string[];
  templates?: Record<string, string>;
}

export interface ProblemListItem {
  title: string;
  slug: string;
  difficulty: string;
  time_limit_ms: number;
  memory_limit_mb: number;
  tags: string[];
  status: 'solved' | 'attempted' | 'unsolved';
  best_runtime_ms: number | null;
  total_submissions: number;
  is_bookmarked: boolean;
  is_redo: boolean;
}

export interface UserProgress {
  total_problems: number;
  solved_count: number;
  attempted_count: number;
  current_streak_days: number;
  total_submissions: number;
}

export interface TestCase {
  id: number;
  input: string;
  expected_output: string;
  is_sample: boolean;
}

export interface ProblemDetail {
  meta: ProblemMeta;
  statement_markdown: string;
  sample_testcases: TestCase[];
}

export interface TestCaseResult {
  case_id: number;
  is_sample: boolean;
  verdict: Verdict;
  runtime_ms: number;
  memory_kb: number;
  stdout: string;
  stderr: string;
  diff: string | null;
  input: string;
  expected_output: string;
}

export interface BatchRunResult {
  verdict: Verdict;
  passed_count: number;
  total_count: number;
  max_runtime_ms: number;
  max_memory_kb: number;
  compile_error: string | null;
  cases: TestCaseResult[];
}

export interface LockInStatus {
  is_active: boolean;
  problem_slug: string | null;
  strikes: number;
}

export interface BreachRecord {
  id: number;
  timestamp: string;
  problem_slug: string;
  strike_index: number;
  reason: string;
}

export interface SubmissionRecord {
  id: number;
  timestamp: string;
  problem_slug: string;
  language: string;
  verdict: Verdict;
  runtime_ms: number;
  memory_kb: number;
  code: string;
  notes?: string | null;
}
