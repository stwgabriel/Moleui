import { useEffect, useMemo, useRef, useState, useCallback, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import {
  HardDrive, FolderOpen, File, BarChart3, Search,
  RefreshCw, X, ChevronRight, ChevronUp,
  AlertCircle, ArrowLeft, Folder, Trash2, ExternalLink,
  ListFilter, ChevronDown, Layers,
} from 'lucide-react';
import { toast } from 'sonner';
import { StartScreen } from '@/components/common/StartScreen';
import { StageTransition } from '@/components/common/StageTransition';
import { Button } from '@/components/ui/Button';
import { getFileIconCategory } from '@/lib/fileIcons';
import { featureAccentVars } from '@/lib/featureAccents';
import { formatBytes, stripAnsi } from '@/utils/format';
import { usePersistentState } from '@/utils/persistentState';
import { usePaywall } from '@/hooks/usePaywall';
import type { PageConfig, StorageVolume } from '@/types';

type Stage = 'idle' | 'scanning' | 'results' | 'error';
type NavigationAnimationDirection = 'down' | 'up';

const analyzeAccentStyle = featureAccentVars('analyze');

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
  systemOwned?: boolean;
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
  // Capacity of the volume the scanned path lives on. Absent (0) when statfs
  // is unavailable, in which case the usage graph falls back to showing the
  // directory total instead of the whole-disk proportion.
  disk_total?: number;
  disk_free?: number;
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

const TREEMAP_COLORS = [
  '#fb923c', '#0ea5e9', '#ef4444', '#3b82f6',
  '#a855f7', '#14b8a6', '#f59e0b', '#ec4899',
  '#22c55e', '#64748b', '#f97316', '#06b6d4',
];
// A treemap tile below roughly 0.4% of the total renders as a sliver a few
// pixels wide: too small to label, too small to aim at. Everything under that
// folds into a single tile so the tiles that matter stay legible.
//
// The threshold is a share of the parent total rather than a byte count. The
// old fixed 1 MB cut-off was noise inside a 500 GB volume and, in a source
// folder, larger than every file in it.
const TINY_TILE_SHARE = 0.004;
// The map subdivides down to slivers happily, so a handful of small tiles is
// fine to draw. Only a flood needs folding, and 12 is where the labels stop
// fitting and the map stops being readable.
const MIN_TINY_TILE_GROUP = 12;

// Size bands inside the small-items modal, biggest first. Absolute rather than
// relative: once you are looking at the folded pile, "under 1 MB" is the
// question you are actually asking.
// Size tiers for the folded pile, largest first. They nest rather than sit side
// by side: a level draws its own items plus one tile standing for everything
// smaller, and that tile zooms open into the next tier. Showing all four at once
// put a 200 MB file and a 4 KB file in the same picture, where the 4 KB file is
// a sliver either way.
const SMALL_ITEM_TIERS = [
  { key: 'gte100', label: '100 MB and up', min: 100 * 1024 * 1024 },
  { key: 'under100', label: 'Under 100 MB', min: 10 * 1024 * 1024 },
  { key: 'under10', label: 'Under 10 MB', min: 1024 * 1024 },
  { key: 'under1', label: 'Under 1 MB', min: 0 },
] as const;

const ZOOM_EASING = 'cubic-bezier(0.22, 0.61, 0.36, 1)';
const ZOOM_DURATION_MS = 420;
// The list renders every entry, but not all at once: a home folder with 8,000
// files was building 8,000 buttons on the first paint.
const LIST_PAGE_SIZE = 250;

function isApplicationsPath(path: string) {
  const cleanPath = path.replace(/\/+$/, '') || '/';
  return cleanPath === '/Applications' || cleanPath.endsWith('/Applications');
}

function isMacAppEntry(entry: Pick<AnalyzeEntry, 'path' | 'is_dir'>) {
  return entry.is_dir && entry.path.endsWith('.app');
}

// System locations the storage map can reach once a scan of "/" covers the whole
// OS. Trashing anything in here breaks the machine, so these rows get Finder
// access and nothing else. main.mjs refuses them too; this only keeps the menu
// from offering an action that would be rejected.
const SYSTEM_OWNED_PREFIXES = [
  '/System', '/private', '/usr', '/bin', '/sbin', '/etc', '/var', '/tmp',
  '/dev', '/cores', '/opt/homebrew', '/Library/Apple',
];

function isSystemOwnedPath(path: string) {
  return SYSTEM_OWNED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

// The top of a volume: "/" for the startup disk, "/Volumes/<name>" for the rest.
// Only there does comparing the scan total against the volume's used space mean
// anything.
function isVolumeRootPath(path: string) {
  const clean = path.replace(/\/+$/, '');
  return clean === '' || /^\/Volumes\/[^/]+$/.test(clean);
}

// Which volume a path belongs to, by longest matching mount point.
function volumeForPath(path: string, volumes: StorageVolume[]) {
  return volumes
    .filter((volume) => path === volume.path || path.startsWith(volume.path === '/' ? '/' : `${volume.path}/`))
    .sort((a, b) => b.path.length - a.path.length)[0];
}

function getPathDepth(path: string) {
  return path.split('/').filter(Boolean).length;
}

function sumSizes(items: Array<{ size: number }>) {
  return items.reduce((sum, item) => sum + Math.max(0, item.size), 0);
}

// groupTinyEntries folds unrenderably small entries into one tile. It applies to
// the map only. The list on the right keeps every entry, so nothing disappears:
// the previous version collapsed the list too, which meant a folder's small
// files could not be seen, sorted, or right-clicked at all.
//
// Directories count as well as files. A folder of a thousand tiny subfolders
// flooded the map exactly like a folder of tiny files, and only the files were
// ever grouped.
function groupTinyEntries(entries: AnalyzeEntry[], totalSize: number, resultPath: string) {
  const threshold = totalSize * TINY_TILE_SHARE;
  if (threshold <= 0) return { entries, groupedMembers: [] as AnalyzeEntry[] };

  const tiny = entries.filter((entry) => entry.size > 0 && entry.size < threshold);
  if (tiny.length < MIN_TINY_TILE_GROUP) return { entries, groupedMembers: [] as AnalyzeEntry[] };

  const tinyPaths = new Set(tiny.map((entry) => entry.path));
  const groupedEntry: AnalyzeEntry = {
    name: `${tiny.length.toLocaleString()} small items`,
    path: `${resultPath.replace(/\/$/, '') || '/'}/.mole-small-items`,
    size: sumSizes(tiny),
    is_dir: false,
    isGroupedSmallFiles: true,
  };

  return {
    entries: [...entries.filter((entry) => !tinyPaths.has(entry.path)), groupedEntry],
    groupedMembers: [...tiny].sort((a, b) => b.size - a.size),
  };
}

interface SmallItemTier {
  key: string;
  label: string;
  items: AnalyzeEntry[];
}

// Builds the tier chain the modal zooms through, dropping empty tiers so no
// level is a single full-screen tile that exists only to be clicked past.
function buildSmallItemTiers(items: AnalyzeEntry[]): SmallItemTier[] {
  return SMALL_ITEM_TIERS
    .map((tier, index) => {
      const ceiling = index === 0 ? Infinity : SMALL_ITEM_TIERS[index - 1].min;
      return {
        key: tier.key,
        label: tier.label,
        items: items
          .filter((item) => item.size >= tier.min && item.size < ceiling)
          .sort((a, b) => b.size - a.size),
      };
    })
    .filter((tier) => tier.items.length > 0);
}

// Start transforms for the zoom. Both directions map a tile rect to the full
// view, so entering and leaving a level are the same motion reversed.
//
// transform-origin sits at 0 0 and translate percentages resolve against the
// element's own box, which is the full container, so a translate of R.x% moves
// by R.x% of the container width.
function zoomInTransform(rect: { x: number; y: number; width: number; height: number }) {
  return `translate(${rect.x}%, ${rect.y}%) scale(${rect.width / 100}, ${rect.height / 100})`;
}

function zoomOutTransform(rect: { x: number; y: number; width: number; height: number }) {
  const scaleX = 100 / Math.max(rect.width, 0.01);
  const scaleY = 100 / Math.max(rect.height, 0.01);
  return `translate(${-rect.x * scaleX}%, ${-rect.y * scaleY}%) scale(${scaleX}, ${scaleY})`;
}

function buildTreemapItems(
  entries: AnalyzeEntry[],
  totalSize: number,
  resultPath: string,
  remainderTotal = totalSize,
  remainderName = 'Other',
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
      name: remainderName,
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
  diskTotal = 0,
  diskFree = 0,
  isLoading = false,
  atVolumeRoot = false,
}: {
  items: TreemapItem[];
  totalSize: number;
  diskTotal?: number;
  diskFree?: number;
  isLoading?: boolean;
  atVolumeRoot?: boolean;
}) {
  const visibleItems = items.filter((item) => item.size > 0).slice(0, 8);

  if (visibleItems.length === 0 || totalSize <= 0) {
    return null;
  }

  // Whole-disk view: show this folder's footprint as a proportion of the
  // entire volume. Falls back to a directory-relative view when the volume
  // capacity is unknown (e.g. tests, or statfs failures).
  const hasDisk = diskTotal > 0 && diskFree >= 0 && diskFree <= diskTotal && totalSize <= diskTotal;
  const folderSize = totalSize;
  const diskUsed = Math.max(0, diskTotal - diskFree);
  const otherUsed = hasDisk ? Math.max(0, diskUsed - folderSize) : 0;
  const folderPctOfDisk = hasDisk ? (folderSize / diskTotal) * 100 : 0;

  const denominator = hasDisk ? diskTotal : folderSize;
  const segments = [
    ...visibleItems.map((item) => ({
      key: item.path,
      name: item.name,
      bytes: item.size,
      pct: denominator > 0 ? (item.size / denominator) * 100 : 0,
      background: `linear-gradient(135deg, ${item.color}, ${item.color}dd)`,
      swatch: item.color,
      muted: false,
    })),
    ...(hasDisk && otherUsed > 0 ? [{
      key: '__disk_other__',
      // Inside a subfolder this really is other files. At the top of a volume
      // there is nothing else to attribute it to, so name what it actually is.
      name: atVolumeRoot ? 'Snapshots and folders Mole cannot read' : 'Used by other files',
      bytes: otherUsed,
      pct: (otherUsed / denominator) * 100,
      background: 'linear-gradient(135deg, rgba(100,116,139,0.50), rgba(100,116,139,0.34))',
      swatch: 'rgba(100,116,139,0.55)',
      muted: true,
    }] : []),
    ...(hasDisk && diskFree > 0 ? [{
      key: '__disk_free__',
      name: 'Free space',
      bytes: diskFree,
      pct: (diskFree / denominator) * 100,
      background: 'var(--disk-free-fill, rgba(255,255,255,0.62))',
      swatch: 'var(--disk-free-swatch, rgba(148,163,184,0.4))',
      muted: true,
    }] : []),
  ];

  return (
    <div className="rounded-[1.35rem] border border-white/55 bg-white/42 p-5 shadow-[0_18px_54px_rgba(109,93,252,0.10),inset_0_1px_0_rgba(255,255,255,0.72)] backdrop-blur-2xl dark:border-white/10 dark:bg-slate-900/55 dark:shadow-[0_18px_54px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.08)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="text-[0.78rem] font-black uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Disk usage</div>
        <div className="shrink-0 font-mono text-[11px] font-black text-slate-600 dark:text-slate-300">
          {hasDisk ? `${formatBytes(diskTotal)} disk` : `Total ${formatBytes(totalSize)}`}
        </div>
      </div>
      <div
        aria-label="Disk usage proportions"
        className="relative flex h-6 overflow-hidden rounded-full bg-slate-900/10 shadow-inner shadow-slate-900/10 dark:bg-white/10"
      >
        {segments.map((segment) => {
          const showInlineLabel = segment.pct >= 9 && !segment.muted;

          return (
            <div
              key={segment.key}
              className="flex min-w-[2px] items-center justify-center overflow-hidden border-r border-white/60 px-1 text-center last:border-r-0"
              style={{
                width: `${Math.max(0.6, segment.pct)}%`,
                background: segment.background,
              }}
              title={`${segment.name} - ${formatBytes(segment.bytes)} - ${segment.pct.toFixed(1)}%`}
            >
              {showInlineLabel && (
                <span className="truncate text-[10px] font-black leading-none text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.38)]">
                  {formatBytes(segment.bytes)}
                </span>
              )}
            </div>
          );
        })}
        {isLoading && <div className="analyze-disk-usage-flow" />}
      </div>

      {hasDisk && (
        <div className="mt-4 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[0.66rem] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">This folder</div>
            <div className="mt-0.5 truncate text-sm font-black text-slate-900 dark:text-slate-100">
              {formatBytes(folderSize)}
              <span className="ml-1.5 font-mono text-[11px] font-black text-[var(--page-accent)]">
                {folderPctOfDisk < 0.1 ? '<0.1' : folderPctOfDisk.toFixed(folderPctOfDisk < 10 ? 1 : 0)}% of disk
              </span>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-[0.66rem] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Free</div>
            <div className="mt-0.5 font-mono text-sm font-black text-slate-700 dark:text-slate-200">{formatBytes(diskFree)}</div>
          </div>
        </div>
      )}

      <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-3 xl:grid-cols-4">
        {visibleItems.slice(0, 4).map((item) => (
          <div key={item.path} className="flex min-w-0 items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: item.color }} />
            <span className="truncate text-xs font-black text-slate-700 dark:text-slate-200">{item.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// SmallItemsModal opens the folded tile back up, one size tier at a time.
//
// Each level draws the items it owns plus a single tile for everything smaller.
// Clicking that tile zooms into it: the next level starts at the tile's exact
// rectangle and grows to fill the view, so the tile you picked visibly becomes
// the screen. Back reverses the same motion, and at the outermost level it
// closes the modal, which puts you back on the folder map.
function SmallItemsModal({
  items,
  parentPath,
  originRect,
  onClose,
  onOpenContextMenu,
}: {
  items: AnalyzeEntry[];
  parentPath: string;
  originRect?: { x: number; y: number; width: number; height: number };
  onClose: () => void;
  onOpenContextMenu: (event: MouseEvent, item: FileActionItem) => void;
}) {
  const tiers = useMemo(() => buildSmallItemTiers(items), [items]);
  const [depth, setDepth] = useState(0);
  // The transform a level starts from. Cleared on the next frame, which is what
  // makes the transition run.
  const [zoomFrom, setZoomFrom] = useState<string | null>(
    originRect ? zoomInTransform(originRect) : null,
  );
  // The rect each level was entered through, so leaving a level shrinks back
  // out through the same rectangle. The current level's own nested tile is a
  // different rect and would zoom out through the wrong place.
  const enteredThroughRef = useRef<Array<{ x: number; y: number; width: number; height: number }>>([]);

  const tier = tiers[Math.min(depth, Math.max(tiers.length - 1, 0))];
  const deeperTiers = tiers.slice(depth + 1);
  const nestedSize = sumSizes(deeperTiers.flatMap((entry) => entry.items));
  const nestedCount = deeperTiers.reduce((count, entry) => count + entry.items.length, 0);
  const nestedLabel = tiers[depth + 1]?.label ?? '';

  const rects = useMemo(() => {
    if (!tier) return [];

    const source: TreemapItem[] = tier.items.map((item, index) => ({
      ...item,
      color: TREEMAP_COLORS[index % TREEMAP_COLORS.length],
      percentage: 0,
    }));

    if (nestedCount > 0) {
      source.push({
        name: nestedLabel,
        path: `${parentPath}#${tiers[depth + 1].key}`,
        size: nestedSize,
        is_dir: false,
        isGroupedSmallFiles: true,
        color: '#64748b',
        percentage: 0,
      });
    }

    const total = sumSizes(source) || 1;
    return createTreemapLayout(source.map((item) => ({ ...item, percentage: (item.size / total) * 100 })));
  }, [depth, nestedCount, nestedLabel, nestedSize, parentPath, tier, tiers]);

  // Two frames: the first paints the start transform with transitions off, the
  // second clears it so the browser animates back to identity.
  useEffect(() => {
    if (!zoomFrom) return;
    const frame = requestAnimationFrame(() => requestAnimationFrame(() => setZoomFrom(null)));
    return () => cancelAnimationFrame(frame);
  }, [zoomFrom]);

  const goDeeper = (rect: { x: number; y: number; width: number; height: number }) => {
    if (nestedCount === 0) return;
    enteredThroughRef.current.push({ x: rect.x, y: rect.y, width: rect.width, height: rect.height });
    setZoomFrom(zoomInTransform(rect));
    setDepth((current) => current + 1);
  };

  // Back unwinds one tier, or leaves the modal entirely at the outermost one, so
  // repeated Back always ends up on the folder map.
  const goBack = () => {
    if (depth === 0) {
      onClose();
      return;
    }
    const enteredThrough = enteredThroughRef.current.pop();
    setZoomFrom(zoomOutTransform(enteredThrough ?? { x: 0, y: 0, width: 100, height: 100 }));
    setDepth((current) => current - 1);
  };

  // No dependency array on purpose: goBack closes over depth, and re-subscribing
  // each render is what keeps Escape unwinding from the level actually on screen.
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') goBack();
    };

    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  });

  if (!tier) return null;

  const shownSize = sumSizes(tier.items) + nestedSize;
  const shownCount = tier.items.length + nestedCount;
  const trail = tiers.slice(0, depth + 1);

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/40 p-6 backdrop-blur-sm dark:bg-slate-950/65"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="Small items"
        className="flex h-[min(46rem,88vh)] w-[min(64rem,92vw)] flex-col rounded-[1.75rem] border border-white/60 bg-white/92 p-5 shadow-[0_30px_90px_rgba(15,23,42,0.28)] backdrop-blur-2xl dark:border-white/10 dark:bg-slate-900/90 dark:shadow-[0_30px_90px_rgba(0,0,0,0.65)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center gap-3">
          <button
            type="button"
            onClick={goBack}
            data-testid="small-items-back"
            title={depth === 0 ? 'Back to folder' : `Back to ${tiers[depth - 1].label}`}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-900/5 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-200"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1 text-[0.66rem] font-black uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
              <span className="shrink-0">{parentPath === '/' ? 'Disk' : parentPath.split('/').filter(Boolean).slice(-1)[0]}</span>
              {trail.map((entry) => (
                <span key={entry.key} className="flex shrink-0 items-center gap-1">
                  <ChevronRight className="h-3 w-3 opacity-60" />
                  <span>{entry.label}</span>
                </span>
              ))}
            </div>
            <div className="mt-0.5 truncate text-xl font-black text-slate-950 dark:text-slate-100">
              {shownCount.toLocaleString()} items
              <span className="ml-2 font-mono text-sm font-black text-[var(--page-accent)]">{formatBytes(shownSize)}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close small items"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-900/5 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="relative min-h-0 flex-1 overflow-hidden rounded-[1.35rem]">
          <div
            className="absolute inset-0"
            style={{
              transformOrigin: '0 0',
              transform: zoomFrom ?? 'translate(0%, 0%) scale(1, 1)',
              opacity: zoomFrom ? 0.2 : 1,
              transition: zoomFrom
                ? 'none'
                : `transform ${ZOOM_DURATION_MS}ms ${ZOOM_EASING}, opacity ${Math.round(ZOOM_DURATION_MS * 0.8)}ms ease-out`,
            }}
          >
            {rects.map((rect) => {
              const isNested = Boolean(rect.isGroupedSmallFiles);
              const showLabel = rect.width > 13 && rect.height > 10;
              const iconCategory = getFileIconCategory(rect);
              const RectIcon = iconCategory.icon;

              return (
                <button
                  key={rect.path}
                  type="button"
                  data-testid={isNested ? 'small-items-nested' : 'small-items-entry'}
                  onContextMenu={(event) => {
                    if (isNested) return;
                    onOpenContextMenu(event, { name: rect.name, path: rect.path, size: rect.size, is_dir: rect.is_dir });
                  }}
                  onClick={() => {
                    if (isNested) goDeeper(rect);
                  }}
                  className={`group absolute overflow-hidden rounded-[0.9rem] border-[2px] border-white/72 p-2 text-left transition-transform duration-200 hover:z-10 dark:border-slate-950/60 ${isNested ? 'hover:scale-[1.01]' : 'cursor-default'}`}
                  style={{
                    left: `${rect.x}%`,
                    top: `${rect.y}%`,
                    width: `${rect.width}%`,
                    height: `${rect.height}%`,
                    background: isNested
                      ? 'linear-gradient(145deg, rgba(100,116,139,0.92), rgba(71,85,105,0.92))'
                      : `linear-gradient(145deg, ${rect.color}, ${rect.color}df)`,
                  }}
                  title={isNested
                    ? `${rect.name} - ${formatBytes(rect.size)} - ${nestedCount.toLocaleString()} items, click to zoom in`
                    : `${rect.name} - ${formatBytes(rect.size)}`}
                >
                  {showLabel && (
                    <span className="flex h-full flex-col items-center justify-center gap-1 text-center text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]">
                      <span className="flex max-w-full items-center gap-1.5">
                        {isNested ? <Layers className="h-3.5 w-3.5 shrink-0" /> : <RectIcon className="h-3.5 w-3.5 shrink-0" />}
                        <span className="truncate text-xs font-black">{rect.name}</span>
                      </span>
                      <span className="font-mono text-[11px] font-black">{formatBytes(rect.size)}</span>
                      {isNested && rect.width > 22 && rect.height > 18 && (
                        <span className="text-[10px] font-black uppercase tracking-[0.18em] opacity-80">
                          {nestedCount.toLocaleString()} items
                        </span>
                      )}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <p className="mt-3 shrink-0 px-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
          {nestedCount > 0
            ? `Right-click an item for Finder or Trash. Open ${nestedLabel} to zoom into the smaller ones.`
            : 'Right-click an item to reveal it in Finder or move it to the Trash.'}
        </p>
      </div>
    </div>,
    document.body,
  );
}

function AnalyzePanelLoadingOverlay() {
  return (
    <div className="analyze-panel-loading-overlay absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 rounded-[1.35rem] p-6 text-center" aria-live="polite">
      <div className="analyze-apple-spinner" aria-label="Loading folder" role="status">
        {Array.from({ length: 8 }, (_, index) => (
          <span key={index} style={{ transform: `rotate(${index * 45}deg) translateY(-1.28rem)` }} />
        ))}
      </div>
      <span className="text-[0.7rem] font-black uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Reading folder</span>
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
  // Paths already asked about, resolved or not. See the icon effect below.
  const attemptedAppIconsRef = useRef<Set<string>>(new Set());
  const fileListScrollRef = useRef<HTMLDivElement | null>(null);
  const [fileListScrollShadows, setFileListScrollShadows] = useState({ top: false, bottom: false });
  const [volumes, setVolumes] = useState<StorageVolume[]>([]);
  const [isVolumeMenuOpen, setIsVolumeMenuOpen] = useState(false);
  const [isSmallItemsOpen, setIsSmallItemsOpen] = useState(false);
  const [panelMode, setPanelMode] = usePersistentState<'map' | 'files'>('mole-analyze-panel-mode', 'map');
  const [visibleListCount, setVisibleListCount] = useState(LIST_PAGE_SIZE);
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

  // Volume list for the disk switcher. This is a statfs read, so it is cheap
  // enough to refresh whenever the page comes back to results and pick up a
  // drive the user plugged in while looking at something else.
  useEffect(() => {
    if (stage !== 'results' && !(stage === 'idle' && view === 'pick')) return;

    let cancelled = false;
    void window.moleDesktop?.analyze?.volumes?.()
      ?.then((res) => {
        if (cancelled || !res?.ok) return;
        setVolumes(res.volumes);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [stage, view, result?.path]);

  useEffect(() => {
    setVisibleListCount(LIST_PAGE_SIZE);
    setIsSmallItemsOpen(false);
  }, [result?.path, showFiles, showFolders]);

  useEffect(() => {
    if (!isVolumeMenuOpen) return;

    const closeMenu = () => setIsVolumeMenuOpen(false);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenu();
    };

    window.addEventListener('click', closeMenu);
    window.addEventListener('blur', closeMenu);
    window.addEventListener('keydown', closeOnEscape);

    return () => {
      window.removeEventListener('click', closeMenu);
      window.removeEventListener('blur', closeMenu);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [isVolumeMenuOpen]);

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

  // Resolve app icons for /Applications views.
  //
  // Every path that comes back without an icon is recorded so it is never asked
  // for again. Without that, an app whose icon cannot be read keeps appearing in
  // missingAppPaths, and because the effect depends on appIcons it re-fires the
  // moment setAppIcons produces a new object. That loop ran unbounded on a
  // folder of unreadable icons: 257,000 IPC round trips in twenty minutes.
  useEffect(() => {
    if (stage !== 'results' || !result || !isApplicationsPath(result.path)) return;

    const appPaths = result.entries.filter(isMacAppEntry).map((entry) => entry.path);
    const missingAppPaths = appPaths.filter((path) => !appIcons[path] && !attemptedAppIconsRef.current.has(path));
    if (missingAppPaths.length === 0) return;

    missingAppPaths.forEach((path) => attemptedAppIconsRef.current.add(path));

    let cancelled = false;

    void window.moleDesktop.uninstall.getAppIcons(missingAppPaths)
      .then((iconResult) => {
        if (cancelled || !iconResult?.ok) return;
        if (Object.keys(iconResult.icons).length === 0) return;
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
          const resolved = icons.filter((icon): icon is readonly [string, string] => icon !== null);
          if (resolved.length === 0) return;
          setAppIcons((currentIcons) => {
            const nextIcons = { ...currentIcons };
            resolved.forEach(([iconPath, icon]) => {
              nextIcons[iconPath] = icon;
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
    const targetPath = path ?? (pathInput.trim() || '/');
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
        setScanPath(targetPath);
        setPathInput(targetPath);
        setResult(cached);
        setStage('results');
        return;
      }
    }

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

  const selectAnalyzePath = (nextPath: string) => {
    setScanPath(nextPath);
    setPathInput(nextPath);
  };

  // Disks for the picker. Until the volume list arrives, offer the startup disk
  // so the page is never empty and the primary action always works.
  const pickerDisks: StorageVolume[] = volumes.length > 0
    ? volumes
    : [{ name: 'Startup disk', path: '/', fs_type: '', total: 0, free: 0, used: 0, is_root: true, read_only: false }];

  const openItemContextMenu = (event: MouseEvent, item: FileActionItem & { isOther?: boolean; isGroupedSmallFiles?: boolean }) => {
    if (item.isOther || item.isGroupedSmallFiles) return;
    event.preventDefault();
    event.stopPropagation();

    const systemOwned = isSystemOwnedPath(item.path);
    const menuWidth = 220;
    const menuHeight = systemOwned ? 60 : 110;
    setContextMenu({
      x: Math.min(event.clientX, Math.max(12, window.innerWidth - menuWidth)),
      y: Math.min(event.clientY, Math.max(12, window.innerHeight - menuHeight)),
      item: {
        name: item.name,
        path: item.path,
        size: item.size,
        is_dir: item.is_dir,
        systemOwned,
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

  // Derive the results data — including the recursive treemap layout, the most
  // expensive computation on this page — only when the scan result or the
  // file/folder visibility filters change. Without this memo it recomputed on
  // every render, so unrelated state updates (scroll-shadow tracking on the file
  // list, scan-progress ticks, opening the context menu) re-ran the whole
  // treemap layout each frame and made the page stutter.
  const resultsView = useMemo(() => {
    if (stage !== 'results' || !result) return null;
    const entries = [...(result.entries ?? [])].sort((a, b) => b.size - a.size);
    const fileCount = entries.filter((entry) => !entry.is_dir).length;
    const folderCount = entries.length - fileCount;
    const filteredEntries = entries.filter((entry) => (entry.is_dir ? showFolders : showFiles));
    // The list keeps every entry; only the map collapses the unrenderable ones.
    const sortedListEntries = filteredEntries;
    const filteredSize = sumSizes(filteredEntries);

    // At the top of a volume, scale the map against what the volume actually
    // holds instead of against what the scan could read. The two differ by more
    // than a rounding error: APFS snapshots, the recovery and swap volumes, and
    // folders this app has no permission to open are all real used space that
    // no scanned entry accounts for. Measured on a stock macOS 15 install, that
    // gap was 71 GB of 209 GB used. Scaling against the scan total hid it and
    // implied the map was complete.
    const diskUsed = Math.max(0, (result.disk_total ?? 0) - (result.disk_free ?? 0));
    const isVolumeRoot = isVolumeRootPath(result.path);
    const showsUnaccounted = isVolumeRoot && diskUsed > filteredSize;
    const remainderTotal = showsUnaccounted ? diskUsed : filteredSize;
    const remainderName = showsUnaccounted ? 'Snapshots & unreadable' : 'Other';

    const { entries: groupedEntries, groupedMembers } = groupTinyEntries(filteredEntries, remainderTotal, result.path);
    const treemapItems = buildTreemapItems(groupedEntries, remainderTotal, result.path, remainderTotal, remainderName);
    const treemapRects = createTreemapLayout(treemapItems);
    // The list bars divide by the same number the map does, so one entry cannot
    // read 52% in the list and 34% in its tile.
    return { fileCount, folderCount, filteredEntries, sortedListEntries, filteredSize, remainderTotal, groupedMembers, treemapItems, treemapRects };
  }, [stage, result, showFolders, showFiles]);

  // Group views so the start screen, path picker, and the scanning/results
  // surface crossfade between each other, while transitions *within* the
  // scanning/results surface keep their own (analyze-content-enter) animations.
  const viewKey = stage === 'idle' ? (view === 'start' ? 'start' : 'pick') : 'feature';

  const renderStage = () => {
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
      <div className="relative h-full min-h-0 overflow-y-auto bg-[#fbf9ff] px-[clamp(1.25rem,3vw,4rem)] pb-[clamp(1.25rem,3vw,3rem)] pt-[clamp(1.5rem,3.8vw,4rem)] text-slate-950 dark:bg-[#0e0c1d] dark:text-slate-100" style={analyzeAccentStyle}>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_26%_14%,rgba(var(--page-accent-rgb),0.08),transparent_28%),radial-gradient(circle_at_80%_12%,rgba(109,93,252,0.08),transparent_28%),linear-gradient(135deg,rgba(255,255,255,0.78),rgba(247,243,255,0.58))] dark:bg-[radial-gradient(circle_at_26%_14%,rgba(var(--page-accent-rgb),0.12),transparent_30%),radial-gradient(circle_at_80%_12%,rgba(109,93,252,0.14),transparent_30%),linear-gradient(135deg,rgba(10,8,24,0.85),rgba(17,13,36,0.66))]" />

        <div className="relative flex min-h-full items-center justify-center text-center">
          <main className="flex w-full max-w-[56rem] flex-col items-center">
            <div className="relative flex h-[clamp(5rem,8vw,6.5rem)] w-[clamp(5rem,8vw,6.5rem)] items-center justify-center rounded-full bg-white/78 text-[var(--page-accent)] shadow-[0_24px_76px_rgba(83,76,148,0.14),0_0_0_10px_rgba(var(--page-accent-rgb),0.08)] backdrop-blur-2xl dark:bg-slate-900/65">
              <span className="absolute inset-[-0.38rem] rounded-full border-2 border-[rgba(var(--page-accent-rgb),0.18)] border-r-[var(--page-accent)] border-t-[var(--page-accent-hover)]" aria-hidden="true" />
              <BarChart3 className="relative h-[42%] w-[42%]" strokeWidth={2.6} />
            </div>

            <h1 className="mt-7 text-[clamp(2.6rem,5.8vw,5.6rem)] font-black leading-[0.9] tracking-[-0.06em] text-slate-950 dark:text-slate-100">
              Choose scan location.
            </h1>
            <p className="mt-5 max-w-[35rem] text-[clamp(1.05rem,1.55vw,1.35rem)] font-semibold leading-relaxed text-slate-500 dark:text-slate-400">
              Pick a disk and Mole will map everything on it. Any folder works too, if you already know where to look.
            </p>

            <div className="mt-8 w-full rounded-[1.75rem] border border-white/60 bg-white/42 p-[clamp(1rem,2vw,1.4rem)] shadow-[0_24px_76px_rgba(83,76,148,0.12),inset_0_1px_0_rgba(255,255,255,0.72)] backdrop-blur-2xl dark:border-white/10 dark:bg-slate-900/55 dark:shadow-[0_24px_76px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.08)]">
              <div className={`grid grid-cols-1 gap-3 ${pickerDisks.length > 2 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
                {pickerDisks.map((disk) => {
                  const isSelected = pathInput === disk.path;
                  const usedPct = disk.total > 0 ? (disk.used / disk.total) * 100 : 0;

                  return (
                    <button
                      key={disk.path}
                      onClick={() => selectAnalyzePath(disk.path)}
                      className={`group flex min-h-[9.5rem] flex-col items-center justify-center gap-3 rounded-[1.35rem] border p-4 transition-all ${isSelected
                        ? 'border-[rgba(var(--page-accent-rgb),0.42)] bg-white/78 text-[var(--page-accent)] shadow-[0_18px_48px_rgba(var(--page-accent-rgb),0.16)] ring-1 ring-[rgba(var(--page-accent-rgb),0.18)] dark:bg-slate-900/65'
                        : 'border-white/52 bg-white/36 text-slate-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.58)] hover:bg-white/62 hover:text-slate-800 hover:shadow-[0_14px_38px_rgba(83,76,148,0.10)] dark:border-white/10 dark:bg-slate-900/45 dark:text-slate-400 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] dark:hover:bg-white/10 dark:hover:text-slate-200'
                        }`}
                    >
                      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/68 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] transition-transform group-hover:scale-105 dark:bg-white/10 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                        <HardDrive className="h-5 w-5" />
                      </span>
                      <span className="max-w-full truncate text-sm font-black">{disk.name}</span>
                      {disk.total > 0 ? (
                        <>
                          <span className="h-1.5 w-4/5 overflow-hidden rounded-full bg-slate-900/10 dark:bg-white/10">
                            <span
                              className="block h-full rounded-full bg-current opacity-70"
                              style={{ width: `${Math.min(100, Math.max(2, usedPct))}%` }}
                            />
                          </span>
                          <span className="font-mono text-[11px] font-black opacity-60">
                            {formatBytes(disk.free)} free of {formatBytes(disk.total)}
                          </span>
                        </>
                      ) : (
                        <span className="max-w-full truncate font-mono text-[11px] font-black opacity-60">{disk.path}</span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 rounded-[1.35rem] border border-white/58 bg-white/52 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] dark:border-white/10 dark:bg-slate-900/50 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]">
                <label className="mb-2 block px-1 text-left text-[0.68rem] font-black uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                  Custom path
                </label>
                <div className="relative">
                  <Folder className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                  <input
                    type="text"
                    value={pathInput}
                    onChange={(e) => {
                      const nextPath = e.target.value;
                      setPathInput(nextPath);
                      setScanPath(nextPath);
                    }}
                    placeholder="/path/to/folder"
                    className="w-full rounded-full border border-white/70 bg-white/76 py-3 pl-11 pr-4 font-mono text-sm font-black text-slate-700 shadow-[0_10px_30px_rgba(83,76,148,0.08)] transition-all placeholder:text-slate-400 focus:border-[var(--page-accent)] focus:outline-none focus:ring-4 focus:ring-[rgba(var(--page-accent-rgb),0.14)] dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-200 dark:placeholder:text-slate-500"
                  />
                </div>
              </div>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <Button variant="secondary" onClick={reset} className="flex-1 rounded-full border border-white/70 bg-white/70 py-3 text-slate-600 shadow-[0_10px_30px_rgba(83,76,148,0.08)] hover:bg-white dark:border-white/10 dark:bg-slate-900/55 dark:text-slate-300 dark:hover:bg-slate-800">
                  Cancel
                </Button>
                <Button onClick={() => startScan()} className="flex-1 gap-2 rounded-full py-3 shadow-[0_16px_42px_rgba(var(--page-accent-rgb),0.22)]">
                  <Search className="h-4 w-4" />
                  Start Analysis
                </Button>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  // ── Scanning ─────────────────────────────────────────────────────────────
  if (stage === 'scanning') {
    return (
      <div className="relative h-full min-h-0 overflow-hidden bg-[#fbf9ff] px-[clamp(1.25rem,3vw,4rem)] pb-[clamp(0.85rem,1.65vw,1.75rem)] pt-[clamp(1.25rem,2.4vw,2.5rem)] text-slate-950 dark:bg-[#0e0c1d] dark:text-slate-100" style={analyzeAccentStyle}>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_26%_14%,rgba(var(--page-accent-rgb),0.08),transparent_28%),radial-gradient(circle_at_80%_12%,rgba(109,93,252,0.08),transparent_28%),linear-gradient(135deg,rgba(255,255,255,0.78),rgba(247,243,255,0.58))] dark:bg-[radial-gradient(circle_at_26%_14%,rgba(var(--page-accent-rgb),0.12),transparent_30%),radial-gradient(circle_at_80%_12%,rgba(109,93,252,0.14),transparent_30%),linear-gradient(135deg,rgba(10,8,24,0.85),rgba(17,13,36,0.66))]" />

        <div className="relative flex h-full min-h-0 items-center justify-center text-center">
          <main className="flex w-full max-w-[42rem] flex-col items-center">
            <div className="relative flex h-[clamp(5rem,8vw,6.5rem)] w-[clamp(5rem,8vw,6.5rem)] items-center justify-center rounded-full bg-white/78 text-[var(--page-accent)] shadow-[0_24px_76px_rgba(83,76,148,0.14),0_0_0_10px_rgba(var(--page-accent-rgb),0.08)] backdrop-blur-2xl dark:bg-slate-900/65">
              <span className="absolute inset-[-0.38rem] rounded-full border-2 border-[rgba(var(--page-accent-rgb),0.18)] border-r-[var(--page-accent)] border-t-[var(--page-accent-hover)] animate-spin" aria-hidden="true" />
              <Search className="relative h-[42%] w-[42%]" strokeWidth={2.6} />
            </div>

            <h1 className="mt-7 text-[clamp(2.6rem,5.8vw,5.6rem)] font-black leading-[0.9] tracking-[-0.06em] text-slate-950 dark:text-slate-100">
              Reading storage.
            </h1>
            <p className="mt-5 max-w-[34rem] text-[clamp(1.05rem,1.55vw,1.35rem)] font-semibold leading-relaxed text-slate-500 dark:text-slate-400">
              Mole is scanning this location for the first time and building the storage map.
            </p>

            <div className="mt-7 w-full max-w-[32rem] space-y-3">
              <div className="truncate rounded-full bg-white/70 px-4 py-2 font-mono text-sm font-black text-slate-500 shadow-[0_10px_30px_rgba(83,76,148,0.08)] dark:bg-slate-900/60 dark:text-slate-400">
                {scanPath}
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/70 shadow-inner shadow-white/50 dark:bg-white/10 dark:shadow-black/40">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[rgba(var(--page-accent-rgb),0.70)] to-[var(--page-accent)] transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex items-center justify-between gap-4 text-xs font-bold text-slate-400 dark:text-slate-500">
              <span className="truncate">{currentFile || 'Reading storage...'}</span>
              <span>{Math.round(progress)}%</span>
            </div>
          </div>

            <div className="mt-8">
              <Button variant="secondary" onClick={stopScan} size="lg" className="min-w-[min(260px,42vw)] rounded-full border border-white/70 bg-white/70 px-[clamp(2rem,3vw,2.5rem)] py-[clamp(0.85rem,1.25vw,1rem)] text-[clamp(0.95rem,1.25vw,1.25rem)] text-slate-600 shadow-[0_10px_30px_rgba(83,76,148,0.08)] hover:bg-white dark:border-white/10 dark:bg-slate-900/55 dark:text-slate-300 dark:hover:bg-slate-800 [&_svg]:h-[clamp(1rem,1.35vw,1.25rem)] [&_svg]:w-[clamp(1rem,1.35vw,1.25rem)]">
                <X className="w-4 h-4" />
                Cancel
              </Button>
            </div>
          </main>
        </div>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (stage === 'error') {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8" style={analyzeAccentStyle}>
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
  if (stage === 'results' && result && resultsView) {
    const { fileCount, folderCount, filteredEntries, sortedListEntries, filteredSize, remainderTotal, groupedMembers, treemapItems, treemapRects } = resultsView;
    const breadcrumbs = buildBreadcrumbs();
    const canGoUp = result.path !== '/';
    const pathParts = result.path.split('/').filter(Boolean);
    const currentPathLabel = result.path === '/' ? 'Macintosh HD' : pathParts[pathParts.length - 1] ?? result.path;
    const isViewingApplications = isApplicationsPath(result.path);
    const applicationEntries = sortedListEntries.filter(isMacAppEntry);
    const activeVolume = volumeForPath(result.path, volumes);
    const largeFiles = result.large_files ?? [];
    const showingBiggestFiles = panelMode === 'files' && largeFiles.length > 0;
    const pagedListEntries = sortedListEntries.slice(0, visibleListCount);
    const hiddenListCount = sortedListEntries.length - pagedListEntries.length;
    const isContentEntering = enteringResultPath === result.path;
    const contentEnterClass = isContentEntering
      ? enteringResultDirection === 'up' ? 'analyze-content-enter-up' : 'analyze-content-enter-down'
      : '';

    return (
      <div className="relative h-full overflow-y-auto p-6 xl:overflow-hidden" style={analyzeAccentStyle}>
        {/* Breadcrumb navigation bar */}
        <div className="relative z-50 mb-7 flex items-center gap-2 rounded-full border border-white/55 bg-white/28 px-4 py-3 shadow-[0_16px_48px_rgba(109,93,252,0.08),inset_0_1px_0_rgba(255,255,255,0.72)] backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/[0.35] dark:shadow-[0_16px_48px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.07)]">
          <button
            type="button"
            onClick={navigateBack}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-white/45 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-200"
            title={navHistory.length > 0 ? 'Go back' : 'Back to start'}
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          {canGoUp && (
            <button
              type="button"
              onClick={navigateUp}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-white/45 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-200"
              title="Go to parent folder"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
          )}
          <div className="mx-1 h-5 w-px shrink-0 bg-slate-300/60 dark:bg-white/15" />
          <div className="relative shrink-0">
            <button
              type="button"
              aria-label="Switch disk"
              aria-expanded={isVolumeMenuOpen}
              disabled={volumes.length < 2}
              title={volumes.length < 2 ? currentPathLabel : 'Switch disk'}
              onClick={(event) => {
                event.stopPropagation();
                setIsVolumeMenuOpen((open) => !open);
              }}
              className="flex items-center gap-2 rounded-full px-2 py-1 text-sm font-black text-slate-600 transition hover:bg-white/45 disabled:cursor-default disabled:hover:bg-transparent dark:text-slate-300 dark:hover:bg-white/10"
            >
              <HardDrive className="h-4 w-4" />
              <span className="max-w-[10rem] truncate">{activeVolume?.name ?? currentPathLabel}</span>
              {volumes.length > 1 && <ChevronDown className="h-3.5 w-3.5 opacity-60" />}
            </button>

            {isVolumeMenuOpen && (
              <div
                className="absolute left-0 top-11 z-[90] w-80 rounded-[1.35rem] border border-white/65 bg-white/90 p-2 shadow-[0_24px_70px_rgba(15,23,42,0.22)] backdrop-blur-2xl dark:border-white/10 dark:bg-slate-900/85 dark:shadow-[0_24px_70px_rgba(0,0,0,0.55)]"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="mb-2 px-2 pt-1 text-[0.66rem] font-black uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                  Disks
                </div>
                {volumes.map((volume) => {
                  const isActive = activeVolume?.path === volume.path;
                  const usedPct = volume.total > 0 ? (volume.used / volume.total) * 100 : 0;

                  return (
                    <button
                      key={volume.path}
                      type="button"
                      onClick={() => {
                        setIsVolumeMenuOpen(false);
                        if (isActive && result.path === volume.path) return;
                        setNavHistory([]);
                        void startScan(volume.path, { pushHistory: false, transitionDirection: 'up' });
                      }}
                      className={`mb-1 flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition last:mb-0 ${isActive
                        ? 'bg-[rgba(var(--page-accent-rgb),0.12)] text-slate-950 dark:text-slate-100'
                        : 'text-slate-700 hover:bg-slate-900/5 dark:text-slate-200 dark:hover:bg-white/10'
                        }`}
                    >
                      <HardDrive className={`h-4 w-4 shrink-0 ${isActive ? 'text-[var(--page-accent)]' : 'opacity-60'}`} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-black">{volume.name}</span>
                        <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-slate-900/10 dark:bg-white/10">
                          <span
                            className="block h-full rounded-full bg-[var(--page-accent)]"
                            style={{ width: `${Math.min(100, Math.max(1, usedPct))}%` }}
                          />
                        </span>
                        <span className="mt-1 block font-mono text-[10px] font-bold text-slate-500 dark:text-slate-400">
                          {formatBytes(volume.free)} free of {formatBytes(volume.total)}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="mx-1 h-5 w-px shrink-0 bg-slate-300/60 dark:bg-white/15" />
          <div className="flex min-w-0 items-center gap-0.5 overflow-x-auto">
            {breadcrumbs.map((crumb, index) => {
              const isLast = index === breadcrumbs.length - 1;
              return (
                <div key={crumb.path} className="flex items-center gap-0.5 shrink-0">
                  {index > 0 && <ChevronRight className="h-3 w-3 text-slate-400 shrink-0 dark:text-slate-500" />}
                  <button
                    type="button"
                    disabled={isLast}
                    onClick={() => {
                      if (!isLast) startScan(crumb.path);
                    }}
                    className={`rounded-md px-1.5 py-0.5 text-xs font-semibold transition truncate max-w-[8rem] ${isLast
                      ? 'text-slate-900 cursor-default dark:text-slate-100'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-white/40 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-white/10'
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
            {largeFiles.length > 0 && (
              <div className="flex items-center gap-0.5 rounded-full border border-white/60 bg-white/55 p-0.5 shadow-inner shadow-white/40 dark:border-white/10 dark:bg-slate-900/55">
                {([
                  { mode: 'map' as const, label: 'Map', icon: BarChart3 },
                  { mode: 'files' as const, label: 'Biggest files', icon: Layers },
                ]).map(({ mode, label, icon: ModeIcon }) => (
                  <button
                    key={mode}
                    type="button"
                    aria-pressed={panelMode === mode}
                    onClick={() => setPanelMode(mode)}
                    title={mode === 'files' ? `The ${largeFiles.length} biggest files anywhere under this folder` : 'Treemap of this folder'}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black transition ${panelMode === mode
                      ? 'bg-white text-[var(--page-accent)] shadow-[0_6px_16px_rgba(15,23,42,0.10)] dark:bg-white/15 dark:text-slate-100'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                      }`}
                  >
                    <ModeIcon className="h-3.5 w-3.5" />
                    <span className="hidden lg:inline">{label}</span>
                  </button>
                ))}
              </div>
            )}
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
                className="h-10 rounded-full bg-white/72 px-3 text-slate-700 shadow-[0_8px_24px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.8)] hover:bg-white/90 dark:bg-slate-900/60 dark:text-slate-200 dark:shadow-[0_8px_24px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.08)] dark:hover:bg-slate-800/80"
              >
                <ListFilter className="h-[1.05rem] w-[1.05rem]" strokeWidth={2.4} />
                <span className="hidden text-sm font-black sm:inline">Filter</span>
              </Button>

              {isFilterOpen && (
                <div
                  className="absolute right-0 top-12 z-[90] w-72 rounded-[1.35rem] border border-white/65 bg-white/90 p-3 shadow-[0_24px_70px_rgba(15,23,42,0.22)] backdrop-blur-2xl dark:border-white/10 dark:bg-slate-900/85 dark:shadow-[0_24px_70px_rgba(0,0,0,0.55)]"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="mb-3 flex items-end justify-between gap-4 px-1">
                    <div>
                      <div className="text-[0.66rem] font-black uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Show in map</div>
                      <div className="mt-1 text-sm font-black text-slate-950 dark:text-slate-100">{sortedListEntries.length} visible</div>
                    </div>
                    <div className="font-mono text-[11px] font-black text-slate-500 dark:text-slate-400">Size order</div>
                  </div>

                  <div className="grid grid-cols-2 rounded-full border border-slate-200/80 bg-slate-100/80 p-1 shadow-inner shadow-slate-900/5 dark:border-white/10 dark:bg-white/10">
                    <button
                      type="button"
                      aria-pressed={showFiles}
                      onClick={() => setShowFiles((current) => (current && !showFolders ? current : !current))}
                      className={`flex h-11 items-center justify-center gap-2 rounded-full text-sm font-black transition ${showFiles
                        ? 'bg-white text-sky-700 shadow-[0_8px_20px_rgba(14,165,233,0.18)] ring-1 ring-sky-100 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-500/25'
                        : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
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
                        ? 'bg-white text-violet-700 shadow-[0_8px_20px_rgba(139,92,246,0.18)] ring-1 ring-violet-100 dark:bg-violet-500/15 dark:text-violet-300 dark:ring-violet-500/25'
                        : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
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
            <div className={`relative h-full rounded-[1.35rem] ${contentEnterClass} ${inlineScanPath ? 'analyze-panel-content--loading' : ''}`}>
              {showingBiggestFiles ? (
                <div className="h-full overflow-y-auto rounded-[1.35rem] border border-white/45 bg-white/25 p-3 shadow-inner shadow-white/20 custom-scrollbar dark:border-white/10 dark:bg-slate-950/[0.35] dark:shadow-black/30">
                  <div className="mb-3 flex items-baseline justify-between gap-3 px-2">
                    <span className="text-[0.66rem] font-black uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                      Biggest files, any depth
                    </span>
                    <span className="font-mono text-[11px] font-black text-slate-500 dark:text-slate-400">{largeFiles.length}</span>
                  </div>
                  <div className="space-y-2">
                    {largeFiles.map((file, index) => {
                      const iconCategory = getFileIconCategory({ name: file.name, path: file.path, is_dir: false });
                      const FileIconComponent = iconCategory.icon;
                      const share = largeFiles[0].size > 0 ? (file.size / largeFiles[0].size) * 100 : 0;

                      return (
                        <div
                          key={file.path}
                          data-testid="biggest-file-row"
                          onContextMenu={(event) => openItemContextMenu(event, { ...file, is_dir: false })}
                          className="relative flex items-center gap-3 overflow-hidden rounded-2xl border border-white/50 bg-white/40 p-2.5 dark:border-white/10 dark:bg-slate-900/45"
                          title={`${file.path} - ${formatBytes(file.size)}`}
                        >
                          <div
                            className="absolute inset-y-0 left-0 bg-[rgba(var(--page-accent-rgb),0.12)]"
                            style={{ width: `${Math.min(100, Math.max(2, share))}%` }}
                          />
                          <span className="relative w-6 shrink-0 text-right font-mono text-[11px] font-black text-slate-400 dark:text-slate-500">{index + 1}</span>
                          <span className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/60 dark:border-white/10 ${iconCategory.backgroundClassName}`}>
                            <FileIconComponent className={`h-4 w-4 ${iconCategory.iconClassName}`} />
                          </span>
                          <span className="relative min-w-0 flex-1">
                            <span className="block truncate text-sm font-black text-slate-950 dark:text-slate-100">{file.name}</span>
                            <span className="block truncate font-mono text-[10px] font-bold text-slate-500 dark:text-slate-400">{file.path}</span>
                          </span>
                          <span className="relative shrink-0 font-mono text-xs font-black text-slate-700 dark:text-slate-200">{formatBytes(file.size)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : filteredEntries.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center rounded-[1.35rem] border border-white/45 bg-white/25 text-center dark:border-white/10 dark:bg-slate-950/[0.35]">
                  <FolderOpen className="mb-3 h-12 w-12 text-slate-400 dark:text-slate-500" />
                  <p className="font-semibold text-slate-600 dark:text-slate-300">No entries match the current filters.</p>
                </div>
              ) : isViewingApplications && applicationEntries.length > 0 ? (
                <div className="h-full overflow-y-auto rounded-[1.35rem] border border-white/45 bg-white/25 p-3 shadow-inner shadow-white/20 custom-scrollbar dark:border-white/10 dark:bg-slate-950/[0.35] dark:shadow-black/30">
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
                          className="group flex min-h-[8.75rem] max-h-[11rem] min-w-[7.25rem] flex-col items-center justify-center overflow-hidden rounded-[1.1rem] border border-white/62 bg-white/46 p-3 text-center shadow-[0_12px_32px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.72)] transition-colors hover:bg-white/70 hover:shadow-[0_18px_44px_rgba(15,23,42,0.14)] dark:border-white/10 dark:bg-slate-900/50 dark:shadow-[0_12px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.07)] dark:hover:bg-white/10 dark:hover:shadow-[0_18px_44px_rgba(0,0,0,0.5)]"
                          title={`${entry.name} - ${formatBytes(entry.size)}`}
                        >
                          <span className="mb-3 flex h-24 w-24 min-h-12 min-w-12 max-w-full items-center justify-center rounded-2xl bg-white/35 p-2 shadow-inner shadow-white/50 dark:bg-slate-950/[0.35] dark:shadow-black/30">
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
                          <span className="w-full truncate text-sm font-black text-slate-950 dark:text-slate-100">{entry.name.replace(/\.app$/, '')}</span>
                          <span className="mt-1 font-mono text-[11px] font-bold text-slate-500 dark:text-slate-400">{formatBytes(entry.size)}</span>
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
                      data-testid="storage-map-tile"
                      aria-disabled={(!rect.is_dir && !rect.isGroupedSmallFiles) || rect.isOther}
                      onContextMenu={(event) => openItemContextMenu(event, rect)}
                      onClick={() => {
                        if (rect.isGroupedSmallFiles) {
                          setIsSmallItemsOpen(true);
                          return;
                        }
                        if (rect.is_dir && !rect.isOther) {
                          setScanPath(rect.path);
                          startScan(rect.path);
                        }
                      }}
                      className={`group absolute overflow-hidden rounded-[1.05rem] border-[2px] border-white/72 p-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.38),0_16px_44px_rgba(15,23,42,0.10)] transition-transform duration-200 hover:z-10 hover:scale-[1.006] hover:shadow-[0_24px_62px_rgba(15,23,42,0.18)] dark:border-slate-950/60 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_16px_44px_rgba(0,0,0,0.45)] dark:hover:shadow-[0_24px_62px_rgba(0,0,0,0.55)] ${(!rect.is_dir && !rect.isGroupedSmallFiles) || rect.isOther ? 'cursor-default hover:scale-100' : ''}`}
                      style={{
                        left: `${rect.x}%`,
                        top: `${rect.y}%`,
                        width: `${rect.width}%`,
                        height: `${rect.height}%`,
                        background: `linear-gradient(145deg, ${rect.color}, ${rect.color}df)`,
                      }}
                      title={rect.isGroupedSmallFiles
                        ? `${rect.name} - ${formatBytes(rect.size)} - click to open them by size`
                        : `${rect.name} - ${formatBytes(rect.size)} - ${rect.percentage.toFixed(1)}%`}
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
            <DiskUsageProportionGraph
              items={treemapItems}
              totalSize={result.total_size}
              diskTotal={result.disk_total ?? 0}
              diskFree={result.disk_free ?? 0}
              isLoading={Boolean(inlineScanPath)}
              atVolumeRoot={isVolumeRootPath(result.path)}
            />

            <div className="relative min-h-[31rem] flex-1 overflow-hidden rounded-[1.35rem] xl:min-h-0">
              <div className="flex h-full min-h-0 flex-col">
                <div data-testid="file-list-summary" className="mb-4 flex items-center justify-between px-2 font-mono text-xs font-black text-slate-500 dark:text-slate-400">
                  <span>{sortedListEntries.length} items</span>
                  <span>{formatBytes(filteredSize)} total</span>
                </div>

                <div className="relative min-h-0 flex-1">
                  <div
                    ref={fileListScrollRef}
                    onScroll={updateFileListScrollShadows}
                    className="h-full overflow-hidden overflow-y-auto rounded-[1.35rem] pr-1 custom-scrollbar"
                  >
                    <div className={`min-h-full ${contentEnterClass} ${inlineScanPath ? 'analyze-panel-content--loading' : ''}`}>
                      {filteredEntries.length === 0 ? (
                        <div className="flex h-full min-h-[20rem] flex-col items-center justify-center text-center">
                          <FolderOpen className="mb-3 h-12 w-12 text-slate-400 dark:text-slate-500" />
                          <p className="font-semibold text-slate-600 dark:text-slate-300">No entries match the current filters.</p>
                        </div>
                      ) : (
                        <div className="space-y-2.5 pb-2">
                          {pagedListEntries.map((entry) => {
                            const percentage = remainderTotal > 0 ? (entry.size / remainderTotal) * 100 : 0;
                            const entryDate = formatEntryDate(entry);
                            const iconCategory = getFileIconCategory(entry);
                            const EntryIcon = iconCategory.icon;
                            const entryAppIcon = isMacAppEntry(entry) ? appIcons[entry.path] : undefined;
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
                                className={`group relative w-full overflow-hidden rounded-[1.35rem] border border-white/50 bg-white/30 p-3 text-left shadow-sm transition hover:bg-white/46 dark:border-white/10 dark:bg-slate-950/[0.35] dark:hover:bg-white/10 ${!entry.is_dir ? 'cursor-default' : ''}`}
                              >
                                <div
                                  className="absolute inset-y-0 left-0 rounded-[1.35rem] bg-[rgba(var(--page-accent-rgb),0.16)] transition-[width] duration-300"
                                  style={{ width: `${Math.min(100, Math.max(3, percentage))}%` }}
                                />
                                <div className="relative flex items-center gap-3">
                                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/60 shadow-inner shadow-white/30 dark:border-white/10 dark:shadow-black/30 ${entryAppIcon ? 'bg-white/50 dark:bg-white/10' : iconCategory.backgroundClassName}`} title={entryAppIcon ? entry.name : iconCategory.label}>
                                    {entryAppIcon ? (
                                      <img src={entryAppIcon} alt="" className="h-6 w-6 object-contain" draggable={false} />
                                    ) : (
                                      <EntryIcon className={`h-[1.125rem] w-[1.125rem] ${iconCategory.iconClassName}`} />
                                    )}
                                  </span>
                                  <span className="min-w-0 flex-1">
                                    <span className="block truncate text-base font-black text-slate-950 dark:text-slate-100">{entry.name}</span>
                                    <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] font-bold text-slate-500 dark:text-slate-400">
                                      <span>{formatBytes(entry.size)}</span>
                                      {entryDate && <span>{entryDate}</span>}
                                    </span>
                                  </span>
                                  {entry.is_dir && (
                                    <ChevronRight className="h-5 w-5 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-700 dark:text-slate-500 dark:group-hover:text-slate-200" />
                                  )}
                                </div>
                              </button>
                            );
                          })}
                          {hiddenListCount > 0 && (
                            <button
                              type="button"
                              onClick={() => setVisibleListCount((count) => count + LIST_PAGE_SIZE)}
                              className="w-full rounded-[1.35rem] border border-dashed border-slate-300/80 bg-white/30 p-3 text-sm font-black text-slate-600 transition hover:bg-white/55 dark:border-white/15 dark:bg-slate-950/[0.35] dark:text-slate-300 dark:hover:bg-white/10"
                            >
                              Show {Math.min(LIST_PAGE_SIZE, hiddenListCount).toLocaleString()} more
                              <span className="ml-2 font-mono text-[11px] opacity-60">{hiddenListCount.toLocaleString()} left</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div
                    className={`pointer-events-none absolute inset-x-0 top-0 h-8 rounded-t-[1.35rem] bg-gradient-to-b from-slate-900/7 to-transparent transition-opacity duration-200 dark:from-black/35 ${fileListScrollShadows.top ? 'opacity-100' : 'opacity-0'}`}
                  />
                  <div
                    className={`pointer-events-none absolute inset-x-0 bottom-0 h-10 rounded-b-[1.35rem] bg-gradient-to-t from-slate-900/8 to-transparent transition-opacity duration-200 dark:from-black/40 ${fileListScrollShadows.bottom ? 'opacity-100' : 'opacity-0'}`}
                  />
                </div>
              </div>
              {inlineScanPath && <AnalyzePanelLoadingOverlay />}
            </div>
          </div>
        </div>

        {isSmallItemsOpen && groupedMembers.length > 0 && (
          <SmallItemsModal
            items={groupedMembers}
            parentPath={result.path}
            // Zoom out of the tile that was clicked, so the modal grows from it
            // rather than appearing over it.
            originRect={treemapRects.find((rect) => rect.isGroupedSmallFiles)}
            onClose={() => setIsSmallItemsOpen(false)}
            onOpenContextMenu={openItemContextMenu}
          />
        )}

        {contextMenu && createPortal(
          <div
            className="fixed z-50 w-56 overflow-hidden rounded-2xl border border-white/60 bg-white/90 p-1.5 shadow-[0_18px_50px_rgba(15,23,42,0.18)] backdrop-blur-2xl dark:border-white/10 dark:bg-slate-900/85 dark:shadow-[0_18px_50px_rgba(0,0,0,0.55)]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => void openInFinder(contextMenu.item)}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-bold text-slate-700 transition hover:bg-slate-900/5 dark:text-slate-200 dark:hover:bg-white/10"
            >
              <ExternalLink className="h-4 w-4" />
              Open in Finder
            </button>
            {contextMenu.item.systemOwned ? (
              <div className="flex items-start gap-2 px-3 py-2 text-left text-xs font-semibold text-slate-500 dark:text-slate-400">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                macOS owns this location. Mole will not delete from it.
              </div>
            ) : (
              <button
                type="button"
                onClick={() => requestDelete(contextMenu.item)}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-bold text-rose-600 transition hover:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/15"
              >
                <Trash2 className="h-4 w-4" />
                Move {contextMenu.item.is_dir ? 'Folder' : 'File'} to Trash
              </button>
            )}
          </div>,
          document.body,
        )}

        {pendingDelete && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/35 p-6 backdrop-blur-sm dark:bg-slate-950/60">
            <div className="w-full max-w-md rounded-[1.75rem] border border-white/60 bg-white/90 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.24)] backdrop-blur-2xl dark:border-white/10 dark:bg-slate-900/85 dark:shadow-[0_24px_80px_rgba(0,0,0,0.6)]">
              <div className="flex items-start gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300">
                  <Trash2 className="h-6 w-6" />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-xl font-black text-slate-950 dark:text-slate-100">Confirm deletion</h3>
                  <p className="mt-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
                    Move this {pendingDelete.is_dir ? 'folder' : 'file'} to Trash? This action requires confirmation every time.
                  </p>
                  <div className="mt-4 rounded-2xl border border-slate-900/10 bg-white/65 p-3 dark:border-white/10 dark:bg-slate-950/40">
                    <div className="truncate text-sm font-black text-slate-900 dark:text-slate-100">{pendingDelete.name}</div>
                    <div className="mt-1 truncate font-mono text-xs font-bold text-slate-500 dark:text-slate-400">{pendingDelete.path}</div>
                    <div className="mt-2 font-mono text-xs font-black text-rose-500 dark:text-rose-400">{formatBytes(pendingDelete.size)}</div>
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
  };

  return (
    <StageTransition viewKey={viewKey}>
      {renderStage()}
    </StageTransition>
  );
}
