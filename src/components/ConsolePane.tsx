import React, { useState, useRef, useEffect } from 'react';
import { BatchRunResult, TestCaseResult } from '../types';
import { Terminal, CheckCircle2, XCircle, Clock, AlertTriangle, Bug, HardDrive, ArrowRightCircle } from 'lucide-react';

interface ConsolePaneProps {
  runResult: BatchRunResult | null;
  isRunning: boolean;
  customInput: string;
  setCustomInput: (val: string) => void;
  onRunCustom: () => void;
}

export const ConsolePane: React.FC<ConsolePaneProps> = ({
  runResult,
  isRunning,
  customInput,
  setCustomInput,
  onRunCustom,
}) => {
  const [activeTab, setActiveTab] = useState<'results' | 'custom'>('results');
  const [selectedCaseIdx, setSelectedCaseIdx] = useState<number>(0);
  const customInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (activeTab === 'custom') {
      customInputRef.current?.focus();
    }
  }, [activeTab]);

  const getVerdictStyle = (v?: string) => {
    if (!v) return 'bg-zen-800 text-zen-400 border-zen-700';
    if (v.includes('Accepted')) return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    if (v.includes('Wrong')) return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
    if (v.includes('Time Limit')) return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
    if (v.includes('Memory Limit')) return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
    if (v.includes('Compile')) return 'bg-orange-500/10 text-orange-400 border-orange-500/30';
    return 'bg-pink-500/10 text-pink-400 border-pink-500/30';
  };

  const selectedCase: TestCaseResult | undefined =
    runResult?.cases && runResult.cases.length > 0
      ? runResult.cases[selectedCaseIdx] || runResult.cases[0]
      : undefined;

  return (
    <div className="h-full flex flex-col bg-zen-950 border-t border-zen-800 select-none">
      {/* Console Tab Bar */}
      <div className="h-9 bg-zen-900 border-b border-zen-800 px-3 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setActiveTab('results')}
            className={`text-xs px-2.5 py-1 rounded font-medium flex items-center space-x-1.5 transition-all ${
              activeTab === 'results'
                ? 'bg-zen-800 text-white'
                : 'text-zen-400 hover:text-zen-200'
            }`}
          >
            <Terminal className="w-3 h-3" />
            <span>Test Output</span>
            {runResult && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold border ${getVerdictStyle(runResult.verdict)}`}>
                {runResult.passed_count}/{runResult.total_count}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('custom')}
            className={`text-xs px-2.5 py-1 rounded font-medium transition-all ${
              activeTab === 'custom'
                ? 'bg-zen-800 text-white'
                : 'text-zen-400 hover:text-zen-200'
            }`}
          >
            Custom Input
          </button>
        </div>

        {isRunning && (
          <div className="flex items-center space-x-2 text-xs text-sky-400">
            <div className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
            <span>Preparing execution...</span>
          </div>
        )}
      </div>

      {/* Console Body */}
      <div className="flex-1 overflow-y-auto p-4 text-xs">
        {activeTab === 'results' && (
          <>
            {!runResult && !isRunning && (
              <div className="h-full flex flex-col items-center justify-center text-zen-500 space-y-1">
                <Terminal className="w-8 h-8 opacity-40 mb-1" />
                <p>Run sample tests or submit solution to inspect execution verdicts.</p>
                <p className="text-[11px] text-zen-600">Execution is disabled until filesystem and network isolation is available.</p>
              </div>
            )}

            {isRunning && (
              <div className="h-full flex flex-col items-center justify-center text-sky-400 space-y-2">
                <div className="w-8 h-8 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
                <p className="text-xs">Compiling & executing against test suite...</p>
              </div>
            )}

            {runResult && !isRunning && (
              <div className="space-y-4">
                {/* Overall Verdict Banner */}
                <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg bg-zen-900 border border-zen-800">
                  <div className="flex items-center space-x-3">
                    <span className={`px-3 py-1 rounded text-xs font-bold border ${getVerdictStyle(runResult.verdict)}`}>
                      {runResult.verdict}
                    </span>
                    <span className="text-zen-300">
                      Passed: <strong className="text-white">{runResult.passed_count}</strong> / {runResult.total_count} cases
                    </span>
                  </div>

                  <div className="flex items-center space-x-4 text-zen-400 text-[11px]">
                    <span className="flex items-center">
                      <Clock className="w-3.5 h-3.5 mr-1 text-sky-400" />
                      Max Time: <strong className="text-zen-200 ml-1">{runResult.max_runtime_ms} ms</strong>
                    </span>
                    <span className="flex items-center">
                      <HardDrive className="w-3.5 h-3.5 mr-1 text-purple-400" />
                      Peak RAM: <strong className="text-zen-200 ml-1">{(runResult.max_memory_kb / 1024).toFixed(2)} MB</strong>
                    </span>
                  </div>
                </div>

                {/* Compile Error View */}
                {runResult.compile_error && (
                  <div className="bg-orange-950/20 border border-orange-800/40 rounded-lg p-3 space-y-1.5">
                    <div className="flex items-center text-orange-400 font-semibold text-xs">
                      <AlertTriangle className="w-4 h-4 mr-1.5" />
                      <span>Compiler Diagnostics (stderr)</span>
                    </div>
                    <pre className="p-2.5 bg-zen-950 rounded text-orange-200/90 font-mono text-[11px] overflow-x-auto whitespace-pre-wrap leading-relaxed">
                      {runResult.compile_error}
                    </pre>
                  </div>
                )}

                {/* Case Pills */}
                {runResult.cases.length > 0 && (
                  <div>
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {runResult.cases.map((c, idx) => (
                        <button
                          key={c.case_id}
                          onClick={() => setSelectedCaseIdx(idx)}
                          className={`px-2.5 py-1 rounded text-xs font-mono font-medium flex items-center space-x-1.5 border transition-all ${
                            selectedCaseIdx === idx
                              ? 'bg-zen-800 text-white border-sky-500 shadow-sm'
                              : 'bg-zen-900 text-zen-400 border-zen-800 hover:border-zen-700'
                          }`}
                        >
                          {c.verdict.includes('Accepted') ? (
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <XCircle className="w-3 h-3 text-rose-400" />
                          )}
                          <span>Case #{c.case_id}</span>
                        </button>
                      ))}
                    </div>

                    {/* Detailed Case View */}
                    {selectedCase && (
                      <div className="bg-zen-900 rounded-lg border border-zen-800 p-3.5 space-y-3.5">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zen-800 pb-2.5">
                          <div className="flex items-center space-x-2">
                            <span className="font-semibold text-white">Case #{selectedCase.case_id}</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${getVerdictStyle(selectedCase.verdict)}`}>
                              {selectedCase.verdict}
                            </span>
                            {selectedCase.is_sample && (
                              <span className="text-[10px] bg-zen-800 text-zen-400 px-1.5 py-0.5 rounded">Sample</span>
                            )}
                          </div>
                          <div className="flex items-center space-x-3">
                            <div className="flex items-center space-x-3 text-[11px] text-zen-400">
                              <span>Time: <strong className="text-zen-200">{selectedCase.runtime_ms} ms</strong></span>
                              <span>Memory: <strong className="text-zen-200">{(selectedCase.memory_kb / 1024).toFixed(1)} MB</strong></span>
                            </div>

                            {/* 1-Click "Debug in Custom Input" if failing */}
                            {!selectedCase.verdict.includes('Accepted') && selectedCase.input && (
                              <button
                                onClick={() => {
                                  setCustomInput(selectedCase.input);
                                  setActiveTab('custom');
                                }}
                                className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-sky-600/30 hover:bg-sky-600/50 text-sky-300 hover:text-white border border-sky-500/40 text-[11px] font-semibold transition-all shadow-sm"
                                title="Load this failing testcase into the Custom Input tab"
                              >
                                <ArrowRightCircle className="w-3.5 h-3.5 text-sky-400" />
                                <span>Debug in Custom Input</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Diff Alert if WA */}
                        {selectedCase.diff && (
                          <div className="bg-rose-950/30 border border-rose-900/60 rounded-lg p-2.5 text-xs">
                            <div className="font-semibold text-rose-400 mb-1 flex items-center">
                              <Bug className="w-3.5 h-3.5 mr-1" />
                              Normalized Output Diff:
                            </div>
                            <pre className="text-rose-200 font-mono text-[11px] whitespace-pre-wrap leading-relaxed">
                              {selectedCase.diff}
                            </pre>
                          </div>
                        )}

                        {/* Dedicated Debug (stderr) Panel for dbg(...) output */}
                        {selectedCase.stderr && (
                          <div className="bg-sky-950/20 border border-sky-800/40 rounded-lg p-2.5 text-xs">
                            <div className="font-semibold text-sky-400 mb-1 flex items-center">
                              <Terminal className="w-3.5 h-3.5 mr-1" />
                              Debug Output (`stderr` / `dbg(...)` Inspector):
                            </div>
                            <pre className="text-sky-200/95 font-mono text-[11px] whitespace-pre-wrap bg-zen-950 p-2 rounded border border-zen-800/80 max-h-36 overflow-y-auto leading-relaxed">
                              {selectedCase.stderr}
                            </pre>
                          </div>
                        )}

                        {/* Tri-panel: Input | Expected | Actual */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                          <div>
                            <div className="text-[10px] text-zen-400 uppercase font-mono mb-1 flex items-center justify-between">
                              <span>Input (stdin)</span>
                              <span className="text-[9px] text-zen-500 font-normal">Payload</span>
                            </div>
                            <pre className="bg-zen-950 p-2.5 rounded border border-zen-800 text-zen-200 font-mono text-xs overflow-x-auto max-h-32">
                              {selectedCase.input || '(Empty stdin)'}
                            </pre>
                          </div>

                          <div>
                            <div className="text-[10px] text-zen-400 uppercase font-mono mb-1 flex items-center justify-between">
                              <span>Expected (stdout)</span>
                              <span className="text-[9px] text-emerald-400/80 font-normal">Target</span>
                            </div>
                            <pre className="bg-zen-950 p-2.5 rounded border border-zen-800 text-emerald-200/90 font-mono text-xs overflow-x-auto max-h-32">
                              {selectedCase.expected_output || '(Empty expected)'}
                            </pre>
                          </div>

                          <div>
                            <div className="text-[10px] text-zen-400 uppercase font-mono mb-1 flex items-center justify-between">
                              <span>Actual (stdout)</span>
                              <span className="text-[9px] text-sky-400/80 font-normal">Result</span>
                            </div>
                            <pre className="bg-zen-950 p-2.5 rounded border border-zen-800 text-zen-200 font-mono text-xs overflow-x-auto max-h-32">
                              {selectedCase.stdout || '(Empty output)'}
                            </pre>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {activeTab === 'custom' && (
          <div className="space-y-3">
            <div>
              <div className="text-[11px] text-zen-400 mb-1">Standard Input (stdin) to pipe to your solution:</div>
              <textarea
                ref={customInputRef}
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                placeholder="Enter custom input here..."
                rows={5}
                className="w-full bg-zen-950 border border-zen-800 rounded p-2.5 font-mono text-xs text-white focus:outline-none focus:border-sky-500"
              />
            </div>

            <button
              onClick={onRunCustom}
              disabled={isRunning}
              className="px-3.5 py-1.5 rounded bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
            >
              Run Custom Input
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
