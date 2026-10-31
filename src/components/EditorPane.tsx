import React, { useLayoutEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { Play, Send, RotateCcw, Lock } from 'lucide-react';
import '../monaco-offline'; // Ensures local offline workers are registered

interface EditorPaneProps {
  language: string;
  setLanguage: (lang: string) => void;
  code: string;
  setCode: (code: string) => void;
  onResetTemplate: () => void;
  onRunSamples: () => void;
  onSubmit: () => void;
  isRunning: boolean;
  isLocked: boolean;
  lockPenaltySeconds: number;
}

export const EditorPane: React.FC<EditorPaneProps> = ({
  language,
  setLanguage,
  code,
  setCode,
  onResetTemplate,
  onRunSamples,
  onSubmit,
  isRunning,
  isLocked,
  lockPenaltySeconds,
}) => {
  const monacoLanguage = language === 'cpp' ? 'cpp' : 'python';
  const actions = useRef({ onRunSamples, onSubmit, isRunning, isLocked });
  useLayoutEffect(() => {
    actions.current = { onRunSamples, onSubmit, isRunning, isLocked };
  }, [onRunSamples, onSubmit, isRunning, isLocked]);

  const handleEditorDidMount = (editor: any, monaco: any) => {
    // Hotkey: Ctrl + ' to Run Samples
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.US_QUOTE, () => {
      if (!actions.current.isRunning && !actions.current.isLocked) {
        actions.current.onRunSamples();
      }
    });

    // Hotkey: Ctrl + Enter to Submit Solution
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      if (!actions.current.isRunning && !actions.current.isLocked) {
        actions.current.onSubmit();
      }
    });
  };

  return (
    <div className="h-full flex flex-col bg-zen-900 border-l border-zen-800 relative">
      {/* Editor Toolbar */}
      <div className="h-10 bg-zen-850 border-b border-zen-800 px-3 flex items-center justify-between select-none">
        <div className="flex items-center space-x-2">
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            disabled={isRunning || isLocked}
            className="bg-zen-800 text-xs text-white border border-zen-700 rounded px-2 py-1 focus:outline-none focus:border-sky-500 font-mono"
          >
            <option value="cpp">C++20 (g++ -O2)</option>
            <option value="python">Python 3.12+</option>
          </select>

          <button
            onClick={onResetTemplate}
            disabled={isRunning || isLocked}
            className="text-[11px] text-zen-400 hover:text-zen-200 flex items-center space-x-1 px-2 py-1 rounded hover:bg-zen-800 transition-all"
            title="Reset to personal or starter template"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset</span>
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2">
          <button
            onClick={onRunSamples}
            disabled={isRunning || isLocked}
            className="flex items-center space-x-1.5 px-3 py-1 rounded bg-zen-800 hover:bg-zen-700 text-zen-200 hover:text-white text-xs font-semibold border border-zen-700 transition-all disabled:opacity-50"
            title="Run solution against sample cases (Ctrl + ')"
          >
            <Play className="w-3 h-3 text-sky-400 fill-sky-400" />
            <span>Run Samples</span>
            <kbd className="hidden sm:inline font-mono text-[10px] bg-zen-900 border border-zen-700 rounded px-1 text-zen-400">
              Ctrl+'
            </kbd>
          </button>

          <button
            onClick={onSubmit}
            disabled={isRunning || isLocked}
            className="flex items-center space-x-1.5 px-3.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
            title="Submit solution against all offline test vectors (Ctrl + Enter)"
          >
            <Send className="w-3 h-3" />
            <span>Submit Solution</span>
            <kbd className="hidden sm:inline font-mono text-[10px] bg-emerald-700/60 rounded px-1 text-emerald-100">
              Ctrl+↵
            </kbd>
          </button>
        </div>
      </div>

      {/* Penalty Overlay if Strike Lock is active */}
      {isLocked && lockPenaltySeconds > 0 && (
        <div className="absolute inset-0 top-10 z-20 bg-rose-950/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center select-none animate-fadeIn">
          <div className="w-12 h-12 rounded-full bg-rose-600/20 border border-rose-500/50 flex items-center justify-center text-rose-400 mb-3 animate-pulse">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-rose-200 mb-1">STRIKE PENALTY COOLDOWN</h2>
          <p className="text-xs text-rose-300/80 max-w-sm mb-4">
            A window focus loss breach was recorded to the SQLite persistence log. Editor is temporarily locked.
          </p>
          <div className="text-2xl font-mono font-bold text-rose-400 bg-rose-900/40 px-4 py-2 rounded border border-rose-800">
            {lockPenaltySeconds}s REMAINING
          </div>
        </div>
      )}

      {/* Monaco Editor Canvas */}
      <div className="flex-1 w-full overflow-hidden">
        <Editor
          height="100%"
          language={monacoLanguage}
          value={code}
          onChange={(val) => setCode(val || '')}
          onMount={handleEditorDidMount}
          theme="vs-dark"
          options={{
            fontSize: 13,
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace",
            minimap: { enabled: false },
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 4,
            bracketPairColorization: { enabled: true },
            padding: { top: 12, bottom: 12 },
            readOnly: isLocked,
          }}
        />
      </div>
    </div>
  );
};
