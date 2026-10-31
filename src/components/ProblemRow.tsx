import React, { useState } from 'react';
import { ProblemListItem } from '../types';
import { CheckCircle2, CircleDot, Circle, Star, ArrowRight, Cpu, HardDrive, Eye, RotateCcw } from 'lucide-react';

interface ProblemRowProps {
  problem: ProblemListItem;
  isSelected: boolean;
  hideSpoilerTags: boolean;
  onSelect: () => void;
  onOpen: () => void;
  onToggleBookmark: (e: React.MouseEvent) => void;
  onToggleRedo?: (e: React.MouseEvent) => void;
}

export const ProblemRow: React.FC<ProblemRowProps> = ({
  problem,
  isSelected,
  hideSpoilerTags,
  onSelect,
  onOpen,
  onToggleBookmark,
  onToggleRedo,
}) => {
  const [spoilerRevealed, setSpoilerRevealed] = useState<boolean>(false);

  const getDifficultyBadge = (diff: string) => {
    switch (diff.toLowerCase()) {
      case 'easy':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'medium':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'hard':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      default:
        return 'bg-zen-800 text-zen-400 border-zen-700';
    }
  };

  const renderStatusIcon = () => {
    if (problem.is_redo) {
      return (
        <span title="Marked for Redo">
          <RotateCcw className="w-4 h-4 text-orange-400 shrink-0" />
        </span>
      );
    }
    switch (problem.status) {
      case 'solved':
        return (
          <span title="Solved">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          </span>
        );
      case 'attempted':
        return (
          <span title="Attempted">
            <CircleDot className="w-4 h-4 text-amber-400 shrink-0" />
          </span>
        );
      case 'unsolved':
      default:
        return (
          <span title="Unsolved">
            <Circle className="w-4 h-4 text-zen-600 shrink-0" />
          </span>
        );
    }
  };

  const showTags = !hideSpoilerTags || spoilerRevealed;

  return (
    <div
      onClick={onSelect}
      onDoubleClick={onOpen}
      className={`group px-4 py-3 flex items-center justify-between border-b border-zen-800/80 transition-all cursor-pointer select-none ${
        isSelected
          ? 'bg-zen-800/90 border-l-2 border-l-sky-500 shadow-sm'
          : 'bg-zen-900/60 hover:bg-zen-850/80'
      }`}
    >
      {/* Left: Status, Bookmark, Redo, Title, Tags */}
      <div className="flex items-center space-x-2.5 min-w-0 flex-1">
        {/* Status Icon */}
        <div className="flex items-center justify-center w-5">
          {renderStatusIcon()}
        </div>

        {/* Bookmark star */}
        <button
          onClick={onToggleBookmark}
          className={`p-1 rounded hover:bg-zen-750 transition-colors ${
            problem.is_bookmarked
              ? 'text-amber-400 fill-amber-400'
              : 'text-zen-600 hover:text-zen-400'
          }`}
          title={problem.is_bookmarked ? 'Remove bookmark' : 'Bookmark problem'}
        >
          <Star className={`w-3.5 h-3.5 ${problem.is_bookmarked ? 'fill-amber-400' : ''}`} />
        </button>

        {/* Mark for Redo toggle */}
        {onToggleRedo && (
          <button
            onClick={onToggleRedo}
            className={`p-1 rounded hover:bg-zen-750 transition-colors ${
              problem.is_redo
                ? 'text-orange-400'
                : 'text-zen-600 hover:text-zen-400'
            }`}
            title={problem.is_redo ? 'Remove from Redo list' : 'Mark for Redo'}
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Title & Limits */}
        <div className="min-w-0 flex-1 pr-4">
          <div className="flex items-center space-x-2">
            <span
              onClick={(e) => {
                e.stopPropagation();
                onOpen();
              }}
              className="text-xs font-semibold text-zen-100 group-hover:text-sky-300 transition-colors truncate hover:underline"
            >
              {problem.title}
            </span>
          </div>

          {/* Tags row with Spoiler Mask */}
          <div className="flex flex-wrap items-center gap-1.5 mt-1">
            {showTags ? (
              <>
                {problem.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zen-850 text-zen-400 border border-zen-750"
                  >
                    #{tag}
                  </span>
                ))}
                {problem.tags.length > 3 && (
                  <span className="text-[10px] text-zen-500 font-mono">
                    +{problem.tags.length - 3}
                  </span>
                )}
              </>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSpoilerRevealed(true);
                }}
                className="text-[10px] font-mono text-zen-500 hover:text-zen-300 flex items-center space-x-1 px-1.5 py-0.2 rounded bg-zen-950/60 border border-zen-800 hover:border-zen-700 transition-colors"
                title="Click to reveal spoiler tags"
              >
                <Eye className="w-2.5 h-2.5 mr-0.5" />
                <span>Show tags</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Middle & Right: Difficulty, Limits, Best Time, Actions */}
      <div className="flex items-center space-x-6 text-xs text-zen-400 shrink-0">
        {/* Resource Limits */}
        <div className="hidden md:flex items-center space-x-3 text-[11px] text-zen-500 font-mono">
          <span className="flex items-center">
            <Cpu className="w-3 h-3 mr-1 text-sky-400/70" />
            {problem.time_limit_ms}ms
          </span>
          <span className="flex items-center">
            <HardDrive className="w-3 h-3 mr-1 text-purple-400/70" />
            {problem.memory_limit_mb}MB
          </span>
        </div>

        {/* Difficulty Badge */}
        <span
          className={`w-16 text-center text-[11px] font-medium px-2 py-0.5 rounded border ${getDifficultyBadge(
            problem.difficulty
          )}`}
        >
          {problem.difficulty}
        </span>

        {/* Personal Best Runtime */}
        <div className="w-20 text-right font-mono text-[11px]">
          {problem.best_runtime_ms !== null ? (
            <span className="text-emerald-400 font-semibold">
              {problem.best_runtime_ms} ms
            </span>
          ) : (
            <span className="text-zen-600">—</span>
          )}
        </div>

        {/* Submissions Count */}
        <div className="w-12 text-right font-mono text-[11px] text-zen-500 hidden sm:block">
          {problem.total_submissions > 0 ? (
            <span>{problem.total_submissions} sub</span>
          ) : (
            <span>0</span>
          )}
        </div>

        {/* Solve Button / Quick Action */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
          className={`px-3 py-1 rounded text-[11px] font-semibold flex items-center space-x-1 transition-all ${
            isSelected
              ? 'bg-sky-600 hover:bg-sky-500 text-white shadow-sm'
              : 'bg-zen-800 text-zen-300 hover:text-white hover:bg-zen-700 border border-zen-700/60'
          }`}
        >
          <span>Solve</span>
          <ArrowRight className="w-3 h-3 ml-0.5" />
        </button>
      </div>
    </div>
  );
};
