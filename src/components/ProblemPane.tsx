import React, { useState } from 'react';
import { ProblemDetail, SubmissionRecord, BreachRecord } from '../types';
import { MarkdownRenderer } from './MarkdownRenderer';
import { DiffEditor } from '@monaco-editor/react';
import {
  Clock,
  Cpu,
  HardDrive,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileCode,
  GitCompare,
  Edit3,
  Save,
  X,
  RotateCcw,
  StickyNote,
} from 'lucide-react';

interface ProblemPaneProps {
  problemDetail: ProblemDetail | null;
  activeTab: 'problem' | 'submissions' | 'breaches';
  submissions: SubmissionRecord[];
  breaches: BreachRecord[];
  onSelectSubmissionCode: (code: string, lang: string) => void;
  currentEditorCode?: string;
  onUpdateNotes?: (submissionId: number, notes: string) => Promise<void>;
}

export const ProblemPane: React.FC<ProblemPaneProps> = ({
  problemDetail,
  activeTab,
  submissions,
  breaches,
  onSelectSubmissionCode,
  currentEditorCode = '',
  onUpdateNotes,
}) => {
  const [diffSubmission, setDiffSubmission] = useState<SubmissionRecord | null>(null);
  const [compareTargetId, setCompareTargetId] = useState<'editor' | number>('editor');

  // Notes editing state: mapping submission id to text
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [noteDraft, setNoteDraft] = useState<string>('');
  const [isSavingNote, setIsSavingNote] = useState<boolean>(false);

  const getVerdictStyle = (v: string) => {
    if (v.includes('Accepted')) return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    if (v.includes('Wrong')) return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
    if (v.includes('Time')) return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
    if (v.includes('Memory')) return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
    return 'bg-pink-500/10 text-pink-400 border-pink-500/30';
  };

  const handleStartEditNote = (sub: SubmissionRecord) => {
    setEditingNoteId(sub.id);
    setNoteDraft(sub.notes || '');
  };

  const handleSaveNote = async (submissionId: number) => {
    if (!onUpdateNotes) return;
    setIsSavingNote(true);
    try {
      await onUpdateNotes(submissionId, noteDraft);
      setEditingNoteId(null);
    } catch (e) {
      console.error('Failed to save note:', e);
    } finally {
      setIsSavingNote(false);
    }
  };

  const getTargetCompareCode = () => {
    if (compareTargetId === 'editor') {
      return currentEditorCode;
    }
    const other = submissions.find((s) => s.id === compareTargetId);
    return other ? other.code : '';
  };

  if (!problemDetail) {
    return (
      <div className="h-full flex items-center justify-center text-zen-500 text-xs">
        Loading problem...
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-5 space-y-6">
      {activeTab === 'problem' && (
        <>
          {/* Header Info */}
          <div>
            <h1 className="text-xl font-bold text-white mb-2">{problemDetail.meta.title}</h1>
            <div className="flex flex-wrap gap-2 items-center text-xs">
              <span className="px-2 py-0.5 rounded bg-zen-800 text-zen-300 border border-zen-700">
                Difficulty: <strong className="text-white">{problemDetail.meta.difficulty}</strong>
              </span>
              <span className="px-2 py-0.5 rounded bg-zen-800 text-zen-300 border border-zen-700">
                Time Limit: <strong className="text-white">{problemDetail.meta.time_limit_ms} ms</strong>
              </span>
              <span className="px-2 py-0.5 rounded bg-zen-800 text-zen-300 border border-zen-700">
                Memory Limit: <strong className="text-white">{problemDetail.meta.memory_limit_mb} MB</strong>
              </span>
              {problemDetail.meta.tags?.map((t) => (
                <span key={t} className="px-2 py-0.5 rounded bg-sky-950/60 text-sky-400 border border-sky-800/40 text-[11px]">
                  #{t}
                </span>
              ))}
            </div>
          </div>

          <hr className="border-zen-800" />

          {/* Markdown Problem Narrative */}
          <MarkdownRenderer content={problemDetail.statement_markdown} />

          {/* Sample Cases preview cards */}
          {problemDetail.sample_testcases.length > 0 && (
            <div className="mt-6 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zen-400">
                Sample Test Cases ({problemDetail.sample_testcases.length})
              </h3>
              <div className="grid grid-cols-1 gap-3">
                {problemDetail.sample_testcases.map((sample) => (
                  <div key={sample.id} className="bg-zen-950 rounded-lg border border-zen-800 p-3 space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-zen-400">
                      <span>Sample Case #{sample.id}</span>
                      <span className="text-emerald-400/80 font-mono">Sample</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <div className="text-[10px] text-zen-500 uppercase font-mono mb-1">Standard Input</div>
                        <pre className="bg-zen-900 p-2 rounded border border-zen-800/80 text-zen-200 font-mono overflow-x-auto text-[11px] max-h-24">
                          {sample.input}
                        </pre>
                      </div>
                      <div>
                        <div className="text-[10px] text-zen-500 uppercase font-mono mb-1">Expected Output</div>
                        <pre className="bg-zen-900 p-2 rounded border border-zen-800/80 text-zen-200 font-mono overflow-x-auto text-[11px] max-h-24">
                          {sample.expected_output}
                        </pre>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'submissions' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center space-x-2">
              <span>Local Submissions History (SQLite)</span>
            </h2>
            <span className="text-xs text-zen-400">{submissions.length} attempts recorded</span>
          </div>

          {submissions.length === 0 ? (
            <div className="bg-zen-950 rounded-lg border border-zen-800 p-8 text-center text-xs text-zen-500">
              No local submissions recorded yet for this problem. Run a full submission to persist results.
            </div>
          ) : (
            <div className="space-y-3">
              {submissions.map((sub) => {
                const isAC = sub.verdict.includes('Accepted');
                const isEditingThisNote = editingNoteId === sub.id;

                return (
                  <div
                    key={sub.id}
                    className="bg-zen-950 border border-zen-800 hover:border-zen-700 rounded-lg p-3.5 space-y-3 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${getVerdictStyle(sub.verdict)}`}>
                          {sub.verdict}
                        </span>
                        <span className="text-[10px] bg-zen-900 border border-zen-800 px-1.5 py-0.5 rounded text-zen-400 font-mono">
                          #{sub.id}
                        </span>
                      </div>
                      <span className="text-[11px] text-zen-500 font-mono flex items-center">
                        <Clock className="w-3 h-3 mr-1" />
                        {new Date(sub.timestamp).toLocaleTimeString()}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-zen-400 border-t border-zen-900 pt-2">
                      <div className="flex items-center space-x-3">
                        <span className="font-mono text-zen-300 font-semibold">{sub.language.toUpperCase()}</span>
                        <span className="flex items-center text-[11px]">
                          <Cpu className="w-3 h-3 mr-1 text-sky-400" />
                          {sub.runtime_ms} ms
                        </span>
                        <span className="flex items-center text-[11px]">
                          <HardDrive className="w-3 h-3 mr-1 text-purple-400" />
                          {(sub.memory_kb / 1024).toFixed(1)} MB
                        </span>
                      </div>

                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => {
                            setDiffSubmission(sub);
                            setCompareTargetId('editor');
                          }}
                          className="px-2 py-1 rounded text-xs font-medium bg-zen-900 hover:bg-zen-800 text-sky-300 border border-zen-750 flex items-center space-x-1 transition-all"
                          title="Git Diff compare with current editor or other submissions"
                        >
                          <GitCompare className="w-3 h-3 text-sky-400" />
                          <span>Compare Diff</span>
                        </button>

                        <button
                          onClick={() => onSelectSubmissionCode(sub.code, sub.language)}
                          className="px-2 py-1 rounded text-xs font-medium bg-zen-900 hover:bg-zen-800 text-zen-300 hover:text-white border border-zen-750 flex items-center space-x-1 transition-all"
                          title="Restore this submission's code into the active Monaco editor"
                        >
                          <RotateCcw className="w-3 h-3 text-emerald-400" />
                          <span>Restore</span>
                        </button>
                      </div>
                    </div>

                    {/* Markdown Notes section for AC submissions */}
                    {isAC && (
                      <div className="border-t border-zen-900 pt-2.5 space-y-2">
                        <div className="flex items-center justify-between text-[11px]">
                          <div className="flex items-center space-x-1.5 text-amber-400 font-medium">
                            <StickyNote className="w-3.5 h-3.5" />
                            <span>Notes & Complexity Analysis</span>
                          </div>
                          {!isEditingThisNote && (
                            <button
                              onClick={() => handleStartEditNote(sub)}
                              className="text-[10px] text-zen-400 hover:text-sky-300 flex items-center space-x-1"
                            >
                              <Edit3 className="w-3 h-3" />
                              <span>{sub.notes ? 'Edit Notes' : 'Add Notes'}</span>
                            </button>
                          )}
                        </div>

                        {isEditingThisNote ? (
                          <div className="space-y-2 bg-zen-900/60 p-2.5 rounded-lg border border-zen-800">
                            <textarea
                              value={noteDraft}
                              onChange={(e) => setNoteDraft(e.target.value)}
                              placeholder="Write Markdown notes: time/space complexity (e.g. $O(N)$), key pattern, or edge cases..."
                              rows={3}
                              className="w-full bg-zen-950 border border-zen-750 rounded p-2 text-xs text-white placeholder-zen-500 focus:outline-none focus:border-sky-500 font-mono"
                            />
                            <div className="flex justify-end space-x-2">
                              <button
                                onClick={() => setEditingNoteId(null)}
                                className="px-2.5 py-1 rounded text-[11px] bg-zen-800 text-zen-400 hover:text-white"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleSaveNote(sub.id)}
                                disabled={isSavingNote}
                                className="px-3 py-1 rounded text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center space-x-1 shadow-sm"
                              >
                                <Save className="w-3 h-3" />
                                <span>{isSavingNote ? 'Saving...' : 'Save Note'}</span>
                              </button>
                            </div>
                          </div>
                        ) : sub.notes ? (
                          <div className="bg-zen-900/40 border border-zen-850 rounded-lg p-2.5 text-xs text-zen-200">
                            <MarkdownRenderer content={sub.notes} />
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Side-by-Side Git Diff Modal */}
      {diffSubmission && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-6 animate-fadeIn">
          <div className="bg-zen-900 border border-zen-750 rounded-2xl w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Diff Header */}
            <div className="h-14 bg-zen-850 border-b border-zen-800 px-5 flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-sky-600/20 border border-sky-500/40 flex items-center justify-center text-sky-400">
                  <GitCompare className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                    <span>Submission #{diffSubmission.id} Git Diff</span>
                    <span className={`px-2 py-0.2 rounded text-[10px] font-semibold border ${getVerdictStyle(diffSubmission.verdict)}`}>
                      {diffSubmission.verdict}
                    </span>
                  </h3>
                  <p className="text-[11px] text-zen-400">
                    Comparing past snapshot against editor buffer or peer submission
                  </p>
                </div>
              </div>

              {/* Target selector and Actions */}
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2 text-xs">
                  <span className="text-zen-400">Compare with:</span>
                  <select
                    value={compareTargetId}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCompareTargetId(val === 'editor' ? 'editor' : Number(val));
                    }}
                    className="bg-zen-950 text-xs text-white border border-zen-700 rounded px-2.5 py-1 focus:outline-none focus:border-sky-500"
                  >
                    <option value="editor">Current Editor Buffer</option>
                    {submissions
                      .filter((s) => s.id !== diffSubmission.id)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          Submission #{s.id} ({s.verdict} - {s.runtime_ms}ms)
                        </option>
                      ))}
                  </select>
                </div>

                <button
                  onClick={() => {
                    onSelectSubmissionCode(diffSubmission.code, diffSubmission.language);
                    setDiffSubmission(null);
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center space-x-1.5 shadow-sm transition-all"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restore Snapshot</span>
                </button>

                <button
                  onClick={() => setDiffSubmission(null)}
                  className="p-1.5 rounded-lg text-zen-400 hover:text-white hover:bg-zen-800 transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Monaco DiffEditor Canvas */}
            <div className="flex-1 w-full overflow-hidden bg-zen-950 p-1">
              <DiffEditor
                height="100%"
                original={diffSubmission.code}
                modified={getTargetCompareCode()}
                language={diffSubmission.language === 'cpp' ? 'cpp' : 'python'}
                theme="vs-dark"
                options={{
                  readOnly: true,
                  renderSideBySide: true,
                  minimap: { enabled: false },
                  fontSize: 12,
                  automaticLayout: true,
                  scrollBeyondLastLine: false,
                }}
              />
            </div>

            {/* Diff Legend Footer */}
            <div className="h-8 bg-zen-850 border-t border-zen-800 px-4 flex items-center justify-between text-[11px] text-zen-500 shrink-0 font-mono">
              <span>Left: Submission #{diffSubmission.id} Snapshot ({diffSubmission.language.toUpperCase()})</span>
              <span>
                Right:{' '}
                {compareTargetId === 'editor'
                  ? 'Active Editor Buffer'
                  : `Submission #${compareTargetId}`}
              </span>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'breaches' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-rose-400 uppercase tracking-wider flex items-center">
              <AlertTriangle className="w-4 h-4 mr-1.5" />
              Focus Breaches & Strikes Log
            </h2>
            <span className="text-xs text-zen-400">{breaches.length} incidents logged</span>
          </div>

          {breaches.length === 0 ? (
            <div className="bg-zen-950 rounded-lg border border-zen-800 p-8 text-center text-xs text-zen-500">
              Zero focus breaches recorded. Keep maintaining absolute focus during Lock-In mode!
            </div>
          ) : (
            <div className="space-y-2">
              {breaches.map((b) => (
                <div
                  key={b.id}
                  className="bg-rose-950/20 border border-rose-900/40 rounded-lg p-3 text-xs"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-rose-400 flex items-center">
                      <span className="w-2 h-2 rounded-full bg-rose-500 mr-2" />
                      Strike #{b.strike_index}
                    </span>
                    <span className="text-[11px] text-zen-500 font-mono">
                      {new Date(b.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-zen-300 text-[11px]">{b.reason}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
