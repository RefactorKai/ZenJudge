import React, { useEffect, useState, useRef } from 'react';
import { Header } from './components/Header';
import { ProblemPane } from './components/ProblemPane';
import { EditorPane } from './components/EditorPane';
import { ConsolePane } from './components/ConsolePane';
import { Dashboard } from './components/Dashboard';
import { LockInModal, EmergencyAbortOverlay } from './components/LockInModal';
import {
  ProblemMeta,
  ProblemListItem,
  UserProgress,
  ProblemDetail,
  BatchRunResult,
  LockInStatus,
  SubmissionRecord,
  BreachRecord,
} from './types';

// Tauri IPC helpers
const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

async function invokeTauri<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (isTauri) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<T>(cmd, args);
  }
  console.warn(`[ZenJudge Mock] Tauri not detected, mock fallback for '${cmd}'`);
  return Promise.reject(new Error('Tauri core not available in web browser'));
}

export const App: React.FC = () => {
  // Navigation View: 'dashboard' or 'workspace'
  const [view, setView] = useState<'dashboard' | 'workspace'>('dashboard');

  const [problemsMetadata, setProblemsMetadata] = useState<ProblemListItem[]>([]);
  const [userProgress, setUserProgress] = useState<UserProgress | null>(null);

  const [currentSlug, setCurrentSlug] = useState<string>('');
  const [problemDetail, setProblemDetail] = useState<ProblemDetail | null>(null);
  const [activeTab, setActiveTab] = useState<'problem' | 'submissions' | 'breaches'>('problem');

  const [language, setLanguage] = useState<string>('cpp');
  const [code, setCode] = useState<string>('');
  const drafts = useRef(new Map<string, string>());
  const selection = useRef({ slug: currentSlug, language });
  selection.current = { slug: currentSlug, language };
  const [storageError, setStorageError] = useState<string | null>(null);
  const draftKey = (slug: string, lang: string) => `${slug}:${lang}`;
  const [loadedDraftKey, setLoadedDraftKey] = useState<string | null>(null);
  const problemLoading = loadedDraftKey !== draftKey(currentSlug, language);
  const updateCode = (next: string) => {
    drafts.current.set(draftKey(currentSlug, language), next);
    setCode(next);
    try { localStorage.setItem(`zenjudge_draft_${draftKey(currentSlug, language)}`, next); }
    catch { setStorageError('Draft could not be saved. Keep this window open and copy your code before closing.'); }
  };
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [runResult, setRunResult] = useState<BatchRunResult | null>(null);
  const [customInput, setCustomInput] = useState<string>('');

  const [submissions, setSubmissions] = useState<SubmissionRecord[]>([]);
  const [breaches, setBreaches] = useState<BreachRecord[]>([]);

  // Lock-In Kiosk Mode State
  const [lockInStatus, setLockInStatus] = useState<LockInStatus>({
    is_active: false,
    problem_slug: null,
    strikes: 0,
  });
  const [isLockModalOpen, setIsLockModalOpen] = useState<boolean>(false);
  const [lockPenaltySeconds, setLockPenaltySeconds] = useState<number>(0);
  const [abortHoldProgress, setAbortHoldProgress] = useState<number>(0);

  // Key tracking for Ctrl+Shift+Q 3-second hold
  const holdStartTimeRef = useRef<number | null>(null);
  const holdIntervalRef = useRef<number | null>(null);
  const activeKeysRef = useRef<{ ctrl: boolean; shift: boolean; q: boolean }>({
    ctrl: false,
    shift: false,
    q: false,
  });

  // 1. Initial Load: Problems Metadata & User Progress from SQLite
  const loadDashboardData = () => {
    invokeTauri<ProblemListItem[]>('get_problems_metadata')
      .then((list) => {
        setProblemsMetadata(list);
        if (list.length > 0 && !list.find((p) => p.slug === currentSlug)) {
          setCurrentSlug(list[0].slug);
        }
      })
      .catch((err) => console.error('Failed to list problems:', err));

    invokeTauri<UserProgress>('get_user_progress')
      .then(setUserProgress)
      .catch(console.error);

    invokeTauri<LockInStatus>('get_lock_in_status')
      .then((status) => {
        setLockInStatus(status);
        if (status.is_active && status.problem_slug) {
          setCurrentSlug(status.problem_slug);
          setView('workspace');
        }
      })
      .catch(console.error);
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  // 2. Load Problem Detail & Code Template when slug or language changes
  useEffect(() => {
    if (!currentSlug) return;
    let cancelled = false;
    setLoadedDraftKey(null);
    setProblemDetail(null);
    const key = draftKey(currentSlug, language);
    invokeTauri<ProblemDetail>('get_problem', { slug: currentSlug })
      .then((detail) => {
        if (cancelled || selection.current.slug !== currentSlug || selection.current.language !== language) return;
        setProblemDetail(detail);
        const customTemplate = localStorage.getItem(`zenjudge_template_${language}`);
        const next = drafts.current.get(key) ?? localStorage.getItem(`zenjudge_draft_${key}`)
          ?? (customTemplate?.trim() ? customTemplate : detail.meta.templates?.[language] || '');
        drafts.current.set(key, next);
        setCode(next);
        setRunResult(null);
        setLoadedDraftKey(key);
      })
      .catch((err) => { if (!cancelled) setStorageError(`Problem could not be loaded: ${String(err)}`); });

    refreshHistory(currentSlug);
    return () => { cancelled = true; };
  }, [currentSlug, language]);

  const refreshHistory = (slug: string) => {
    invokeTauri<SubmissionRecord[]>('get_submissions', { slug })
      .then((rows) => { if (selection.current.slug === slug) setSubmissions(rows); })
      .catch(console.error);

    invokeTauri<BreachRecord[]>('get_breaches', { slug })
      .then((rows) => { if (selection.current.slug === slug) setBreaches(rows); })
      .catch(console.error);

    invokeTauri<UserProgress>('get_user_progress')
      .then(setUserProgress)
      .catch(console.error);
  };

  // 3. Listen to Tauri window focus strike events and abort events
  useEffect(() => {
    let unlistenStrike: (() => void) | undefined;
    let unlistenAbort: (() => void) | undefined;
    let unlistenStorage: (() => void) | undefined;
    let cancelled = false;

    if (isTauri) {
      import('@tauri-apps/api/event').then(({ listen }) => {
        listen<{ strikes: number; problem_slug: string }>(
          'zenjudge://strike-event',
          (event) => {
            setLockInStatus((prev) => ({
              ...prev,
              strikes: event.payload.strikes,
            }));
            setLockPenaltySeconds(10);
            refreshHistory(currentSlug);
          }
        ).then((unsub) => {
          if (cancelled) unsub(); else unlistenStrike = unsub;
        });

        listen('zenjudge://abort-event', () => {
          setLockInStatus({
            is_active: false,
            problem_slug: null,
            strikes: 0,
          });
          refreshHistory(currentSlug);
        }).then((unsub) => {
          if (cancelled) unsub(); else unlistenAbort = unsub;
        });
        listen<string>('zenjudge://storage-error', (event) => setStorageError(event.payload))
          .then((unsub) => { if (cancelled) unsub(); else unlistenStorage = unsub; });
      });
    }

    return () => {
      cancelled = true;
      if (unlistenStrike) unlistenStrike();
      if (unlistenAbort) unlistenAbort();
      if (unlistenStorage) unlistenStorage();
    };
  }, [currentSlug]);

  // 4. Penalty countdown timer
  useEffect(() => {
    if (lockPenaltySeconds <= 0) return;
    const timer = setInterval(() => {
      setLockPenaltySeconds((s) => (s > 1 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [lockPenaltySeconds]);

  // 5. Emergency Abort Listener: Ctrl + Shift + Q held for 3 seconds
  useEffect(() => {
    if (!lockInStatus.is_active) {
      setAbortHoldProgress(0);
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Control') activeKeysRef.current.ctrl = true;
      if (e.key === 'Shift') activeKeysRef.current.shift = true;
      if (e.code === 'KeyQ') activeKeysRef.current.q = true;

      const { ctrl, shift, q } = activeKeysRef.current;
      if (ctrl && shift && q && !holdStartTimeRef.current) {
        holdStartTimeRef.current = Date.now();
        holdIntervalRef.current = window.setInterval(() => {
          if (!holdStartTimeRef.current) return;
          const elapsed = Date.now() - holdStartTimeRef.current;
          const progress = Math.min(100, (elapsed / 3000) * 100);
          setAbortHoldProgress(progress);

          if (progress >= 100) {
            clearInterval(holdIntervalRef.current!);
            holdIntervalRef.current = null;
            holdStartTimeRef.current = null;
            setAbortHoldProgress(0);

            invokeTauri<LockInStatus>('emergency_abort_lock_in')
              .then((status) => {
                setLockInStatus(status);
                refreshHistory(currentSlug);
              })
              .catch((err) => { setLockInStatus((prev) => ({ ...prev, is_active: false })); setStorageError(String(err)); });
          }
        }, 50);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Control') activeKeysRef.current.ctrl = false;
      if (e.key === 'Shift') activeKeysRef.current.shift = false;
      if (e.code === 'KeyQ') activeKeysRef.current.q = false;

      if (holdIntervalRef.current) {
        clearInterval(holdIntervalRef.current);
        holdIntervalRef.current = null;
      }
      holdStartTimeRef.current = null;
      setAbortHoldProgress(0);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
    };
  }, [lockInStatus.is_active, currentSlug]);

  // Actions
  const handleOpenProblem = (slug: string) => {
    setCurrentSlug(slug);
    setView('workspace');
  };

  const handleToggleBookmark = async (slug: string) => {
    try {
      const isBookmarked = await invokeTauri<boolean>('toggle_bookmark', { slug });
      setProblemsMetadata((prev) =>
        prev.map((p) => (p.slug === slug ? { ...p, is_bookmarked: isBookmarked } : p))
      );
    } catch (err) {
      console.error('Failed to toggle bookmark:', err);
    }
  };

  const handleToggleRedo = async (slug: string) => {
    try {
      const isRedo = await invokeTauri<boolean>('toggle_redo', { slug });
      setProblemsMetadata((prev) =>
        prev.map((p) => (p.slug === slug ? { ...p, is_redo: isRedo } : p))
      );
    } catch (err) {
      console.error('Failed to toggle redo:', err);
    }
  };

  const handleUpdateSubmissionNotes = async (submissionId: number, notes: string) => {
    try {
      await invokeTauri('update_submission_notes', { submissionId, notes });
      setStorageError((current) => current?.startsWith('Notes were NOT saved:') ? null : current);
      refreshHistory(currentSlug);
    } catch (err) {
      setStorageError(`Notes were NOT saved: ${String(err)}`);
      throw err;
    }
  };

  const handleResetTemplate = () => {
    const customTemplate = localStorage.getItem(`zenjudge_template_${language}`);
    if (customTemplate && customTemplate.trim()) {
      updateCode(customTemplate);
    } else if (problemDetail?.meta.templates?.[language]) {
      updateCode(problemDetail.meta.templates[language]);
    }
  };

  const handleRunSamples = async () => {
    if (!currentSlug || problemLoading) return;
    setIsRunning(true);
    setRunResult(null);
    try {
      const res = await invokeTauri<BatchRunResult>('run_sample_code', {
        slug: currentSlug,
        lang: language,
        code,
        customInput: null,
      });
      setRunResult(res);
    } catch (err: any) {
      setStorageError(String(err));
    } finally {
      setIsRunning(false);
    }
  };

  const handleSubmit = async () => {
    if (!currentSlug || problemLoading) return;
    setIsRunning(true);
    setRunResult(null);
    try {
      const res = await invokeTauri<BatchRunResult>('submit_code', {
        slug: currentSlug,
        lang: language,
        code,
      });
      setRunResult(res);
      refreshHistory(currentSlug);
      loadDashboardData();
    } catch (err: any) {
      setStorageError(String(err));
    } finally {
      setIsRunning(false);
    }
  };

  // 6. Global Workspace Hotkeys: Ctrl + ' for Run Samples, Ctrl + Enter for Submit
  useEffect(() => {
    const handleGlobalHotkeys = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && view === 'workspace') {
        if (e.key === "'" || e.code === 'Quote') {
          e.preventDefault();
          if (!isRunning && lockPenaltySeconds <= 0) {
            handleRunSamples();
          }
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (!isRunning && lockPenaltySeconds <= 0) {
            handleSubmit();
          }
        }
      }
    };

    window.addEventListener('keydown', handleGlobalHotkeys);
    return () => window.removeEventListener('keydown', handleGlobalHotkeys);
  }, [view, isRunning, lockPenaltySeconds, currentSlug, language, code]);

  const handleRunCustom = async () => {
    if (!currentSlug || problemLoading) return;
    setIsRunning(true);
    setRunResult(null);
    try {
      const res = await invokeTauri<BatchRunResult>('run_sample_code', {
        slug: currentSlug,
        lang: language,
        code,
        customInput,
      });
      setRunResult(res);
    } catch (err: any) {
      setStorageError(String(err));
    } finally {
      setIsRunning(false);
    }
  };

  const handleToggleLockIn = () => {
    if (lockInStatus.is_active) {
      invokeTauri<LockInStatus>('toggle_lock_in', {
        enable: false,
        problemSlug: null,
      })
        .then(setLockInStatus)
        .catch(console.error);
    } else {
      setIsLockModalOpen(true);
    }
  };

  const handleConfirmLockIn = () => {
    invokeTauri<LockInStatus>('toggle_lock_in', {
      enable: true,
      problemSlug: currentSlug,
    })
      .then((status) => {
        setLockInStatus(status);
        setView('workspace'); // Always enter workspace when locking in
        refreshHistory(currentSlug);
      })
      .catch(console.error);
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-zen-950 text-zen-100 overflow-hidden font-sans relative">
      {storageError && <div role="alert" className="absolute top-0 inset-x-0 z-50 bg-rose-950 text-rose-100 p-3 text-sm">
        {storageError}<button className="ml-3 underline" onClick={() => setStorageError(null)}>Dismiss</button>
      </div>}
      {/* View Transition Container */}
      <div className="h-full w-full flex flex-col overflow-hidden transition-opacity duration-200">
        {view === 'dashboard' ? (
          <Dashboard
            problems={problemsMetadata}
            userProgress={userProgress}
            lockInStatus={lockInStatus}
            onOpenProblem={handleOpenProblem}
            onToggleLockIn={handleToggleLockIn}
            onToggleBookmark={handleToggleBookmark}
            onToggleRedo={handleToggleRedo}
            onRefresh={loadDashboardData}
          />
        ) : (
          <div className="h-full w-full flex flex-col overflow-hidden animate-fadeIn">
            {/* Top Header */}
            <Header
              problems={problemsMetadata}
              currentSlug={currentSlug}
              onSelectProblem={setCurrentSlug}
              currentMeta={problemDetail?.meta}
              lockInStatus={lockInStatus}
              onToggleLockIn={handleToggleLockIn}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              onBackToDashboard={() => {
                setView('dashboard');
                loadDashboardData();
              }}
            />

            {/* Main Split Interface */}
            <div className="flex-1 flex overflow-hidden">
              {/* Left Pane: Problem Narrative / Submissions / Breaches */}
              <div className="w-[45%] h-full bg-zen-900 border-r border-zen-800 flex flex-col overflow-hidden">
                <ProblemPane
                  problemDetail={problemDetail}
                  activeTab={activeTab}
                  submissions={submissions}
                  breaches={breaches}
                  currentEditorCode={code}
                  onUpdateNotes={handleUpdateSubmissionNotes}
                  onSelectSubmissionCode={(subCode, subLang) => {
                    drafts.current.set(draftKey(currentSlug, subLang), subCode);
                    try { localStorage.setItem(`zenjudge_draft_${draftKey(currentSlug, subLang)}`, subCode); }
                    catch { setStorageError('Restored code could not be saved as a draft.'); }
                    setCode(subCode);
                    setLanguage(subLang);
                  }}
                />
              </div>

              {/* Right Pane: Split between Editor and Console */}
              <div className="w-[55%] h-full flex flex-col overflow-hidden">
                <div className="h-[60%] w-full overflow-hidden">
                  <EditorPane
                    language={language}
                    setLanguage={setLanguage}
                    code={code}
                    setCode={updateCode}
                    onResetTemplate={handleResetTemplate}
                    onRunSamples={handleRunSamples}
                    onSubmit={handleSubmit}
                    isRunning={isRunning}
                    isLocked={lockPenaltySeconds > 0 || problemLoading}
                    lockPenaltySeconds={lockPenaltySeconds}
                  />
                </div>

                <div className="h-[40%] w-full overflow-hidden">
                  <ConsolePane
                    runResult={runResult}
                    isRunning={isRunning}
                    customInput={customInput}
                    setCustomInput={setCustomInput}
                    onRunCustom={handleRunCustom}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Lock-In Confirmation Modal */}
      <LockInModal
        isOpen={isLockModalOpen}
        onClose={() => setIsLockModalOpen(false)}
        onConfirmLockIn={handleConfirmLockIn}
        lockInStatus={lockInStatus}
        abortHoldProgress={abortHoldProgress}
      />

      {/* Emergency Abort progress overlay */}
      <EmergencyAbortOverlay progress={abortHoldProgress} />
    </div>
  );
};

export default App;
