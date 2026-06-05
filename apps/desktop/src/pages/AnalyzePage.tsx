import { useEffect, useRef, useState, useCallback, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import {
  HardDrive, FolderOpen, File, BarChart3, Search,
  RefreshCw, X, ChevronRight, ChevronUp, Home, Download,
  AlertCircle, ArrowLeft, Folder, Trash2, ExternalLink,
  ListFilter,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { toast } from 'sonner';
import { StartScreen } from '@/components/common/StartScreen';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { getFileIconCategory } from '@/lib/fileIcons';
import { formatBytes, stripAnsi } from '@/utils/format';
import { usePersistentState } from '@/utils/persistentState';
import { usePaywall } from '@/hooks/usePaywall';
import type { PageConfig } from '@/types';

type Stage = 'idle' | 'scanning' | 'results' | 'error';
type AnalyzeMode = 'disk' | 'home' | 'downloads' | 'custom';
type QuickAnalyzeMode = Exclude<AnalyzeMode, 'custom'>;
type NavigationAnimationDirection = 'down' | 'up';

interface AnalyzeEntry {
  name: string;
  path: string;
  size: number;
  is_dir: boolean;
  insight?: boolean;
  cleanable?: boolean;
  last_access?: string;
  isGroupedSmallFiles?: boolean;
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

type AppIconMap = Record<string, string>;

const QUICK_PATHS: Array<{ mode: QuickAnalyzeMode; label: string; path: string; icon: LucideIcon }> = [
  { mode: 'disk', label: 'Entire Disk', path: '/', icon: HardDrive },
  { mode: 'home', label: 'Home Folder', path: '~', icon: Home },
  { mode: 'downloads', label: 'Downloads', path: '~/Downloads', icon: Download },
];

const TREEMAP_COLORS = [
  '#fb923c', '#0ea5e9', '#ef4444', '#3b82f6',
  '#a855f7', '#14b8a6', '#f59e0b', '#ec4899',
  '#22c55e', '#64748b', '#f97316', '#06b6d4',
];
const SMALL_FILE_GROUP_THRESHOLD = 1024 * 1024;

function isApplicationsPath(path: string) {
  const cleanPath = path.replace(/\/+$/, '') || '/';
  return cleanPath === '/Applications' || cleanPath.endsWith('/Applications');
}

function isMacAppEntry(entry: Pick<AnalyzeEntry, 'path' | 'is_dir'>) {
  return entry.is_dir && entry.path.endsWith('.app');
}

function pathForAnalyzeMode(mode: AnalyzeMode, customPath: string) {
  if (mode === 'custom') return customPath.trim() || '/';
  return QUICK_PATHS.find((item) => item.mode === mode)?.path ?? '/';
}

function modeForPath(path: string): AnalyzeMode {
  return QUICK_PATHS.find((item) => item.path === path)?.mode ?? 'custom';
}

function getPathDepth(path: string) {
  return path.split('/').filter(Boolean).length;
}

function sumSizes(items: Array<{ size: number }>) {
  return items.reduce((sum, item) => sum + Math.max(0, item.size), 0);
}

function groupSmallFiles(entries: AnalyzeEntry[], resultPath: string): AnalyzeEntry[] {
  const smallFiles = entries.filter((entry) => !entry.is_dir && entry.size > 0 && entry.size < SMALL_FILE_GROUP_THRESHOLD);

  if (smallFiles.length < 2) return entries;

  const smallFilePaths = new Set(smallFiles.map((entry) => entry.path));
  const groupedEntry: AnalyzeEntry = {
    name: 'Files under 1 MB',
    path: `${resultPath.replace(/\/$/, '') || '/'}/.mole-small-files`,
    size: sumSizes(smallFiles),
    is_dir: false,
    isGroupedSmallFiles: true,
  };

  return [...entries.filter((entry) => !smallFilePaths.has(entry.path)), groupedEntry];
}

function buildTreemapItems(
  entries: AnalyzeEntry[],
  totalSize: number,
  resultPath: string,
  remainderTotal = totalSize,
): TreemapItem[] {
  const visibleEntries = entries.filter((entry) => entry.size > 0);
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
  isLoading = false,
}: {
  items: TreemapItem[];
  totalSize: number;
  isLoading?: boolean;
}) {
  const visibleItems = items.filter((item) => item.size > 0).slice(0, 8);
  const totalStorageLabel = formatBytes(totalSize);

  if (visibleItems.length === 0 || totalSize <= 0) {
    return null;
  }

  return (
    <div className="rounded-[1.35rem] border border-white/55 bg-white/42 p-5 shadow-[0_18px_54px_rgba(109,93,252,0.10),inset_0_1px_0_rgba(255,255,255,0.72)] backdrop-blur-2xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="text-[0.78rem] font-black uppercase tracking-[0.24em] text-slate-500">Disk usage</div>
        <div className="shrink-0 font-mono text-[11px] font-black text-slate-600">
          Total {totalStorageLabel}
        </div>
      </div>
      <div
        aria-label="Disk usage proportions"
        className="relative flex h-6 overflow-hidden rounded-full bg-slate-900/10 shadow-inner shadow-slate-900/10"
      >
        {visibleItems.map((item) => {
          const showInlineLabel = item.percentage >= 9;

          return (
            <div
              key={item.path}
              className="flex min-w-[3px] items-center justify-center overflow-hidden border-r border-white/60 px-1 text-center last:border-r-0"
              style={{
                width: `${Math.max(1, item.percentage)}%`,
                background: `linear-gradient(135deg, ${item.color}, ${item.color}dd)`,
              }}
              title={`${item.name} - ${formatBytes(item.size)} - ${item.percentage.toFixed(1)}%`}
            >
              {showInlineLabel && (
                <span className="truncate text-[10px] font-black leading-none text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.38)]">
                  {formatBytes(item.size)}
                </span>
              )}
            </div>
          );
        })}
        {isLoading && <div className="analyze-disk-usage-flow" />}
      </div>
      <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-3 xl:grid-cols-4">
        {visibleItems.slice(0, 4).map((item) => (
          <div key={item.path} className="flex min-w-0 items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: item.color }} />
            <span className="truncate text-xs font-black text-slate-700">{item.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AnalyzePanelLoadingOverlay() {
  return (
    <div className="analyze-panel-loading-overlay absolute inset-0 z-30 flex items-center justify-center rounded-[1.35rem] bg-white/30 p-6 text-center shadow-inner shadow-white/30 backdrop-blur-2xl" aria-live="polite">
      <div className="analyze-apple-spinner" aria-label="Loading folder" role="status">
        {Array.from({ length: 8 }, (_, index) => (
          <span key={index} style={{ transform: `rotate(${index * 45}deg) translateY(-1.28rem)` }} />
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
  const { requireSubscription } = usePaywall();
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
  const [showFiles, setShowFiles] = usePersistentState('mole-analyze-show-files', true);
  const [showFolders, setShowFolders] = usePersistentState('mole-analyze-show-folders', true);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [appIcons, setAppIcons] = useState<AppIconMap>({});
  const fileListScrollRef = useRef<HTMLDivElement | null>(null);
  const [fileListScrollShadows, setFileListScrollShadows] = useState({ top: false, bottom: false });
  const [enteringResultPath, setEnteringResultPath] = useState<string | null>(null);
  const [enteringResultDirection, setEnteringResultDirection] = useState<NavigationAnimationDirection>('down');

  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const previousResultPathRef = useRef<string | null>(result?.path ?? null);
  const pendingNavigationDirectionRef = useRef<NavigationAnimationDirection>('down');

  const updateFileListScrollShadows = useCallback(() => {
    const element = fileListScrollRef.current;
    if (!element) return;

    const next = {
      top: element.scrollTop > 2,
      bottom: element.scrollTop + element.clientHeight < element.scrollHeight - 2,
    };

    setFileListScrollShadows((previous) => (
      previous.top === next.top && previous.bottom === next.bottom ? previous : next
    ));
  }, []);

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

  useEffect(() => {
    if (stage !== 'results') return;

    const frame = requestAnimationFrame(updateFileListScrollShadows);
    return () => cancelAnimationFrame(frame);
  }, [inlineScanPath, result, showFiles, showFolders, stage, updateFileListScrollShadows]);

  useEffect(() => {
    if (stage !== 'results' || !result?.path) return;

    const previousPath = previousResultPathRef.current;
    previousResultPathRef.current = result.path;

    if (!previousPath || previousPath === result.path) return;

    setEnteringResultDirection(pendingNavigationDirectionRef.current);
    setEnteringResultPath(result.path);
    const timeout = window.setTimeout(() => setEnteringResultPath(null), 520);
    return () => window.clearTimeout(timeout);
  }, [result?.path, stage]);

  useEffect(() => {
    if (stage !== 'results' || !result || !isApplicationsPath(result.path)) return;

    const appPaths = result.entries.filter(isMacAppEntry).map((entry) => entry.path);
    const missingAppPaths = appPaths.filter((path) => !appIcons[path]);
    if (missingAppPaths.length === 0) return;

    let cancelled = false;

    window.moleDesktop.uninstall.getAppIcons(missingAppPaths)
      .then((iconResult) => {
        if (cancelled || !iconResult?.ok) return;
        setAppIcons((currentIcons) => ({ ...currentIcons, ...iconResult.icons }));
      })
      .catch(() => {
        if (cancelled) return;

        void Promise.all(missingAppPaths.map(async (appPath) => {
          try {
            const iconResult = await window.moleDesktop.uninstall.getAppIcon(appPath);
            return iconResult.ok && iconResult.icon ? [appPath, iconResult.icon] as const : null;
          } catch {
            return null;
          }
        })).then((icons) => {
          if (cancelled) return;
          setAppIcons((currentIcons) => {
            const nextIcons = { ...currentIcons };
            icons.forEach((icon) => {
              if (icon) nextIcons[icon[0]] = icon[1];
            });
            return nextIcons;
          });
        });
      });

    return () => {
      cancelled = true;
    };
  }, [appIcons, result, stage]);

  const startScan = async (
    path?: string,
    {
      pushHistory = true,
      skipCache = false,
      display,
      transitionDirection,
    }: { pushHistory?: boolean; skipCache?: boolean; display?: 'page' | 'inline' | 'background'; transitionDirection?: NavigationAnimationDirection } = {},
  ) => {
    if (!requireSubscription('Storage Analyze')) return;
    const targetPath = path ?? pathForAnalyzeMode(selectedMode, pathInput);
    const scanDisplay = display ?? (stage === 'results' && result ? 'inline' : 'page');
    pendingNavigationDirectionRef.current = transitionDirection ?? (
      result?.path && getPathDepth(targetPath) < getPathDepth(result.path) ? 'up' : 'down'
    );

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
    startScan(parentPath, { transitionDirection: 'up' });
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

  const openItemContextMenu = (event: MouseEvent, item: FileActionItem & { isOther?: boolean; isGroupedSmallFiles?: boolean }) => {
    if (item.isOther || item.isGroupedSmallFiles) return;
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
        onStart={() => {
          if (requireSubscription('Storage Analyze')) setView('pick');
        }}
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
    const fileCount = entries.filter((entry) => !entry.is_dir).length;
    const folderCount = entries.length - fileCount;
    const filteredEntries = entries.filter((entry) => (entry.is_dir ? showFolders : showFiles));
    const groupedEntries = groupSmallFiles(filteredEntries, result.path);
    const sortedListEntries = [...groupedEntries].sort((a, b) => b.size - a.size);
    const filteredSize = sumSizes(groupedEntries);
    const treemapItems = buildTreemapItems(groupedEntries, result.total_size, result.path, filteredSize);
    const treemapRects = createTreemapLayout(treemapItems);
    const breadcrumbs = buildBreadcrumbs();
    const canGoUp = result.path !== '/';
    const pathParts = result.path.split('/').filter(Boolean);
    const currentPathLabel = result.path === '/' ? 'Macintosh HD' : pathParts[pathParts.length - 1] ?? result.path;
    const isViewingApplications = isApplicationsPath(result.path);
    const applicationEntries = sortedListEntries.filter(isMacAppEntry);
    const isContentEntering = enteringResultPath === result.path;
    const contentEnterClass = isContentEntering
      ? enteringResultDirection === 'up' ? 'analyze-content-enter-up' : 'analyze-content-enter-down'
      : '';

    return (
      <div className="relative h-full overflow-y-auto p-6 xl:overflow-hidden">
        {/* Breadcrumb navigation bar */}
        <div className="relative z-50 mb-7 flex items-center gap-2 rounded-full border border-white/55 bg-white/28 px-4 py-3 shadow-[0_16px_48px_rgba(109,93,252,0.08),inset_0_1px_0_rgba(255,255,255,0.72)] backdrop-blur-2xl">
          <button
            type="button"
            onClick={navigateBack}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-white/45 hover:text-slate-800"
            title={navHistory.length > 0 ? 'Go back' : 'Back to start'}
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          {canGoUp && (
            <button
              type="button"
              onClick={navigateUp}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-white/45 hover:text-slate-800"
              title="Go to parent folder"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
          )}
          <div className="mx-1 h-5 w-px shrink-0 bg-slate-300/60" />
          <div className="flex shrink-0 items-center gap-2 rounded-full px-1.5 text-sm font-black text-slate-600">
            <HardDrive className="h-4 w-4" />
            {currentPathLabel}
          </div>
          <div className="mx-1 h-5 w-px shrink-0 bg-slate-300/60" />
          <div className="flex min-w-0 items-center gap-0.5 overflow-x-auto">
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
                setProgress(0);
                setCurrentFile('');
                setError(null);
                void startScan(targetPath, { skipCache: true, pushHistory: false, display: 'inline' });
              }}
              className="h-9 rounded-full px-3"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isBackgroundRefreshing ? 'animate-spin' : ''}`} />
            </Button>
            <div className="relative">
              <Button
                variant="secondary"
                aria-label="Filter results"
                aria-expanded={isFilterOpen}
                title="Filter files and folders"
                onClick={(event) => {
                  event.stopPropagation();
                  setIsFilterOpen((open) => !open);
                }}
                className="h-10 rounded-full bg-white/72 px-3 text-slate-700 shadow-[0_8px_24px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.8)] hover:bg-white/90"
              >
                <ListFilter className="h-[1.05rem] w-[1.05rem]" strokeWidth={2.4} />
                <span className="hidden text-sm font-black sm:inline">Filter</span>
              </Button>

              {isFilterOpen && (
                <div
                  className="absolute right-0 top-12 z-[90] w-72 rounded-[1.35rem] border border-white/65 bg-white/90 p-3 shadow-[0_24px_70px_rgba(15,23,42,0.22)] backdrop-blur-2xl"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="mb-3 flex items-end justify-between gap-4 px-1">
                    <div>
                      <div className="text-[0.66rem] font-black uppercase tracking-[0.24em] text-slate-500">Show in map</div>
                      <div className="mt-1 text-sm font-black text-slate-950">{sortedListEntries.length} visible</div>
                    </div>
                    <div className="font-mono text-[11px] font-black text-slate-500">Size order</div>
                  </div>

                  <div className="grid grid-cols-2 rounded-full border border-slate-200/80 bg-slate-100/80 p-1 shadow-inner shadow-slate-900/5">
                    <button
                      type="button"
                      aria-pressed={showFiles}
                      onClick={() => setShowFiles((current) => (current && !showFolders ? current : !current))}
                      className={`flex h-11 items-center justify-center gap-2 rounded-full text-sm font-black transition ${showFiles
                        ? 'bg-white text-sky-700 shadow-[0_8px_20px_rgba(14,165,233,0.18)] ring-1 ring-sky-100'
                        : 'text-slate-500 hover:text-slate-800'
                        }`}
                    >
                      <File className="h-4 w-4" />
                      Files
                      <span className="font-mono text-[10px] opacity-70">{fileCount}</span>
                    </button>
                    <button
                      type="button"
                      aria-pressed={showFolders}
                      onClick={() => setShowFolders((current) => (current && !showFiles ? current : !current))}
                      className={`flex h-11 items-center justify-center gap-2 rounded-full text-sm font-black transition ${showFolders
                        ? 'bg-white text-violet-700 shadow-[0_8px_20px_rgba(139,92,246,0.18)] ring-1 ring-violet-100'
                        : 'text-slate-500 hover:text-slate-800'
                        }`}
                    >
                      <Folder className="h-4 w-4" />
                      Folders
                      <span className="font-mono text-[10px] opacity-70">{folderCount}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid h-[calc(100%-5.35rem)] min-h-[42rem] grid-cols-1 gap-6 xl:min-h-0 xl:grid-cols-[minmax(0,1fr)_450px]">
          <div data-testid="storage-map-panel" className="relative min-h-[34rem] overflow-hidden rounded-[1.2rem] xl:min-h-0">
            <div className={`relative h-full rounded-[1.35rem] ${contentEnterClass}`}>
              {filteredEntries.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center rounded-[1.35rem] border border-white/45 bg-white/25 text-center">
                  <FolderOpen className="mb-3 h-12 w-12 text-slate-400" />
                  <p className="font-semibold text-slate-600">No entries match the current filters.</p>
                </div>
              ) : isViewingApplications && applicationEntries.length > 0 ? (
                <div className="h-full overflow-y-auto rounded-[1.35rem] border border-white/45 bg-white/25 p-3 shadow-inner shadow-white/20 custom-scrollbar">
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(7.25rem,1fr))] gap-3">
                    {applicationEntries.map((entry) => {
                      const appIcon = appIcons[entry.path];
                      const iconCategory = getFileIconCategory(entry);
                      const FallbackIcon = iconCategory.icon;

                      return (
                        <button
                          key={entry.path}
                          type="button"
                          onContextMenu={(event) => openItemContextMenu(event, entry)}
                          onClick={() => {
                            setScanPath(entry.path);
                            startScan(entry.path);
                          }}
                          className="group flex min-h-[8.75rem] max-h-[11rem] min-w-[7.25rem] flex-col items-center justify-center overflow-hidden rounded-[1.1rem] border border-white/62 bg-white/46 p-3 text-center shadow-[0_12px_32px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.72)] transition hover:bg-white/70 hover:shadow-[0_18px_44px_rgba(15,23,42,0.14)]"
                          title={`${entry.name} - ${formatBytes(entry.size)}`}
                        >
                          <span className="mb-3 flex h-24 w-24 min-h-12 min-w-12 max-w-full items-center justify-center rounded-2xl bg-white/35 p-2 shadow-inner shadow-white/50">
                            {appIcon ? (
                              <img
                                src={appIcon}
                                alt=""
                                className="h-[clamp(3rem,7vw,5.5rem)] w-[clamp(3rem,7vw,5.5rem)] min-w-12 max-w-24 object-contain drop-shadow-[0_10px_18px_rgba(15,23,42,0.18)]"
                                draggable={false}
                              />
                            ) : (
                              <FallbackIcon className={`h-10 w-10 ${iconCategory.iconClassName}`} />
                            )}
                          </span>
                          <span className="w-full truncate text-sm font-black text-slate-950">{entry.name.replace(/\.app$/, '')}</span>
                          <span className="mt-1 font-mono text-[11px] font-bold text-slate-500">{formatBytes(entry.size)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                treemapRects.map((rect) => {
                  const showDetails = rect.width > 12 && rect.height > 10;
                  const showLargeLabel = rect.width > 21 && rect.height > 15;
                  const iconCategory = getFileIconCategory(rect);
                  const RectIcon = iconCategory.icon;
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
                      className={`group absolute overflow-hidden rounded-[1.05rem] border-[2px] border-white/72 p-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.38),0_16px_44px_rgba(15,23,42,0.10)] transition duration-300 hover:z-10 hover:scale-[1.006] hover:shadow-[0_24px_62px_rgba(15,23,42,0.18)] ${!rect.is_dir || rect.isOther ? 'cursor-default hover:scale-100' : ''}`}
                      style={{
                        left: `${rect.x}%`,
                        top: `${rect.y}%`,
                        width: `${rect.width}%`,
                        height: `${rect.height}%`,
                        background: `linear-gradient(145deg, ${rect.color}, ${rect.color}df)`,
                      }}
                      title={`${rect.name} - ${formatBytes(rect.size)} - ${rect.percentage.toFixed(1)}%`}
                    >
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_26%_18%,rgba(255,255,255,0.26),transparent_42%)] opacity-90" />
                      {!showLargeLabel && (
                        <div className="absolute inset-x-2 top-2 z-[1] truncate rounded-md bg-black/12 px-1.5 py-0.5 text-[10px] font-black leading-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]">
                          {rect.name}
                        </div>
                      )}
                      {showDetails && (
                        <div className="relative flex h-full flex-col items-center justify-center text-center text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.35)]">
                          {showLargeLabel && (
                            <div className="mb-4 flex max-w-full items-center gap-2">
                              <RectIcon className="h-5 w-5 shrink-0" />
                              <span className="truncate text-xl font-black tracking-wide">{rect.name}</span>
                            </div>
                          )}
                          <div className="font-mono text-sm font-black tracking-wide sm:text-base">{formatBytes(rect.size)}</div>
                        </div>
                      )}
                    </button>
                  );
                })
              )}
            </div>
            {inlineScanPath && <AnalyzePanelLoadingOverlay />}
          </div>

          <div data-testid="disk-usage-list-panel" className="flex min-h-0 flex-col gap-5">
            <DiskUsageProportionGraph items={treemapItems} totalSize={result.total_size} isLoading={Boolean(inlineScanPath)} />

            <div className="relative min-h-[31rem] flex-1 overflow-hidden rounded-[1.35rem] xl:min-h-0">
              <div className="flex h-full min-h-0 flex-col">
                <div data-testid="file-list-summary" className="mb-4 flex items-center justify-between px-2 font-mono text-xs font-black text-slate-500">
                  <span>{sortedListEntries.length} items</span>
                  <span>{formatBytes(filteredSize)} total</span>
                </div>

                <div className="relative min-h-0 flex-1">
                  <div
                    ref={fileListScrollRef}
                    onScroll={updateFileListScrollShadows}
                    className="h-full overflow-hidden overflow-y-auto rounded-[1.35rem] pr-1 custom-scrollbar"
                  >
                    <div className={`min-h-full ${contentEnterClass}`}>
                      {filteredEntries.length === 0 ? (
                        <div className="flex h-full min-h-[20rem] flex-col items-center justify-center text-center">
                          <FolderOpen className="mb-3 h-12 w-12 text-slate-400" />
                          <p className="font-semibold text-slate-600">No entries match the current filters.</p>
                        </div>
                      ) : (
                        <div className="space-y-2.5 pb-2">
                          {sortedListEntries.map((entry) => {
                            const percentage = result.total_size > 0 ? (entry.size / result.total_size) * 100 : 0;
                            const entryDate = formatEntryDate(entry);
                            const iconCategory = getFileIconCategory(entry);
                            const EntryIcon = iconCategory.icon;
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
                                className={`group relative w-full overflow-hidden rounded-[1.35rem] border border-white/50 bg-white/30 p-3 text-left shadow-sm transition hover:bg-white/46 ${!entry.is_dir ? 'cursor-default' : ''}`}
                              >
                                <div
                                  className="absolute inset-y-0 left-0 rounded-[1.35rem] bg-violet-200/38 transition-[width] duration-300"
                                  style={{ width: `${Math.min(100, Math.max(3, percentage))}%` }}
                                />
                                <div className="relative flex items-center gap-3">
                                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/60 shadow-inner shadow-white/30 ${iconCategory.backgroundClassName}`} title={iconCategory.label}>
                                    <EntryIcon className={`h-[1.125rem] w-[1.125rem] ${iconCategory.iconClassName}`} />
                                  </span>
                                  <span className="min-w-0 flex-1">
                                    <span className="block truncate text-base font-black text-slate-950">{entry.name}</span>
                                    <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] font-bold text-slate-500">
                                      <span>{formatBytes(entry.size)}</span>
                                      {entryDate && <span>{entryDate}</span>}
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
                      )}
                    </div>
                  </div>
                  <div
                    className={`pointer-events-none absolute inset-x-0 top-0 h-8 rounded-t-[1.35rem] bg-gradient-to-b from-slate-900/7 to-transparent transition-opacity duration-200 ${fileListScrollShadows.top ? 'opacity-100' : 'opacity-0'}`}
                  />
                  <div
                    className={`pointer-events-none absolute inset-x-0 bottom-0 h-10 rounded-b-[1.35rem] bg-gradient-to-t from-slate-900/8 to-transparent transition-opacity duration-200 ${fileListScrollShadows.bottom ? 'opacity-100' : 'opacity-0'}`}
                  />
                </div>
              </div>
              {inlineScanPath && <AnalyzePanelLoadingOverlay />}
            </div>
          </div>
        </div>

        {contextMenu && createPortal(
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
              Move {contextMenu.item.is_dir ? 'Folder' : 'File'} to Trash
            </button>
          </div>,
          document.body,
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
