import { useEffect, useRef, useState, useCallback, type MouseEvent } from 'react';
import {
  HardDrive, FolderOpen, File, BarChart3, Search,
  RefreshCw, X, ChevronRight, ChevronUp, Home, Download,
  AlertCircle, ArrowLeft, Folder, Trash2, ExternalLink,
  Filter, List, LayoutGrid, CalendarDays
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { toast } from 'sonner';
import { StartScreen } from '@/components/common/StartScreen';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { formatBytes, stripAnsi } from '@/utils/format';
import { usePersistentState } from '@/utils/persistentState';
import type { PageConfig } from '@/types';

type Stage = 'idle' | 'scanning' | 'results' | 'error';
type AnalyzeMode = 'disk' | 'home' | 'downloads' | 'custom';
type QuickAnalyzeMode = Exclude<AnalyzeMode, 'custom'>;
type ResultsViewMode = 'map' | 'list';
type EntrySortMode = 'size' | 'date';

interface AnalyzeEntry {
  name: string;
  path: string;
  size: number;
  is_dir: boolean;
  insight?: boolean;
  cleanable?: boolean;
  last_access?: string;
}

interface AnalyzeLargeFile {
  name: string;
  path: string;
  size: number;
}

interface FileActionItem {
  name: string;
  path: string;
  size: number;
  is_dir?: boolean;
}

interface ContextMenuState {
  x: number;
  y: number;
  item: FileActionItem;
}

interface AnalyzeResult {
  path: string;
  overview: boolean;
  entries: AnalyzeEntry[];
  large_files?: AnalyzeLargeFile[];
  total_size: number;
  total_files?: number;
}

interface TreemapItem extends AnalyzeEntry {
  color: string;
  percentage: number;
  isOther?: boolean;
}

interface TreemapRect extends TreemapItem {
  x: number;
  y: number;
  width: number;
  height: number;
}

const QUICK_PATHS: Array<{ mode: QuickAnalyzeMode; label: string; path: string; icon: LucideIcon }> = [
  { mode: 'disk', label: 'Entire Disk', path: '/', icon: HardDrive },
  { mode: 'home', label: 'Home Folder', path: '~', icon: Home },
  { mode: 'downloads', label: 'Downloads', path: '~/Downloads', icon: Download },
];

const ANALYZE_GLASS_CARD = 'bg-white/45 border border-white/55 shadow-[0_24px_80px_rgba(109,93,252,0.12),inset_0_1px_0_rgba(255,255,255,0.72)] backdrop-blur-2xl';
const TREEMAP_COLORS = [
  '#fb923c', '#0ea5e9', '#ef4444', '#3b82f6',
  '#a855f7', '#14b8a6', '#f59e0b', '#ec4899',
  '#22c55e', '#64748b', '#f97316', '#06b6d4',
];

function pathForAnalyzeMode(mode: AnalyzeMode, customPath: string) {
  if (mode === 'custom') return customPath.trim() || '/';
  return QUICK_PATHS.find((item) => item.mode === mode)?.path ?? '/';
}

function modeForPath(path: string): AnalyzeMode {
  return QUICK_PATHS.find((item) => item.path === path)?.mode ?? 'custom';
}

function sumSizes(items: Array<{ size: number }>) {
  return items.reduce((sum, item) => sum + Math.max(0, item.size), 0);
}

function buildTreemapItems(
  entries: AnalyzeEntry[],
  totalSize: number,
  resultPath: string,
  remainderTotal = totalSize,
): TreemapItem[] {
  const visibleEntries = entries.filter((entry) => entry.size > 0).slice(0, 12);
  const visibleSize = sumSizes(visibleEntries);
  const remainder = Math.max(0, remainderTotal - visibleSize);
  const items: TreemapItem[] = visibleEntries.map((entry, index) => ({
    ...entry,
    color: TREEMAP_COLORS[index % TREEMAP_COLORS.length],
    percentage: totalSize > 0 ? (entry.size / totalSize) * 100 : 0,
  }));

  if (remainder > totalSize * 0.01) {
    items.push({
      name: 'Other',
      path: `${resultPath.replace(/\/$/, '') || '/'}/...`,
      size: remainder,
      is_dir: false,
      color: '#64748b',
      percentage: totalSize > 0 ? (remainder / totalSize) * 100 : 0,
      isOther: true,
    });
  }

  return items;
}

function splitTreemapItems(items: TreemapItem[]) {
  const total = sumSizes(items);
  const half = total / 2;
  let splitIndex = 1;
  let leftSize = items[0]?.size ?? 0;

  while (splitIndex < items.length - 1) {
    const nextSize = items[splitIndex].size;
    if (Math.abs(half - (leftSize + nextSize)) > Math.abs(half - leftSize)) break;
    leftSize += nextSize;
    splitIndex += 1;
  }

  return [items.slice(0, splitIndex), items.slice(splitIndex)] as const;
}

function createTreemapLayout(
  items: TreemapItem[],
  x = 0,
  y = 0,
  width = 100,
  height = 100,
): TreemapRect[] {
  if (items.length === 0) return [];
  if (items.length === 1) return [{ ...items[0], x, y, width, height }];

  const [leftItems, rightItems] = splitTreemapItems(items);
  const total = sumSizes(items) || 1;
  const leftRatio = sumSizes(leftItems) / total;

  if (width >= height) {
    const leftWidth = width * leftRatio;
    return [
      ...createTreemapLayout(leftItems, x, y, leftWidth, height),
      ...createTreemapLayout(rightItems, x + leftWidth, y, width - leftWidth, height),
    ];
  }

  const topHeight = height * leftRatio;
  return [
    ...createTreemapLayout(leftItems, x, y, width, topHeight),
    ...createTreemapLayout(rightItems, x, y + topHeight, width, height - topHeight),
  ];
}

function getEntryDateValue(entry: Pick<AnalyzeEntry, 'last_access'>) {
  if (!entry.last_access) return 0;
  const value = new Date(entry.last_access).getTime();
  return Number.isFinite(value) ? value : 0;
}

function formatEntryDate(entry: Pick<AnalyzeEntry, 'last_access'>) {
  const value = getEntryDateValue(entry);
  if (!value) return '';

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

function DiskUsageProportionGraph({
  items,
  totalSize,
}: {
  items: TreemapItem[];
  totalSize: number;
}) {
  const visibleItems = items.filter((item) => item.size > 0).slice(0, 8);

  if (visibleItems.length === 0 || totalSize <= 0) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-white/50 bg-white/25 p-3 shadow-inner shadow-white/20">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Disk usage</div>
        <div className="font-mono text-xs font-black text-slate-500">{formatBytes(totalSize)}</div>
      </div>
      <div
        aria-label="Disk usage proportions"
        className="flex h-4 overflow-hidden rounded-full bg-slate-900/10"
      >
        {visibleItems.map((item) => (
          <div
            key={item.path}
            className="min-w-[3px] border-r border-white/50 last:border-r-0"
            style={{
              width: `${Math.max(1, item.percentage)}%`,
              background: item.color,
            }}
            title={`${item.name} - ${formatBytes(item.size)} - ${item.percentage.toFixed(1)}%`}
          />
        ))}
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {visibleItems.slice(0, 4).map((item) => (
          <div key={item.path} className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: item.color }} />
              <span className="truncate text-xs font-bold text-slate-700">{item.name}</span>
            </div>
            <div className="mt-0.5 font-mono text-[11px] font-black text-slate-500">
              {item.percentage.toFixed(1)}%
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const config: PageConfig = {
  title: 'Analyze storage',
  description: 'Visualize disk usage and identify large files and folders consuming your storage.',
  icon: 'Database',
  buttonText: 'Analyze Storage',
  items: [
    {
      icon: 'BarChart3',
      title: 'Disk Usage Map',
      description: 'Interactive visualization of storage usage',
    },
    {
      icon: 'FolderOpen',
      title: 'Large Files',
      description: 'Quickly identify space-hogging files',
    },
    {
      icon: 'Layers',
      title: 'Category Breakdown',
      description: 'See storage by file type and category',
    },
  ],
};

export function AnalyzePage() {
  const [stage, setStage] = usePersistentState<Stage>('mole-analyze-stage', 'idle');
  const [scanPath, setScanPath] = usePersistentState('mole-analyze-scan-path', '/');
  const [result, setResult] = usePersistentState<AnalyzeResult | null>('mole-analyze-result', null);
  const [progress, setProgress] = usePersistentState('mole-analyze-progress', 0);
  const [currentFile, setCurrentFile] = usePersistentState('mole-analyze-current-file', '');
  const [error, setError] = usePersistentState<string | null>('mole-analyze-error', null);
  const [pathInput, setPathInput] = usePersistentState('mole-analyze-path-input', '/');
  const [selectedMode, setSelectedMode] = usePersistentState<AnalyzeMode>('mole-analyze-selected-mode', 'disk');
  // 'start' = StartScreen, 'pick' = path picker, rest handled by stage
  const [view, setView] = usePersistentState<'start' | 'pick'>('mole-analyze-view', 'start');

  // Folder navigation cache: path -> AnalyzeResult
  const resultCacheRef = useRef<Map<string, AnalyzeResult>>(new Map());
  // Navigation history stack for back-navigation
  const [navHistory, setNavHistory] = useState<string[]>([]);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [pendingDelete, setPendingDelete] = useState<FileActionItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [inlineScanPath, setInlineScanPath] = useState('');
  const [isBackgroundRefreshing, setIsBackgroundRefreshing] = useState(false);
  const [resultsView, setResultsView] = usePersistentState<ResultsViewMode>('mole-analyze-results-view', 'map');
  const [entrySortMode, setEntrySortMode] = usePersistentState<EntrySortMode>('mole-analyze-entry-sort', 'size');
  const [showFiles, setShowFiles] = usePersistentState('mole-analyze-show-files', true);
  const [showFolders, setShowFolders] = usePersistentState('mole-analyze-show-folders', true);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cache the current result whenever it changes
  useEffect(() => {
    if (result && result.path) {
      resultCacheRef.current.set(result.path, result);
    }
  }, [result]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      window.moleDesktop?.analyze?.removeListeners();
    };
  }, []);

  useEffect(() => {
    if (!contextMenu) return;

    const closeContextMenu = () => setContextMenu(null);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeContextMenu();
    };

    window.addEventListener('click', closeContextMenu);
    window.addEventListener('blur', closeContextMenu);
    window.addEventListener('keydown', closeOnEscape);

    return () => {
      window.removeEventListener('click', closeContextMenu);
      window.removeEventListener('blur', closeContextMenu);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [contextMenu]);

  useEffect(() => {
    if (!isFilterOpen) return;

    const closeFilter = () => setIsFilterOpen(false);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeFilter();
    };

    window.addEventListener('click', closeFilter);
    window.addEventListener('blur', closeFilter);
    window.addEventListener('keydown', closeOnEscape);

    return () => {
      window.removeEventListener('click', closeFilter);
      window.removeEventListener('blur', closeFilter);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [isFilterOpen]);

  const startScan = async (
    path?: string,
    {
      pushHistory = true,
      skipCache = false,
      display,
    }: { pushHistory?: boolean; skipCache?: boolean; display?: 'page' | 'inline' | 'background' } = {},
  ) => {
    const targetPath = path ?? pathForAnalyzeMode(selectedMode, pathInput);
    const scanDisplay = display ?? (stage === 'results' && result ? 'inline' : 'page');

    if ((inlineScanPath || isBackgroundRefreshing) && scanDisplay !== 'page') return;

    // Push the current result path to navigation history
    if (pushHistory && result?.path && result.path !== targetPath) {
      setNavHistory((prev) => [...prev, result.path]);
    }

    // Check cache first (unless explicitly skipping, e.g. rescan)
    if (!skipCache) {
      const cached = resultCacheRef.current.get(targetPath);
      if (cached) {
        setSelectedMode(modeForPath(targetPath));
        setScanPath(targetPath);
        setPathInput(targetPath);
        setResult(cached);
        setStage('results');
        return;
      }
    }

    setSelectedMode(modeForPath(targetPath));
    setScanPath(targetPath);
    setPathInput(targetPath);
    setError(null);

    if (scanDisplay === 'page') {
      setStage('scanning');
      setView('start'); // not on pick screen anymore
      setProgress(0);
      setCurrentFile('');
    } else if (scanDisplay === 'inline') {
      setStage('results');
      setInlineScanPath(targetPath);
      setProgress(0);
      setCurrentFile('');
    } else {
      setIsBackgroundRefreshing(true);
    }

    let jsonBuffer = '';

    window.moleDesktop.analyze.onStdout((text) => {
      jsonBuffer += text;
      const clean = stripAnsi(text).trim();
      if (scanDisplay !== 'background' && clean) setCurrentFile(clean.slice(0, 80));
    });

    window.moleDesktop.analyze.onStderr((text) => {
      console.error('[Analyze stderr]', text);
    });

    if (scanDisplay !== 'background') {
      // Simulate progress while scanning
      progressIntervalRef.current = setInterval(() => {
        setProgress((prev) => (prev < 88 ? prev + Math.random() * 8 : prev));
      }, 400);
    }

    try {
      const res = await window.moleDesktop.analyze.execute(targetPath, { fresh: skipCache });

      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
      if (scanDisplay !== 'background') setProgress(100);

      if (res.ok) {
        try {
          const parsed: AnalyzeResult = JSON.parse(res.stdout || jsonBuffer);
          resultCacheRef.current.set(targetPath, parsed);
          setResult(parsed);
          setStage('results');
        } catch (parseErr) {
          console.error('Failed to parse analyze JSON:', parseErr);
          if (scanDisplay === 'page') {
            setError('Failed to parse analysis results. The scan may have returned unexpected output.');
            setStage('error');
          } else {
            toast('Failed to parse analysis results', {
              description: 'The scan may have returned unexpected output.',
              icon: <AlertCircle className="w-4 h-4 text-accent-danger" />,
            });
          }
        }
      } else if (res.killed) {
        if (scanDisplay === 'page') setStage('idle');
      } else {
        if (scanDisplay === 'page') {
          setError(res.stderr || 'Analysis failed with an unknown error.');
          setStage('error');
        } else {
          toast('Analysis failed', {
            description: res.stderr || 'Analysis failed with an unknown error.',
            icon: <AlertCircle className="w-4 h-4 text-accent-danger" />,
          });
        }
      }
    } catch (err: any) {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
      if (scanDisplay === 'page') {
        setError(err.message || 'An unexpected error occurred.');
        setStage('error');
      } else {
        toast('Analysis failed', {
          description: err.message || 'An unexpected error occurred.',
          icon: <AlertCircle className="w-4 h-4 text-accent-danger" />,
        });
      }
    } finally {
      window.moleDesktop.analyze.removeListeners();
      if (scanDisplay === 'inline') setInlineScanPath('');
      if (scanDisplay === 'background') setIsBackgroundRefreshing(false);
    }
  };

  const stopScan = async () => {
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    await window.moleDesktop.analyze.kill();
    setInlineScanPath('');
    setIsBackgroundRefreshing(false);
    setStage('idle');
    setView('start');
    toast('Analysis cancelled', {
      description: 'The disk scan was stopped.',
      icon: <X className="w-4 h-4 text-text-secondary" />,
    });
  };

  const reset = () => {
    setStage('idle');
    setView('start');
    setResult(null);
    setProgress(0);
    setCurrentFile('');
    setError(null);
    setNavHistory([]);
    setInlineScanPath('');
    setIsBackgroundRefreshing(false);
  };

  // Navigate to parent directory
  const navigateUp = useCallback(() => {
    if (!result?.path || result.path === '/') return;
    const parentPath = result.path.replace(/\/[^/]+\/?$/, '') || '/';
    startScan(parentPath);
  }, [result?.path]);

  // Navigate back through history
  const navigateBack = useCallback(() => {
    if (navHistory.length === 0) {
      reset();
      return;
    }
    const prevPath = navHistory[navHistory.length - 1];
    setNavHistory((prev) => prev.slice(0, -1));
    startScan(prevPath, { pushHistory: false });
  }, [navHistory]);

  // Build breadcrumb segments from the current result path
  const buildBreadcrumbs = useCallback((): Array<{ label: string; path: string }> => {
    if (!result?.path) return [];
    const parts = result.path.split('/').filter(Boolean);
    const crumbs: Array<{ label: string; path: string }> = [{ label: '/', path: '/' }];
    let accumulated = '';
    for (const part of parts) {
      accumulated += `/${part}`;
      crumbs.push({ label: part, path: accumulated });
    }
    return crumbs;
  }, [result?.path]);

  const selectAnalyzeMode = (mode: QuickAnalyzeMode) => {
    const nextPath = pathForAnalyzeMode(mode, pathInput);
    setSelectedMode(mode);
    setScanPath(nextPath);
    setPathInput(nextPath);
  };

  const openItemContextMenu = (event: MouseEvent, item: FileActionItem & { isOther?: boolean }) => {
    if (item.isOther) return;
    event.preventDefault();
    event.stopPropagation();

    const menuWidth = 220;
    const menuHeight = 110;
    setContextMenu({
      x: Math.min(event.clientX, Math.max(12, window.innerWidth - menuWidth)),
      y: Math.min(event.clientY, Math.max(12, window.innerHeight - menuHeight)),
      item: {
        name: item.name,
        path: item.path,
        size: item.size,
        is_dir: item.is_dir,
      },
    });
  };

  const requestDelete = (item: FileActionItem) => {
    setContextMenu(null);
    setPendingDelete(item);
  };

  const openInFinder = async (item: FileActionItem) => {
    setContextMenu(null);
    const res = await window.moleDesktop.openPathInFinder(item.path);
    if (!res.ok) {
      toast('Could not open Finder', {
        description: res.message || item.path,
        icon: <AlertCircle className="w-4 h-4 text-accent-danger" />,
      });
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;

    setIsDeleting(true);
    const deletedItem = pendingDelete;

    try {
      const res = await window.moleDesktop.deletePath(deletedItem.path);
      if (!res.ok) {
        toast('Delete failed', {
          description: res.message || deletedItem.path,
          icon: <AlertCircle className="w-4 h-4 text-accent-danger" />,
        });
        return;
      }

      toast(`${deletedItem.is_dir ? 'Folder' : 'File'} moved to Trash`, {
        description: deletedItem.path,
        icon: <Trash2 className="w-4 h-4 text-accent-danger" />,
      });
      setPendingDelete(null);
      resultCacheRef.current.clear();
      if (result?.path) {
        await startScan(result.path, { pushHistory: false, skipCache: true });
      }
    } finally {
      setIsDeleting(false);
    }
  };

  // ── Idle / Start Screen ──────────────────────────────────────────────────
  if (stage === 'idle' && view === 'start') {
    return (
      <StartScreen
        config={config}
        onStart={() => setView('pick')}
        variant="feature"
      />
    );
  }

  // ── Path Picker ──────────────────────────────────────────────────────────
  if (stage === 'idle' && view === 'pick') {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8">
        <Card className="w-full max-w-lg p-8 space-y-6">
          <div className="text-center">
            <div className="inline-flex p-4 rounded-2xl bg-analyze/10 mb-4">
              <BarChart3 className="w-8 h-8 text-analyze" />
            </div>
            <h2 className="text-2xl font-bold text-text-primary mb-1">Choose Scan Location</h2>
            <p className="text-sm text-text-secondary">Select a folder to analyze its disk usage</p>
          </div>

          {/* Quick paths */}
          <div className="grid grid-cols-3 gap-3">
            {QUICK_PATHS.map(({ mode, label, icon: Icon }) => (
              <button
                key={mode}
                onClick={() => selectAnalyzeMode(mode)}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${selectedMode === mode
                  ? 'border-accent-primary bg-accent-primary/10 text-accent-primary'
                  : 'border-surface-hover bg-surface text-text-secondary hover:border-accent-primary/40 hover:text-text-primary'
                  }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs font-medium">{label}</span>
              </button>
            ))}
          </div>

          {/* Custom path input */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Custom Path
            </label>
            <div className="relative">
              <Folder className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
              <input
                type="text"
                value={pathInput}
                onChange={(e) => {
                  const nextPath = e.target.value;
                  setSelectedMode(modeForPath(nextPath));
                  setPathInput(nextPath);
                  setScanPath(nextPath);
                }}
                placeholder="/path/to/folder"
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-surface border border-surface-hover text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent-primary/30 focus:border-accent-primary transition-all font-mono text-sm"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="secondary" onClick={reset} className="flex-1">
              Cancel
            </Button>
            <Button onClick={() => startScan()} className="flex-1 gap-2">
              <Search className="w-4 h-4" />
              Start Analysis
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // ── Scanning ─────────────────────────────────────────────────────────────
  if (stage === 'scanning') {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8">
        <div className="text-center space-y-6 w-full max-w-md">
          <div className="inline-flex p-6 rounded-full bg-analyze/10 relative">
            <Spinner size="lg" />
            <Search className="absolute inset-0 m-auto w-6 h-6 text-analyze" />
          </div>

          <div>
            <h2 className="text-2xl font-bold text-text-primary mb-1">Analyzing Disk...</h2>
            <p className="text-sm text-text-secondary font-mono truncate max-w-xs mx-auto">
              {scanPath}
            </p>
          </div>

          {/* Progress bar */}
          <div className="space-y-2">
            <div className="h-2 bg-surface rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-analyze to-accent-secondary rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-text-tertiary">
              <span className="truncate max-w-[240px]">{currentFile || 'Scanning...'}</span>
              <span>{Math.round(progress)}%</span>
            </div>
          </div>

          <Button variant="secondary" onClick={stopScan} className="gap-2">
            <X className="w-4 h-4" />
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (stage === 'error') {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8">
        <div className="text-center space-y-6 max-w-md">
          <div className="inline-flex p-6 rounded-full bg-accent-danger/10">
            <AlertCircle className="w-12 h-12 text-accent-danger" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-text-primary mb-2">Analysis Failed</h2>
            <p className="text-sm text-text-secondary">{error}</p>
          </div>
          <div className="flex gap-3 justify-center">
            <Button variant="secondary" onClick={reset} className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
            <Button onClick={() => startScan()} className="gap-2">
              <RefreshCw className="w-4 h-4" />
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Results ──────────────────────────────────────────────────────────────
  if (stage === 'results' && result) {
    const entries = [...(result.entries ?? [])].sort((a, b) => b.size - a.size);
    const filteredEntries = entries.filter((entry) => (entry.is_dir ? showFolders : showFiles));
    const sortedListEntries = [...filteredEntries].sort((a, b) => {
      if (entrySortMode === 'date') {
        return getEntryDateValue(b) - getEntryDateValue(a) || b.size - a.size;
      }

      return b.size - a.size;
    });
    const largeFiles = showFiles
      ? [...(result.large_files ?? [])].sort((a, b) => b.size - a.size)
      : [];
    const filteredSize = sumSizes(filteredEntries);
    const treemapItems = buildTreemapItems(filteredEntries, result.total_size, result.path, filteredSize);
    const treemapRects = createTreemapLayout(treemapItems);
    const leadingEntries = treemapItems.slice(0, 7);
    const breadcrumbs = buildBreadcrumbs();
    const canGoUp = result.path !== '/';

    return (
      <div className="relative h-full overflow-y-auto p-4 xl:overflow-hidden">
        {/* Breadcrumb navigation bar */}
        <div className="mb-3 flex items-center gap-1.5 rounded-2xl border border-white/50 bg-white/30 px-3 py-2 shadow-inner shadow-white/20 backdrop-blur-xl overflow-x-auto custom-scrollbar">
          <button
            type="button"
            onClick={navigateBack}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition hover:bg-white/40 text-slate-500 hover:text-slate-800"
            title={navHistory.length > 0 ? 'Go back' : 'Back to start'}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </button>
          {canGoUp && (
            <button
              type="button"
              onClick={navigateUp}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition hover:bg-white/40 text-slate-500 hover:text-slate-800"
              title="Go to parent folder"
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </button>
          )}
          <div className="mx-1 h-4 w-px bg-slate-300/60 shrink-0" />
          <div className="flex items-center gap-0.5 min-w-0 overflow-x-auto">
            {breadcrumbs.map((crumb, index) => {
              const isLast = index === breadcrumbs.length - 1;
              return (
                <div key={crumb.path} className="flex items-center gap-0.5 shrink-0">
                  {index > 0 && <ChevronRight className="h-3 w-3 text-slate-400 shrink-0" />}
                  <button
                    type="button"
                    disabled={isLast}
                    onClick={() => {
                      if (!isLast) startScan(crumb.path);
                    }}
                    className={`rounded-md px-1.5 py-0.5 text-xs font-semibold transition truncate max-w-[8rem] ${isLast
                      ? 'text-slate-900 cursor-default'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-white/40'
                      }`}
                    title={crumb.path}
                  >
                    {crumb.label}
                  </button>
                </div>
              );
            })}
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <Button
              aria-label="Rescan storage"
              title={isBackgroundRefreshing ? 'Refreshing in background' : 'Rescan storage'}
              disabled={isBackgroundRefreshing || Boolean(inlineScanPath)}
              onClick={() => {
                const targetPath = result.path;
                resultCacheRef.current.clear();
                setStage('scanning');
                setView('start');
                setResult(null);
                setProgress(0);
                setCurrentFile('');
                setError(null);
                setNavHistory([]);
                setInlineScanPath('');
                setIsBackgroundRefreshing(false);
                void startScan(targetPath, { skipCache: true, pushHistory: false, display: 'page' });
              }}
              className="h-8 rounded-full px-3"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isBackgroundRefreshing ? 'animate-spin' : ''}`} />
            </Button>
            <div className="relative">
              <Button
                variant="secondary"
                aria-label="Filter results"
                title="Filter files and folders"
                onClick={(event) => {
                  event.stopPropagation();
                  setIsFilterOpen((open) => !open);
                }}
                className="h-8 rounded-full px-3"
              >
                <Filter className="h-3.5 w-3.5" />
              </Button>
              {isFilterOpen && (
                <div
                  className="absolute right-0 top-10 z-40 w-52 rounded-2xl border border-white/60 bg-white/90 p-2 shadow-[0_18px_50px_rgba(15,23,42,0.16)] backdrop-blur-2xl"
                  onClick={(event) => event.stopPropagation()}
                >
                  <label className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-900/5">
                    <input
                      type="checkbox"
                      checked={showFiles}
                      onChange={(event) => setShowFiles(event.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-accent-primary focus:ring-accent-primary"
                    />
                    <File className="h-4 w-4 text-slate-500" />
                    Files
                  </label>
                  <label className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-900/5">
                    <input
                      type="checkbox"
                      checked={showFolders}
                      onChange={(event) => setShowFolders(event.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-accent-primary focus:ring-accent-primary"
                    />
                    <Folder className="h-4 w-4 text-slate-500" />
                    Folders
                  </label>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid min-h-[calc(100%-3.25rem)] grid-cols-1 gap-4 h-[calc(100%-3.25rem)] min-h-0 grid-cols-[20rem_minmax(0,1fr)]">
          <Card className={`min-h-[34rem] rounded-[1.75rem] p-4 xl:min-h-0 ${ANALYZE_GLASS_CARD}`}>
            <div className="flex h-full min-h-0 flex-col">
              <div className="flex flex-col items-center text-center">

                <div className="font-mono text-2xl font-black tracking-tight text-slate-950">
                  {filteredEntries.length} of {entries.length} items, {formatBytes(filteredSize)}
                </div>
                <div className="mt-2 max-w-full truncate font-mono text-xs font-semibold text-slate-500">
                  {result.path}
                </div>
              </div>

              <div className="mt-8 flex-1 min-h-0 overflow-y-auto pr-1 custom-scrollbar">
                <div className="space-y-2">
                  {leadingEntries.map((entry) => (
                    <button
                      key={entry.path}
                      type="button"
                      aria-disabled={!entry.is_dir || entry.isOther}
                      onContextMenu={(event) => openItemContextMenu(event, entry)}
                      onClick={() => {
                        if (entry.is_dir && !entry.isOther) {
                          setScanPath(entry.path);
                          startScan(entry.path);
                        }
                      }}
                      className={`group flex w-full items-center gap-3 rounded-2xl px-2 py-3 text-left transition hover:bg-white/35 ${!entry.is_dir || entry.isOther ? 'cursor-default' : ''}`}
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/60 bg-white/35 shadow-inner shadow-white/30" style={{ color: entry.color }}>
                        {entry.is_dir ? <Folder className="h-4 w-4" /> : <File className="h-4 w-4" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-lg font-black text-slate-950">{entry.name}</span>
                        <span className="block font-mono text-sm font-bold text-slate-500">
                          {formatBytes(entry.size)} - {entry.percentage.toFixed(0)}%
                        </span>
                      </span>
                      {entry.is_dir && !entry.isOther && (
                        <ChevronRight className="h-5 w-5 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-700" />
                      )}
                    </button>
                  ))}
                </div>

                {largeFiles.length > 0 && (
                  <div className="mt-7 border-t border-slate-900/10 pt-5">
                    <div className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-slate-500">Largest Files</div>
                    <div className="space-y-2">
                      {largeFiles.slice(0, 4).map((file, index) => (
                        <div
                          key={file.path}
                          onContextMenu={(event) => openItemContextMenu(event, { ...file, is_dir: false })}
                          className="rounded-2xl border border-white/50 bg-white/25 p-3 shadow-inner shadow-white/20"
                        >
                          <div className="flex items-center gap-2">
                            <File className="h-4 w-4 shrink-0 text-rose-500" />
                            <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-900">{file.name}</span>
                            <span className="font-mono text-xs font-black text-slate-500">#{index + 1}</span>
                            <button
                              type="button"
                              onClick={() => requestDelete({ ...file, is_dir: false })}
                              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-rose-500 transition hover:bg-rose-500/10 hover:text-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                              title={`Delete ${file.name}`}
                              aria-label={`Delete ${file.name}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <div className="mt-1 font-mono text-xs font-bold text-slate-500">{formatBytes(file.size)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-5 flex flex-col gap-2">
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={navigateBack} className="flex-1 gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </Button>
                  {canGoUp && (
                    <Button variant="secondary" onClick={navigateUp} className="flex-1 gap-2">
                      <ChevronUp className="h-4 w-4" />
                      Up
                    </Button>
                  )}
                </div>
                <Button variant="secondary" onClick={() => { setStage('idle'); setView('pick'); }} className="w-full gap-2">
                  <FolderOpen className="h-4 w-4" />
                  Path
                </Button>
              </div>
            </div>
          </Card>

          <Card className={`min-h-[36rem]  p-4 xl:min-h-0 ${ANALYZE_GLASS_CARD}`}>
            <div className="flex h-full min-h-0 flex-col">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black text-slate-950">
                    {resultsView === 'map' ? 'Storage map' : 'File management'}
                  </h2>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    {filteredEntries.length} visible items from {formatBytes(result.total_size)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex rounded-full border border-white/60 bg-white/35 p-1 shadow-inner shadow-white/20">
                    <button
                      type="button"
                      aria-label="Storage map"
                      onClick={() => setResultsView('map')}
                      className={`flex h-8 w-8 items-center justify-center rounded-full transition ${resultsView === 'map'
                        ? 'bg-slate-950 text-white shadow-md'
                        : 'text-slate-500 hover:bg-white/50 hover:text-slate-900'
                        }`}
                      title="Storage map"
                    >
                      <LayoutGrid className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label="File management list"
                      onClick={() => setResultsView('list')}
                      className={`flex h-8 w-8 items-center justify-center rounded-full transition ${resultsView === 'list'
                        ? 'bg-slate-950 text-white shadow-md'
                        : 'text-slate-500 hover:bg-white/50 hover:text-slate-900'
                        }`}
                      title="File management list"
                    >
                      <List className="h-4 w-4" />
                    </button>
                  </div>
                  {resultsView === 'list' && (
                    <div className="flex rounded-full border border-white/60 bg-white/35 p-1 shadow-inner shadow-white/20">
                      <button
                        type="button"
                        aria-label="Sort by size"
                        onClick={() => setEntrySortMode('size')}
                        className={`flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-black transition ${entrySortMode === 'size'
                          ? 'bg-slate-950 text-white shadow-md'
                          : 'text-slate-500 hover:bg-white/50 hover:text-slate-900'
                          }`}
                      >
                        <BarChart3 className="h-3.5 w-3.5" />
                        Size
                      </button>
                      <button
                        type="button"
                        aria-label="Sort by date"
                        onClick={() => setEntrySortMode('date')}
                        className={`flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-black transition ${entrySortMode === 'date'
                          ? 'bg-slate-950 text-white shadow-md'
                          : 'text-slate-500 hover:bg-white/50 hover:text-slate-900'
                          }`}
                      >
                        <CalendarDays className="h-3.5 w-3.5" />
                        Date
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {resultsView === 'list' && (
                <div className="mb-4">
                  <DiskUsageProportionGraph items={treemapItems} totalSize={result.total_size} />
                </div>
              )}

              <div className="relative flex-1 min-h-0 rounded-sm space-4">
                {inlineScanPath ? (
                  <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-white/45 bg-white/25 p-8 text-center shadow-inner shadow-white/20">
                    <div className="relative mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-analyze/10">
                      <Spinner size="lg" />
                      <Search className="absolute inset-0 m-auto h-5 w-5 text-analyze" />
                    </div>
                    <h3 className="text-xl font-black text-slate-950">Scanning folder</h3>
                    <p className="mt-2 max-w-md truncate font-mono text-sm font-bold text-slate-500">{inlineScanPath}</p>
                    <div className="mt-6 w-full max-w-sm space-y-2">
                      <div className="h-2 overflow-hidden rounded-full bg-slate-900/10">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-analyze to-accent-secondary transition-all duration-500 ease-out"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between gap-3 font-mono text-xs font-bold text-slate-500">
                        <span className="truncate">{currentFile || 'Scanning...'}</span>
                        <span className="shrink-0">{Math.round(progress)}%</span>
                      </div>
                    </div>
                  </div>
                ) : filteredEntries.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center text-center">
                    <FolderOpen className="mb-3 h-12 w-12 text-slate-400" />
                    <p className="font-semibold text-slate-600">No entries match the current filters.</p>
                  </div>
                ) : resultsView === 'list' ? (
                  <div className="h-full overflow-y-auto pr-1 custom-scrollbar">
                    <div className="space-y-2">
                      {sortedListEntries.map((entry) => {
                        const percentage = result.total_size > 0 ? (entry.size / result.total_size) * 100 : 0;
                        const entryDate = formatEntryDate(entry);
                        return (
                          <button
                            key={entry.path}
                            type="button"
                            data-testid="file-management-row"
                            aria-disabled={!entry.is_dir}
                            onContextMenu={(event) => openItemContextMenu(event, entry)}
                            onClick={() => {
                              if (entry.is_dir) {
                                setScanPath(entry.path);
                                startScan(entry.path);
                              }
                            }}
                            className={`group relative w-full overflow-hidden rounded-2xl border border-white/50 bg-white/30 p-3 text-left shadow-inner shadow-white/20 transition hover:bg-white/45 ${!entry.is_dir ? 'cursor-default' : ''}`}
                          >
                            <div
                              className="absolute inset-y-0 left-0 bg-accent-primary/10"
                              style={{ width: `${Math.max(1, percentage)}%` }}
                            />
                            <div className="relative flex items-center gap-3">
                              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/60 bg-white/45 text-slate-600 shadow-inner shadow-white/30">
                                {entry.is_dir ? <Folder className="h-4 w-4" /> : <File className="h-4 w-4" />}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-base font-black text-slate-950">{entry.name}</span>
                                <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs font-bold text-slate-500">
                                  <span>{formatBytes(entry.size)}</span>
                                  <span>{percentage.toFixed(1)}% of parent</span>
                                  {entryDate && <span>{entryDate}</span>}
                                </span>
                              </span>
                              <span className="hidden w-28 shrink-0 sm:block">
                                <span className="block h-2 overflow-hidden rounded-full bg-slate-900/10">
                                  <span
                                    className="block h-full rounded-full bg-slate-950/70"
                                    style={{ width: `${Math.max(2, percentage)}%` }}
                                  />
                                </span>
                              </span>
                              {entry.is_dir && (
                                <ChevronRight className="h-5 w-5 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-700" />
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  treemapRects.map((rect) => {
                    const showDetails = rect.width > 12 && rect.height > 10;
                    const showLargeLabel = rect.width > 22 && rect.height > 16;
                    return (
                      <button
                        key={rect.path}
                        type="button"
                        aria-disabled={!rect.is_dir || rect.isOther}
                        onContextMenu={(event) => openItemContextMenu(event, rect)}
                        onClick={() => {
                          if (rect.is_dir && !rect.isOther) {
                            setScanPath(rect.path);
                            startScan(rect.path);
                          }
                        }}
                        className={`group absolute overflow-hidden rounded-lg border border-white/35 p-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.36),0_12px_36px_rgba(15,23,42,0.10)] transition duration-300 hover:z-10 hover:scale-[1.01] hover:shadow-[0_20px_50px_rgba(15,23,42,0.20)] ${!rect.is_dir || rect.isOther ? 'cursor-default hover:scale-100' : ''}`}
                        style={{
                          left: `${rect.x}%`,
                          top: `${rect.y}%`,
                          width: `${rect.width}%`,
                          height: `${rect.height}%`,
                          background: `linear-gradient(145deg, ${rect.color}, ${rect.color}dd)`,
                        }}
                        title={`${rect.name} - ${formatBytes(rect.size)} - ${rect.percentage.toFixed(1)}%`}
                      >
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_24%_20%,rgba(255,255,255,0.28),transparent_38%)] opacity-80" />
                        {!showLargeLabel && (
                          <div className="absolute inset-x-1 top-1 z-[1] truncate rounded-md bg-black/20 px-1.5 py-0.5 text-[10px] font-black leading-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]">
                            {rect.name}
                          </div>
                        )}
                        {showDetails && (
                          <div className="relative flex h-full flex-col items-center justify-center text-center text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.35)]">
                            {showLargeLabel && (
                              <div className="mb-2 flex items-center gap-2">
                                {rect.is_dir ? <Folder className="h-5 w-5" /> : <File className="h-5 w-5" />}
                                <span className="truncate text-xl font-black">{rect.name}</span>
                              </div>
                            )}
                            <div className="font-mono text-sm font-black sm:text-base">{formatBytes(rect.size)}</div>
                          </div>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </Card>
        </div>

        {contextMenu && (
          <div
            className="fixed z-50 w-56 overflow-hidden rounded-2xl border border-white/60 bg-white/90 p-1.5 shadow-[0_18px_50px_rgba(15,23,42,0.18)] backdrop-blur-2xl"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => void openInFinder(contextMenu.item)}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-bold text-slate-700 transition hover:bg-slate-900/5"
            >
              <ExternalLink className="h-4 w-4" />
              Open in Finder
            </button>
            <button
              type="button"
              onClick={() => requestDelete(contextMenu.item)}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-bold text-rose-600 transition hover:bg-rose-500/10"
            >
              <Trash2 className="h-4 w-4" />
              Delete {contextMenu.item.is_dir ? 'Folder' : 'File'}
            </button>
          </div>
        )}

        {pendingDelete && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/35 p-6 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-[1.75rem] border border-white/60 bg-white/90 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.24)] backdrop-blur-2xl">
              <div className="flex items-start gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-600">
                  <Trash2 className="h-6 w-6" />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-xl font-black text-slate-950">Confirm deletion</h3>
                  <p className="mt-2 text-sm font-semibold text-slate-600">
                    Move this {pendingDelete.is_dir ? 'folder' : 'file'} to Trash? This action requires confirmation every time.
                  </p>
                  <div className="mt-4 rounded-2xl border border-slate-900/10 bg-white/65 p-3">
                    <div className="truncate text-sm font-black text-slate-900">{pendingDelete.name}</div>
                    <div className="mt-1 truncate font-mono text-xs font-bold text-slate-500">{pendingDelete.path}</div>
                    <div className="mt-2 font-mono text-xs font-black text-rose-500">{formatBytes(pendingDelete.size)}</div>
                  </div>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <Button variant="secondary" onClick={() => setPendingDelete(null)} disabled={isDeleting}>
                  Cancel
                </Button>
                <Button variant="danger" onClick={() => void confirmDelete()} disabled={isDeleting} className="gap-2">
                  <Trash2 className="h-4 w-4" />
                  {isDeleting ? 'Deleting...' : 'Move to Trash'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}
