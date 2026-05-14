import { useEffect, useRef, useState, useCallback } from 'react';
import {
  HardDrive, FolderOpen, File, BarChart3, Search,
  RefreshCw, X, ChevronRight, ChevronUp, Home, Download,
  AlertCircle, ArrowLeft, Folder
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

function buildTreemapItems(entries: AnalyzeEntry[], totalSize: number, resultPath: string): TreemapItem[] {
  const visibleEntries = entries.filter((entry) => entry.size > 0).slice(0, 12);
  const visibleSize = sumSizes(visibleEntries);
  const remainder = Math.max(0, totalSize - visibleSize);
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

const config: PageConfig = {
  title: 'Analyze',
  description: 'Visualize disk usage and identify large files and folders consuming your storage.',
  icon: 'PieChart',
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

  const startScan = async (path?: string, { pushHistory = true, skipCache = false }: { pushHistory?: boolean; skipCache?: boolean } = {}) => {
    const targetPath = path ?? pathForAnalyzeMode(selectedMode, pathInput);

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
    setStage('scanning');
    setView('start'); // not on pick screen anymore
    setProgress(0);
    setCurrentFile('');
    setError(null);

    let jsonBuffer = '';

    window.moleDesktop.analyze.onStdout((text) => {
      jsonBuffer += text;
      const clean = stripAnsi(text).trim();
      if (clean) setCurrentFile(clean.slice(0, 80));
    });

    window.moleDesktop.analyze.onStderr((text) => {
      console.error('[Analyze stderr]', text);
    });

    // Simulate progress while scanning
    progressIntervalRef.current = setInterval(() => {
      setProgress((prev) => (prev < 88 ? prev + Math.random() * 8 : prev));
    }, 400);

    try {
      const res = await window.moleDesktop.analyze.execute(targetPath);

      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      setProgress(100);

      if (res.ok) {
        try {
          const parsed: AnalyzeResult = JSON.parse(jsonBuffer || res.stdout);
          resultCacheRef.current.set(targetPath, parsed);
          setResult(parsed);
          setStage('results');
        } catch (parseErr) {
          console.error('Failed to parse analyze JSON:', parseErr);
          setError('Failed to parse analysis results. The scan may have returned unexpected output.');
          setStage('error');
        }
      } else if (res.killed) {
        setStage('idle');
      } else {
        setError(res.stderr || 'Analysis failed with an unknown error.');
        setStage('error');
      }
    } catch (err: any) {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      setError(err.message || 'An unexpected error occurred.');
      setStage('error');
    } finally {
      window.moleDesktop.analyze.removeListeners();
    }
  };

  const stopScan = async () => {
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    await window.moleDesktop.analyze.kill();
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

  // ── Idle / Start Screen ──────────────────────────────────────────────────
  if (stage === 'idle' && view === 'start') {
    return (
      <StartScreen
        config={config}
        onStart={() => setView('pick')}
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
    const largeFiles = [...(result.large_files ?? [])].sort((a, b) => b.size - a.size);
    const treemapItems = buildTreemapItems(entries, result.total_size, result.path);
    const treemapRects = createTreemapLayout(treemapItems);
    const usedPercent = result.total_size > 0 ? Math.min(100, Math.max(0, (sumSizes(entries) / result.total_size) * 100)) : 0;
    const leadingEntries = treemapItems.slice(0, 7);
    const breadcrumbs = buildBreadcrumbs();
    const canGoUp = result.path !== '/';

    return (
      <div className="relative h-full overflow-y-auto p-4 sm:p-6 xl:overflow-hidden">
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
        </div>

        <div className="grid min-h-[calc(100%-3.25rem)] grid-cols-1 gap-4 xl:h-[calc(100%-3.25rem)] xl:min-h-0 xl:grid-cols-[20rem_minmax(0,1fr)]">
          <Card className={`min-h-[34rem] rounded-[1.75rem] p-5 xl:min-h-0 ${ANALYZE_GLASS_CARD}`}>
            <div className="flex h-full min-h-0 flex-col">
              <div className="flex flex-col items-center text-center">

                <div className="font-mono text-2xl font-black tracking-tight text-slate-950">
                  {entries.length} items, {formatBytes(result.total_size)}
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
                      disabled={!entry.is_dir || entry.isOther}
                      onClick={() => {
                        if (entry.is_dir && !entry.isOther) {
                          setScanPath(entry.path);
                          startScan(entry.path);
                        }
                      }}
                      className="group flex w-full items-center gap-3 rounded-2xl px-2 py-3 text-left transition hover:bg-white/35 disabled:cursor-default disabled:hover:bg-transparent"
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
                        <div key={file.path} className="rounded-2xl border border-white/50 bg-white/25 p-3 shadow-inner shadow-white/20">
                          <div className="flex items-center gap-2">
                            <File className="h-4 w-4 shrink-0 text-rose-500" />
                            <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-900">{file.name}</span>
                            <span className="font-mono text-xs font-black text-slate-500">#{index + 1}</span>
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
            <div className="flex h-full min-h-0 flex-col gap-4">
              <div className="flex flex-col gap-4 rounded-[1.5rem]  sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xl font-black text-slate-950">
                    <Home className="h-5 w-5" />
                    <span className="truncate">Storage Map</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 font-mono text-sm font-bold text-slate-500">
                    <HardDrive className="h-4 w-4" />
                    <span className="truncate">{formatBytes(result.total_size)} analyzed</span>
                    {result.total_files != null && <span>- {result.total_files.toLocaleString()} files</span>}
                  </div>
                </div>

                <div className="flex min-w-0 flex-1 items-center gap-3 sm:max-w-md">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-900/10">
                    <div className="h-full rounded-full bg-gradient-to-r from-orange-400 via-pink-500 to-violet-500" style={{ width: `${usedPercent}%` }} />
                  </div>
                  <span className="whitespace-nowrap font-mono text-sm font-black text-orange-500">
                    {formatBytes(result.total_size)}
                  </span>
                  <Button aria-label="Rescan storage" onClick={() => startScan(scanPath, { skipCache: true, pushHistory: false })} className="h-9 rounded-full px-3">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="relative flex-1 min-h-0 rounded-sm space-4">
                {treemapRects.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center text-center">
                    <FolderOpen className="mb-3 h-12 w-12 text-slate-400" />
                    <p className="font-semibold text-slate-600">No entries found in this location.</p>
                  </div>
                ) : (
                  treemapRects.map((rect) => {
                    const showDetails = rect.width > 12 && rect.height > 10;
                    const showLargeLabel = rect.width > 22 && rect.height > 16;
                    return (
                      <button
                        key={rect.path}
                        type="button"
                        disabled={!rect.is_dir || rect.isOther}
                        onClick={() => {
                          if (rect.is_dir && !rect.isOther) {
                            setScanPath(rect.path);
                            startScan(rect.path);
                          }
                        }}
                        className="group absolute overflow-hidden rounded-lg border border-white/35 p-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.36),0_12px_36px_rgba(15,23,42,0.10)] transition duration-300 hover:z-10 hover:scale-[1.01] hover:shadow-[0_20px_50px_rgba(15,23,42,0.20)] disabled:cursor-default disabled:hover:scale-100"
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
      </div>
    );
  }

  return null;
}
