import React from 'react';
import { ProblemListItem, ProblemMeta, LockInStatus } from '../types';
import { Shield, ShieldAlert, Cpu, HardDrive, WifiOff, Terminal, BookOpen, AlertTriangle, ArrowLeft } from 'lucide-react';

interface HeaderProps {
  problems: ProblemListItem[] | ProblemMeta[];
  currentSlug: string;
  onSelectProblem: (slug: string) => void;
  currentMeta?: ProblemMeta;
  lockInStatus: LockInStatus;
  onToggleLockIn: () => void;
  activeTab: 'problem' | 'submissions' | 'breaches';
  setActiveTab: (tab: 'problem' | 'submissions' | 'breaches') => void;
  onBackToDashboard?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  problems,
  currentSlug,
  onSelectProblem,
  currentMeta,
  lockInStatus,
  onToggleLockIn,
  activeTab,
  setActiveTab,
  onBackToDashboard,
}) => {
  const getDifficultyBadge = (diff?: string) => {
    switch (diff?.toLowerCase()) {
      case 'easy':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'medium':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'hard':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      default:
        return 'bg-zen-800 text-zen-300 border-zen-700';
    }
  };

  return (
    <header className="h-14 bg-zen-900 border-b border-zen-800 px-4 flex items-center justify-between select-none shrink-0 shadow-sm">
      {/* Left: Dashboard return & Branding & Problem selector */}
      <div className="flex items-center space-x-3">
        {onBackToDashboard && !lockInStatus.is_active && (
          <button
            onClick={onBackToDashboard}
            className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-zen-800 hover:bg-zen-750 text-zen-300 hover:text-white border border-zen-700 transition-all mr-1"
            title="Return to Problem Dashboard"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-sky-400" />
            <span>Dashboard</span>
          </button>
        )}

        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-sky-600/20 border border-sky-500/40 flex items-center justify-center text-sky-400 font-bold text-sm shadow-inner">
            <Terminal className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-sm text-white tracking-wide">ZENJUDGE</span>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                <WifiOff className="w-2.5 h-2.5 mr-1" /> OFFLINE
              </span>
            </div>
          </div>
        </div>

        <div className="h-5 w-px bg-zen-800 mx-2" />

        {/* Problem Selector */}
        <div className="flex items-center space-x-2">
          <select
            value={currentSlug}
            onChange={(e) => onSelectProblem(e.target.value)}
            disabled={lockInStatus.is_active}
            className={`bg-zen-850 text-xs text-white border border-zen-700 rounded px-2.5 py-1.5 focus:outline-none focus:border-sky-500 cursor-pointer ${
              lockInStatus.is_active ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {problems.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.title} ({p.difficulty})
              </option>
            ))}
          </select>

          {currentMeta && (
            <div className="flex items-center space-x-2">
              <span className={`text-[11px] px-2 py-0.5 rounded border font-medium ${getDifficultyBadge(currentMeta.difficulty)}`}>
                {currentMeta.difficulty}
              </span>
              <span className="flex items-center text-[11px] text-zen-400 bg-zen-850 px-2 py-0.5 rounded border border-zen-800">
                <Cpu className="w-3 h-3 mr-1 text-sky-400" />
                {currentMeta.time_limit_ms}ms
              </span>
              <span className="flex items-center text-[11px] text-zen-400 bg-zen-850 px-2 py-0.5 rounded border border-zen-800">
                <HardDrive className="w-3 h-3 mr-1 text-purple-400" />
                {currentMeta.memory_limit_mb}MB
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Middle: Navigation Tabs for left pane */}
      <div className="flex items-center bg-zen-950 p-0.5 rounded-lg border border-zen-800 text-xs">
        <button
          onClick={() => setActiveTab('problem')}
          className={`px-3 py-1 rounded-md transition-all font-medium flex items-center space-x-1.5 ${
            activeTab === 'problem'
              ? 'bg-zen-800 text-white shadow-sm'
              : 'text-zen-400 hover:text-zen-200'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Statement</span>
        </button>
        <button
          onClick={() => setActiveTab('submissions')}
          className={`px-3 py-1 rounded-md transition-all font-medium flex items-center space-x-1.5 ${
            activeTab === 'submissions'
              ? 'bg-zen-800 text-white shadow-sm'
              : 'text-zen-400 hover:text-zen-200'
          }`}
        >
          <Terminal className="w-3.5 h-3.5" />
          <span>Submissions</span>
        </button>
        <button
          onClick={() => setActiveTab('breaches')}
          className={`px-3 py-1 rounded-md transition-all font-medium flex items-center space-x-1.5 relative ${
            activeTab === 'breaches'
              ? 'bg-zen-800 text-white shadow-sm'
              : 'text-zen-400 hover:text-zen-200'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Breaches</span>
          {lockInStatus.strikes > 0 && (
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse ml-1" />
          )}
        </button>
      </div>

      {/* Right: Lock-In mode toggle & Strike badge */}
      <div className="flex items-center space-x-3">
        {lockInStatus.strikes > 0 && (
          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded border border-rose-500/40 bg-rose-500/10 text-rose-400 text-xs font-semibold animate-pulse">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>{lockInStatus.strikes} STRIKE{lockInStatus.strikes > 1 ? 'S' : ''}</span>
          </div>
        )}

        <button
          onClick={onToggleLockIn}
          className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border shadow-sm ${
            lockInStatus.is_active
              ? 'bg-rose-950/80 text-rose-200 border-rose-600 hover:bg-rose-900/90'
              : 'bg-zen-800 text-zen-200 border-zen-700 hover:border-sky-500 hover:text-white'
          }`}
          title={lockInStatus.is_active ? 'Hold Ctrl+Shift+Q for 3s to emergency abort' : 'Lockdown session'}
        >
          {lockInStatus.is_active ? (
            <>
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400 animate-bounce" />
              <span>LOCK-IN ACTIVE</span>
            </>
          ) : (
            <>
              <Shield className="w-3.5 h-3.5 text-sky-400" />
              <span>ENTER LOCK-IN</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
};
