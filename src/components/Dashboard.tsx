import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ProblemListItem, UserProgress, LockInStatus } from '../types';
import { ProblemRow } from './ProblemRow';
import {
  Terminal,
  WifiOff,
  Flame,
  CheckCircle2,
  HardDrive,
  Search,
  Filter,
  Shield,
  Upload,
  Settings,
  X,
  Keyboard,
  ArrowUpDown,
  BookMarked,
  RotateCcw,
  Eye,
  EyeOff,
  Table,
  Layers,
  CircleDot,
  Circle,
  Star,
  ArrowRight,
  Code2,
  Check,
} from 'lucide-react';

interface DashboardProps {
  problems: ProblemListItem[];
  userProgress: UserProgress | null;
  lockInStatus: LockInStatus;
  onOpenProblem: (slug: string) => void;
  onToggleLockIn: () => void;
  onToggleBookmark: (slug: string) => void;
  onToggleRedo?: (slug: string) => void;
  onRefresh: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  problems,
  userProgress,
  lockInStatus,
  onOpenProblem,
  onToggleLockIn,
  onToggleBookmark,
  onToggleRedo,
  onRefresh,
}) => {
  const [viewMode, setViewMode] = useState<'table' | 'roadmaps'>(() => {
    return (localStorage.getItem('zenjudge_view_mode') as 'table' | 'roadmaps') || 'table';
  });

  // Local persistent state for filters
  const [searchQuery, setSearchQuery] = useState<string>(() => {
    return localStorage.getItem('zenjudge_search') || '';
  });
  const [statusFilter, setStatusFilter] = useState<'all' | 'unsolved' | 'solved' | 'redo' | 'bookmarked'>(() => {
    return (localStorage.getItem('zenjudge_status_filter') as any) || 'all';
  });
  const [difficultyFilter, setDifficultyFilter] = useState<'all' | 'Easy' | 'Medium' | 'Hard'>(() => {
    return (localStorage.getItem('zenjudge_diff_filter') as any) || 'all';
  });
  const [hideSpoilerTags, setHideSpoilerTags] = useState<boolean>(() => {
    return localStorage.getItem('zenjudge_hide_spoilers') !== 'false';
  });
  const [selectedTags, setSelectedTags] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('zenjudge_tags_filter') || '[]');
    } catch {
      return [];
    }
  });

  // Custom Templates settings state
  const [customTemplateCpp, setCustomTemplateCpp] = useState<string>(() => {
    return localStorage.getItem('zenjudge_template_cpp') || '';
  });
  const [customTemplatePython, setCustomTemplatePython] = useState<string>(() => {
    return localStorage.getItem('zenjudge_template_python') || '';
  });
  const [activeTemplateTab, setActiveTemplateTab] = useState<'cpp' | 'python'>('cpp');
  const [isTemplateSaved, setIsTemplateSaved] = useState<boolean>(false);

  const [sortField, setSortField] = useState<'title' | 'difficulty' | 'best_runtime' | 'status'>('title');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Selected row index for keyboard navigation
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  // Modals
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Persist filters
  useEffect(() => {
    localStorage.setItem('zenjudge_search', searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    localStorage.setItem('zenjudge_status_filter', statusFilter);
  }, [statusFilter]);

  useEffect(() => {
    localStorage.setItem('zenjudge_diff_filter', difficultyFilter);
  }, [difficultyFilter]);

  useEffect(() => {
    localStorage.setItem('zenjudge_hide_spoilers', String(hideSpoilerTags));
  }, [hideSpoilerTags]);

  useEffect(() => {
    localStorage.setItem('zenjudge_tags_filter', JSON.stringify(selectedTags));
  }, [selectedTags]);

  useEffect(() => {
    localStorage.setItem('zenjudge_view_mode', viewMode);
  }, [viewMode]);

  // Aggregate all unique tags from problems
  const availableTags = useMemo(() => {
    const tagCounts = new Map<string, number>();
    for (const p of problems) {
      for (const t of p.tags) {
        tagCounts.set(t, (tagCounts.get(t) || 0) + 1);
      }
    }
    return Array.from(tagCounts.entries()).sort((a, b) => b[1] - a[1]);
  }, [problems]);

  // Filter and sort problems
  const filteredProblems = useMemo(() => {
    return problems
      .filter((p) => {
        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchTitle = p.title.toLowerCase().includes(q);
          const matchSlug = p.slug.toLowerCase().includes(q);
          const matchTag = p.tags.some((t) => t.toLowerCase().includes(q));
          if (!matchTitle && !matchSlug && !matchTag) return false;
        }

        // Status
        if (statusFilter === 'solved' && p.status !== 'solved') return false;
        if (statusFilter === 'unsolved' && p.status === 'solved') return false;
        if (statusFilter === 'redo' && !p.is_redo) return false;
        if (statusFilter === 'bookmarked' && !p.is_bookmarked) return false;

        // Difficulty
        if (difficultyFilter !== 'all' && p.difficulty.toLowerCase() !== difficultyFilter.toLowerCase()) {
          return false;
        }

        // Tags checklist (AND logic)
        if (selectedTags.length > 0) {
          const hasAllTags = selectedTags.every((t) => p.tags.includes(t));
          if (!hasAllTags) return false;
        }

        return true;
      })
      .sort((a, b) => {
        let cmp = 0;
        if (sortField === 'title') {
          cmp = a.title.localeCompare(b.title);
        } else if (sortField === 'difficulty') {
          const diffWeight: Record<string, number> = { easy: 1, medium: 2, hard: 3 };
          const wa = diffWeight[a.difficulty.toLowerCase()] || 0;
          const wb = diffWeight[b.difficulty.toLowerCase()] || 0;
          cmp = wa - wb;
        } else if (sortField === 'best_runtime') {
          const ra = a.best_runtime_ms ?? 99999999;
          const rb = b.best_runtime_ms ?? 99999999;
          cmp = ra - rb;
        } else if (sortField === 'status') {
          cmp = a.status.localeCompare(b.status);
        }
        return sortOrder === 'asc' ? cmp : -cmp;
      });
  }, [problems, searchQuery, statusFilter, difficultyFilter, selectedTags, sortField, sortOrder]);

  // Group problems into Study Tracks / Roadmaps
  const roadmapTracks = useMemo(() => {
    const trackDefs = [
      {
        id: 'arrays-hashing',
        title: 'Arrays & Hashing',
        description: 'Frequencies, prefix sums, hash maps, two sum lookups.',
        match: ['array', 'hash table', 'hash-table', 'sorting', 'prefix sum', 'matrix'],
      },
      {
        id: 'two-pointers',
        title: 'Two Pointers & Sliding Window',
        description: 'Opposite-end convergence, fast & slow runners, window bounds.',
        match: ['two pointers', 'two-pointers', 'sliding window', 'string'],
      },
      {
        id: 'stack-queue',
        title: 'Stack & Monotonic Queue',
        description: 'LIFO parsing, parenthetical syntax, next greater elements.',
        match: ['stack', 'queue', 'monotonic stack'],
      },
      {
        id: 'binary-search',
        title: 'Binary Search',
        description: 'Logarithmic search space halving and monotonic predicates.',
        match: ['binary search', 'binary-search'],
      },
      {
        id: 'linked-list',
        title: 'Linked List',
        description: 'Pointer re-wiring, fast/slow cycles, reversals.',
        match: ['linked list', 'linked-list'],
      },
      {
        id: 'trees-graphs',
        title: 'Trees & Graphs',
        description: 'Recursive divide & conquer, BFS/DFS, shortest paths.',
        match: ['tree', 'binary tree', 'graph', 'bfs', 'dfs', 'trie'],
      },
      {
        id: 'dp',
        title: 'Dynamic Programming',
        description: 'Overlapping subproblems, state recurrence, memoization.',
        match: ['dynamic programming', 'dynamic-programming', 'memoization'],
      },
      {
        id: 'greedy-math',
        title: 'Greedy & Math / Advanced',
        description: 'Locally optimal invariants, bitwise math, combinatorics.',
        match: ['greedy', 'math', 'bit manipulation', 'backtracking'],
      },
    ];

    const tracks = trackDefs.map((def) => {
      const trackProblems = problems.filter((p) =>
        p.tags.some((t) => def.match.some((m) => t.toLowerCase().includes(m)))
      );
      const solvedCount = trackProblems.filter((p) => p.status === 'solved').length;
      return {
        ...def,
        problems: trackProblems,
        solvedCount,
      };
    });

    // Capture unassigned
    const assignedSlugs = new Set(tracks.flatMap((t) => t.problems.map((p) => p.slug)));
    const unassigned = problems.filter((p) => !assignedSlugs.has(p.slug));
    if (unassigned.length > 0) {
      tracks.push({
        id: 'general',
        title: 'General Algorithmic Problems',
        description: 'Foundational problem solving and offline benchmarks.',
        match: [],
        problems: unassigned,
        solvedCount: unassigned.filter((p) => p.status === 'solved').length,
      });
    }

    return tracks.filter((t) => t.problems.length > 0);
  }, [problems]);

  // Reset selected index when filtered list changes
  useEffect(() => {
    if (selectedIndex >= filteredProblems.length) {
      setSelectedIndex(Math.max(0, filteredProblems.length - 1));
    }
  }, [filteredProblems.length, selectedIndex]);

  // Global Keyboard Navigation (Ctrl+K, ArrowUp, ArrowDown, Enter)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Focus Search: Ctrl + K
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      // If typing inside an input/textarea and not using arrows/enter, do not capture
      const isInputActive = document.activeElement === searchInputRef.current;

      if (e.key === 'Escape') {
        if (isInputActive) {
          setSearchQuery('');
          searchInputRef.current?.blur();
        } else if (isImportModalOpen) {
          setIsImportModalOpen(false);
        } else if (isSettingsModalOpen) {
          setIsSettingsModalOpen(false);
        }
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev < filteredProblems.length - 1 ? prev + 1 : prev));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
      } else if (e.key === 'Enter') {
        if (filteredProblems.length > 0 && selectedIndex < filteredProblems.length) {
          e.preventDefault();
          onOpenProblem(filteredProblems[selectedIndex].slug);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredProblems, selectedIndex, onOpenProblem, isImportModalOpen, isSettingsModalOpen]);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSort = (field: 'title' | 'difficulty' | 'best_runtime' | 'status') => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const resetAllFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setDifficultyFilter('all');
    setSelectedTags([]);
  };

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    statusFilter !== 'all' ||
    difficultyFilter !== 'all' ||
    selectedTags.length > 0;

  return (
    <div className="h-screen w-screen flex flex-col bg-zen-950 text-zen-100 select-none overflow-hidden font-sans">
      {/* 1. TOP NAVIGATION BAR */}
      <header className="h-14 bg-zen-900 border-b border-zen-800 px-5 flex items-center justify-between shrink-0 shadow-sm">
        {/* Left: Branding & Tagline */}
        <div className="flex items-center space-x-3.5">
          <div className="w-8 h-8 rounded-lg bg-sky-600/20 border border-sky-500/40 flex items-center justify-center text-sky-400 font-bold text-sm shadow-inner">
            <Terminal className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-sm tracking-wider text-white">ZENJUDGE</span>
              <span className="text-[10px] font-semibold font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center">
                <WifiOff className="w-2.5 h-2.5 mr-1" /> OFFLINE
              </span>
              <span className="text-[10px] font-mono text-zen-500 hidden sm:inline">v0.1-local</span>
            </div>
          </div>
        </div>

        {/* Center: Global Stats Pill */}
        {userProgress && (
          <div className="hidden lg:flex items-center space-x-4 bg-zen-950 px-4 py-1.5 rounded-full border border-zen-800 text-xs">
            <div className="flex items-center space-x-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-zen-400">Solved:</span>
              <span className="font-mono font-bold text-white">
                {userProgress.solved_count} / {userProgress.total_problems}
              </span>
            </div>

            <div className="w-px h-3.5 bg-zen-800" />

            <div className="flex items-center space-x-1.5">
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-zen-400">Streak:</span>
              <span className="font-mono font-bold text-amber-300">
                {userProgress.current_streak_days}d
              </span>
            </div>

            <div className="w-px h-3.5 bg-zen-800" />

            <div className="flex items-center space-x-1.5 text-zen-400">
              <HardDrive className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-[11px] font-mono">SQLite Embedded</span>
            </div>
          </div>
        )}

        {/* Center-Right: View Mode & Spoiler Protection Toggle */}
        <div className="flex items-center space-x-2">
          {/* View Mode Switcher */}
          <div className="flex items-center bg-zen-950 p-1 rounded-lg border border-zen-800 text-xs">
            <button
              onClick={() => setViewMode('table')}
              className={`px-2.5 py-1 rounded font-semibold flex items-center space-x-1.5 transition-all ${
                viewMode === 'table'
                  ? 'bg-zen-800 text-white shadow-sm'
                  : 'text-zen-400 hover:text-zen-200'
              }`}
            >
              <Table className="w-3.5 h-3.5 text-sky-400" />
              <span>Table</span>
            </button>
            <button
              onClick={() => setViewMode('roadmaps')}
              className={`px-2.5 py-1 rounded font-semibold flex items-center space-x-1.5 transition-all ${
                viewMode === 'roadmaps'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-zen-400 hover:text-zen-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-sky-200" />
              <span>Roadmaps</span>
            </button>
          </div>

          {/* Spoiler Protection Toggle Button */}
          <button
            onClick={() => setHideSpoilerTags(!hideSpoilerTags)}
            className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              hideSpoilerTags
                ? 'bg-zen-850 hover:bg-zen-800 text-zen-300 border-zen-750'
                : 'bg-amber-950/40 text-amber-300 border-amber-600/60 shadow-sm'
            }`}
            title="Toggle algorithmic tag spoiler protection"
          >
            {hideSpoilerTags ? (
              <EyeOff className="w-3.5 h-3.5 text-zen-400" />
            ) : (
              <Eye className="w-3.5 h-3.5 text-amber-400" />
            )}
            <span className="hidden sm:inline">
              {hideSpoilerTags ? 'Hide Spoilers' : 'Show Spoilers'}
            </span>
          </button>
        </div>

        {/* Right: Quick Actions & Lock-In Button */}
        <div className="flex items-center space-x-2.5">
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-zen-850 hover:bg-zen-800 text-zen-300 hover:text-white border border-zen-750 transition-all"
            title="Import problem bundle"
          >
            <Upload className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden md:inline">Import Problem</span>
          </button>

          <button
            onClick={() => setIsSettingsModalOpen(true)}
            className="p-2 rounded-lg text-zen-400 hover:text-white bg-zen-850 hover:bg-zen-800 border border-zen-750 transition-all"
            title="Settings & Diagnostics"
          >
            <Settings className="w-4 h-4" />
          </button>

          <button
            onClick={onToggleLockIn}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all border shadow-sm ${
              lockInStatus.is_active
                ? 'bg-rose-950/80 text-rose-200 border-rose-600 hover:bg-rose-900/90'
                : 'bg-zen-800 text-zen-200 border-zen-700 hover:border-sky-500 hover:text-white'
            }`}
          >
            <Shield className={`w-3.5 h-3.5 ${lockInStatus.is_active ? 'text-rose-400 animate-pulse' : 'text-sky-400'}`} />
            <span>{lockInStatus.is_active ? 'LOCK-IN ARMED' : 'ENTER LOCK-IN'}</span>
          </button>
        </div>
      </header>

      {/* 2. MAIN CONTENT (Split View: Filter Sidebar + Problem Table) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: Filters & Algorithmic Tags */}
        <aside className="w-64 bg-zen-900 border-r border-zen-800 flex flex-col p-4 space-y-5 overflow-y-auto shrink-0 select-none">
          {/* Search Box */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-semibold text-zen-400 uppercase tracking-wider">
              <span>Search Problems</span>
              <span className="font-mono text-[10px] bg-zen-800 px-1 rounded text-zen-400 border border-zen-700">
                Ctrl+K
              </span>
            </div>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zen-500" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Title, slug, or #tag..."
                className="w-full bg-zen-950 border border-zen-750 rounded-lg pl-8 pr-7 py-1.5 text-xs text-white placeholder-zen-500 focus:outline-none focus:border-sky-500 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-zen-500 hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Status Filter */}
          <div className="space-y-1.5">
            <div className="text-[11px] font-semibold text-zen-400 uppercase tracking-wider">Status</div>
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              {(['all', 'unsolved', 'solved', 'redo', 'bookmarked'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1.5 rounded-lg text-left capitalize font-medium transition-all flex items-center justify-between border ${
                    statusFilter === st
                      ? 'bg-sky-600/20 text-sky-300 border-sky-500/50 shadow-sm'
                      : 'bg-zen-950 text-zen-400 border-zen-800 hover:border-zen-700 hover:text-zen-200'
                  }`}
                >
                  <span>{st === 'redo' ? 'Redo' : st}</span>
                  {st === 'bookmarked' && <BookMarked className="w-3 h-3 text-amber-400/80" />}
                  {st === 'redo' && <RotateCcw className="w-3 h-3 text-orange-400" />}
                </button>
              ))}
            </div>
          </div>

          {/* Difficulty Filter */}
          <div className="space-y-1.5">
            <div className="text-[11px] font-semibold text-zen-400 uppercase tracking-wider">Difficulty</div>
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              {(['all', 'Easy', 'Medium', 'Hard'] as const).map((diff) => (
                <button
                  key={diff}
                  onClick={() => setDifficultyFilter(diff)}
                  className={`px-2.5 py-1.5 rounded-lg text-left font-medium transition-all border ${
                    difficultyFilter === diff
                      ? 'bg-sky-600/20 text-sky-300 border-sky-500/50 shadow-sm'
                      : 'bg-zen-950 text-zen-400 border-zen-800 hover:border-zen-700 hover:text-zen-200'
                  }`}
                >
                  {diff}
                </button>
              ))}
            </div>
          </div>

          {/* Algorithmic Tags Checklist */}
          <div className="space-y-1.5 flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between text-[11px] font-semibold text-zen-400 uppercase tracking-wider">
              <span>Algorithmic Tags</span>
              {selectedTags.length > 0 && (
                <span className="text-[10px] text-sky-400 font-mono">
                  {selectedTags.length} active
                </span>
              )}
            </div>
            <div className="bg-zen-950 border border-zen-800 rounded-lg p-2 overflow-y-auto space-y-1 max-h-48 flex-1">
              {availableTags.map(([tag, count]) => {
                const isChecked = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`w-full flex items-center justify-between px-2 py-1 rounded text-xs transition-colors font-mono ${
                      isChecked
                        ? 'bg-sky-950/60 text-sky-300 font-semibold'
                        : 'text-zen-400 hover:text-zen-200 hover:bg-zen-900'
                    }`}
                  >
                    <span className="truncate">#{tag}</span>
                    <span className="text-[10px] text-zen-500 ml-1">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <button
              onClick={resetAllFilters}
              className="w-full flex items-center justify-center space-x-1.5 py-1.5 rounded-lg text-xs text-zen-400 hover:text-white bg-zen-800 hover:bg-zen-750 border border-zen-700 transition-all font-medium"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset All Filters</span>
            </button>
          )}
        </aside>

        {/* Right Area: Problem Table / List or Roadmaps */}
        <main className="flex-1 flex flex-col overflow-hidden bg-zen-950">
          {viewMode === 'roadmaps' ? (
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-zen-900 border border-zen-800 rounded-xl p-4 shadow-sm">
                <div>
                  <h2 className="text-base font-bold text-white tracking-wide flex items-center space-x-2">
                    <Layers className="w-4 h-4 text-sky-400" />
                    <span>Curated Study Tracks & Algorithmic Roadmaps</span>
                  </h2>
                  <p className="text-xs text-zen-400 mt-0.5">
                    Master key coding patterns systematically from Arrays & Two Pointers to Dynamic Programming.
                  </p>
                </div>
                <div className="flex items-center space-x-3 text-xs">
                  <div className="text-xs font-mono text-zen-300 bg-zen-950 px-3 py-1.5 rounded-lg border border-zen-800">
                    <strong className="text-white">{roadmapTracks.length}</strong> Study Tracks Active
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {roadmapTracks.map((track) => {
                  const pct = Math.round((track.solvedCount / track.problems.length) * 100) || 0;
                  return (
                    <div
                      key={track.id}
                      className="bg-zen-900 border border-zen-800 hover:border-zen-750 rounded-xl p-4 space-y-3.5 transition-all shadow-sm"
                    >
                      <div className="flex items-center justify-between border-b border-zen-800/80 pb-2.5">
                        <div>
                          <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                            <span>{track.title}</span>
                          </h3>
                          <p className="text-[11px] text-zen-400 mt-0.5">{track.description}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-mono font-bold text-emerald-400">
                            {track.solvedCount} / {track.problems.length}
                          </span>
                          <span className="text-[10px] text-zen-500 font-mono ml-1">({pct}%)</span>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full bg-zen-950 h-1.5 rounded-full overflow-hidden border border-zen-850">
                        <div
                          className="bg-gradient-to-r from-sky-500 to-emerald-400 h-full rounded-full transition-all duration-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>

                      {/* Problems in this Track */}
                      <div className="space-y-1.5">
                        {track.problems.map((prob) => {
                          const getDiffBadge = (d: string) => {
                            if (d.toLowerCase() === 'easy') return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
                            if (d.toLowerCase() === 'medium') return 'text-amber-400 border-amber-500/30 bg-amber-500/10';
                            return 'text-rose-400 border-rose-500/30 bg-rose-500/10';
                          };

                          return (
                            <div
                              key={prob.slug}
                              onClick={() => onOpenProblem(prob.slug)}
                              className="flex items-center justify-between px-3 py-2 rounded-lg bg-zen-950 hover:bg-zen-850 border border-zen-850 hover:border-zen-700 transition-all cursor-pointer group"
                            >
                              <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                                {prob.is_redo ? (
                                  <span title="Marked for Redo">
                                    <RotateCcw className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                                  </span>
                                ) : prob.status === 'solved' ? (
                                  <span title="Solved">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                  </span>
                                ) : prob.status === 'attempted' ? (
                                  <span title="Attempted">
                                    <CircleDot className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                  </span>
                                ) : (
                                  <span title="Unsolved">
                                    <Circle className="w-3.5 h-3.5 text-zen-600 shrink-0" />
                                  </span>
                                )}

                                <span className="text-xs font-semibold text-zen-200 group-hover:text-sky-300 transition-colors truncate">
                                  {prob.title}
                                </span>
                              </div>

                              <div className="flex items-center space-x-3 text-xs shrink-0 font-mono">
                                <span className={`px-1.5 py-0.2 rounded border text-[10px] ${getDiffBadge(prob.difficulty)}`}>
                                  {prob.difficulty}
                                </span>

                                {prob.best_runtime_ms !== null ? (
                                  <span className="text-emerald-400 text-[10px] hidden sm:inline">
                                    {prob.best_runtime_ms}ms
                                  </span>
                                ) : (
                                  <span className="text-zen-600 text-[10px] hidden sm:inline">—</span>
                                )}

                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onOpenProblem(prob.slug);
                                  }}
                                  className="px-2.5 py-1 rounded text-[11px] font-semibold bg-zen-800 group-hover:bg-sky-600 text-zen-300 group-hover:text-white transition-all flex items-center space-x-0.5"
                                >
                                  <span>Solve</span>
                                  <ArrowRight className="w-3 h-3 ml-0.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <>
              {/* Table Header Bar */}
              <div className="h-10 bg-zen-900/90 border-b border-zen-800 px-4 flex items-center justify-between text-[11px] font-semibold text-zen-400 uppercase tracking-wider shrink-0 select-none">
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  <span className="w-5 text-center">St</span>
                  <span className="w-4"></span>
                  <button
                    onClick={() => handleSort('title')}
                    className="flex items-center space-x-1 hover:text-white transition-colors"
                  >
                    <span>Problem Title</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </div>

                <div className="flex items-center space-x-6 shrink-0">
                  <span className="hidden md:inline w-28 text-left">Limits (CPU/RAM)</span>
                  <button
                    onClick={() => handleSort('difficulty')}
                    className="w-16 text-center hover:text-white transition-colors flex items-center justify-center space-x-0.5"
                  >
                    <span>Diff</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => handleSort('best_runtime')}
                    className="w-20 text-right hover:text-white transition-colors flex items-center justify-end space-x-0.5"
                  >
                    <span>Best Time</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                  <span className="w-12 text-right hidden sm:inline">Subs</span>
                  <span className="w-16 text-center">Action</span>
                </div>
              </div>

              {/* Problem List Items */}
              <div className="flex-1 overflow-y-auto">
                {filteredProblems.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 text-zen-500 space-y-2">
                    <Search className="w-10 h-10 opacity-40 mb-1" />
                    <p className="text-sm font-semibold text-zen-400">No matching algorithmic problems</p>
                    <p className="text-xs text-zen-600 max-w-sm">
                      Try adjusting your search criteria, clearing tag filters, or import a new problem suite.
                    </p>
                    {hasActiveFilters && (
                      <button
                        onClick={resetAllFilters}
                        className="mt-2 px-3 py-1.5 rounded text-xs bg-zen-800 hover:bg-zen-750 text-zen-200 border border-zen-700"
                      >
                        Clear Filters
                      </button>
                    )}
                  </div>
                ) : (
                  <div>
                    {filteredProblems.map((prob, idx) => (
                      <ProblemRow
                        key={prob.slug}
                        problem={prob}
                        isSelected={selectedIndex === idx}
                        hideSpoilerTags={hideSpoilerTags}
                        onSelect={() => setSelectedIndex(idx)}
                        onOpen={() => onOpenProblem(prob.slug)}
                        onToggleBookmark={(e) => {
                          e.stopPropagation();
                          onToggleBookmark(prob.slug);
                        }}
                        onToggleRedo={(e) => {
                          e.stopPropagation();
                          onToggleRedo?.(prob.slug);
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Table Footer Status & Hotkey Hint Bar */}
          <footer className="h-9 bg-zen-900 border-t border-zen-800 px-4 flex items-center justify-between text-xs text-zen-500 shrink-0">
            <div className="flex items-center space-x-2">
              <span>
                Showing <strong className="text-zen-200">{filteredProblems.length}</strong> of{' '}
                <strong className="text-zen-200">{problems.length}</strong> problems
              </span>
            </div>

            <div className="hidden sm:flex items-center space-x-3 text-[11px] font-mono text-zen-400">
              <span className="flex items-center space-x-1">
                <kbd className="bg-zen-800 px-1 py-0.2 rounded border border-zen-700">↑</kbd>
                <kbd className="bg-zen-800 px-1 py-0.2 rounded border border-zen-700">↓</kbd>
                <span className="text-zen-500">Navigate</span>
              </span>
              <span className="flex items-center space-x-1">
                <kbd className="bg-zen-800 px-1.5 py-0.2 rounded border border-zen-700">Enter</kbd>
                <span className="text-zen-500">Open Workspace</span>
              </span>
              <span className="flex items-center space-x-1">
                <kbd className="bg-zen-800 px-1.5 py-0.2 rounded border border-zen-700">Ctrl+K</kbd>
                <span className="text-zen-500">Search</span>
              </span>
            </div>
          </footer>
        </main>
      </div>

      {/* Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zen-900 border border-zen-750 rounded-xl max-w-md w-full p-6 shadow-2xl relative space-y-4">
            <button
              onClick={() => setIsImportModalOpen(false)}
              className="absolute top-4 right-4 text-zen-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg bg-sky-600/20 border border-sky-500/40 flex items-center justify-center text-sky-400">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Import Problem Directory</h3>
                <p className="text-xs text-zen-400">Add local algorithmic problem bundles</p>
              </div>
            </div>

            <div className="bg-zen-950 p-4 rounded-lg border border-zen-800 space-y-2 text-xs text-zen-300">
              <p>Place problem directories inside the local <code>problems/</code> folder:</p>
              <pre className="p-2.5 bg-zen-900 rounded font-mono text-[11px] text-sky-300 overflow-x-auto">
{`problems/
└── [problem-slug]/
    ├── statement.md
    ├── meta.json
    └── testcases.bin (or testcases.json)`}
              </pre>
              <p className="text-[11px] text-zen-500 pt-1">
                ZenJudge continuously monitors and loads problem bundles on startup or refresh.
              </p>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => {
                  onRefresh();
                  setIsImportModalOpen(false);
                }}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white shadow-sm"
              >
                Scan & Reload Problems
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {isSettingsModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zen-900 border border-zen-750 rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative space-y-5 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsSettingsModalOpen(false)}
              className="absolute top-4 right-4 text-zen-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-400">
                <Settings className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">ZenJudge Settings & Templates</h3>
                <p className="text-xs text-zen-400">Configure personal starter templates & local runtime policies</p>
              </div>
            </div>

            {/* Custom Starter Templates Editor */}
            <div className="bg-zen-950 p-4 rounded-xl border border-zen-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Code2 className="w-4 h-4 text-sky-400" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Custom Default Starter Templates
                  </span>
                </div>
                <div className="flex items-center space-x-1 bg-zen-900 p-0.5 rounded-lg border border-zen-800 text-xs">
                  <button
                    onClick={() => setActiveTemplateTab('cpp')}
                    className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                      activeTemplateTab === 'cpp'
                        ? 'bg-sky-600 text-white shadow-sm'
                        : 'text-zen-400 hover:text-zen-200'
                    }`}
                  >
                    C++20
                  </button>
                  <button
                    onClick={() => setActiveTemplateTab('python')}
                    className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                      activeTemplateTab === 'python'
                        ? 'bg-sky-600 text-white shadow-sm'
                        : 'text-zen-400 hover:text-zen-200'
                    }`}
                  >
                    Python 3.12+
                  </button>
                </div>
              </div>

              <p className="text-[11px] text-zen-400">
                When specified, new problems and the editor's <code>Reset</code> button load your personal template. Leave empty to use ZenJudge's problem default.
              </p>

              {activeTemplateTab === 'cpp' ? (
                <textarea
                  value={customTemplateCpp}
                  onChange={(e) => {
                    setCustomTemplateCpp(e.target.value);
                    setIsTemplateSaved(false);
                  }}
                  placeholder={`// Enter custom default C++ starter template here...\n#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    ios_base::sync_with_stdio(false);\n    cin.tie(NULL);\n    return 0;\n}`}
                  rows={6}
                  className="w-full bg-zen-900 border border-zen-750 rounded-lg p-2.5 font-mono text-xs text-zen-100 placeholder-zen-600 focus:outline-none focus:border-sky-500 leading-relaxed"
                />
              ) : (
                <textarea
                  value={customTemplatePython}
                  onChange={(e) => {
                    setCustomTemplatePython(e.target.value);
                    setIsTemplateSaved(false);
                  }}
                  placeholder={`# Enter custom default Python starter template here...\nimport sys\n\ndef main():\n    input = sys.stdin.read\n    pass\n\nif __name__ == '__main__':\n    main()`}
                  rows={6}
                  className="w-full bg-zen-900 border border-zen-750 rounded-lg p-2.5 font-mono text-xs text-zen-100 placeholder-zen-600 focus:outline-none focus:border-sky-500 leading-relaxed"
                />
              )}

              <div className="flex items-center justify-between pt-1">
                <button
                  onClick={() => {
                    if (activeTemplateTab === 'cpp') {
                      setCustomTemplateCpp('');
                      localStorage.removeItem('zenjudge_template_cpp');
                    } else {
                      setCustomTemplatePython('');
                      localStorage.removeItem('zenjudge_template_python');
                    }
                    setIsTemplateSaved(true);
                    setTimeout(() => setIsTemplateSaved(false), 2000);
                  }}
                  className="text-xs text-zen-500 hover:text-zen-300 underline"
                >
                  Clear {activeTemplateTab.toUpperCase()} Template
                </button>

                <div className="flex items-center space-x-2">
                  {isTemplateSaved && (
                    <span className="text-xs text-emerald-400 flex items-center font-semibold">
                      <Check className="w-3.5 h-3.5 mr-1" />
                      Saved!
                    </span>
                  )}
                  <button
                    onClick={() => {
                      localStorage.setItem('zenjudge_template_cpp', customTemplateCpp);
                      localStorage.setItem('zenjudge_template_python', customTemplatePython);
                      setIsTemplateSaved(true);
                      setTimeout(() => setIsTemplateSaved(false), 2000);
                    }}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white shadow-sm flex items-center space-x-1"
                  >
                    <span>Save Starter Templates</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Offline Diagnostics info */}
            <div className="space-y-3 text-xs text-zen-300">
              <div className="bg-zen-950 p-3 rounded-xl border border-zen-800 space-y-1.5 font-mono text-[11px]">
                <div className="flex justify-between">
                  <span className="text-zen-500">Core Runtime:</span>
                  <span className="text-white">Tauri v2 + Rust</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zen-500">Editor Engine:</span>
                  <span className="text-sky-400">Monaco (Offline Workers)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zen-500">Code Execution:</span>
                  <span className="text-white">Disabled pending isolation</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zen-500">Local Database:</span>
                  <span className="text-purple-400">SQLite (zenjudge.db)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zen-500">Resources:</span>
                  <span className="text-emerald-400">Bundled for offline use</span>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-zen-400 uppercase">Emergency Abort Shortcut</span>
                <p className="text-[11px] text-zen-400">
                  Hold <kbd className="bg-zen-800 px-1 rounded text-white font-mono">Ctrl + Shift + Q</kbd> for 3 seconds anywhere during Lock-In mode to break fullscreen lockdown and register a forfeit.
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setIsSettingsModalOpen(false)}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-zen-800 hover:bg-zen-750 text-white border border-zen-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
