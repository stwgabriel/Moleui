import { useState, useEffect, useCallback, useRef, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowRight,
  Battery,
  ChevronDown,
  ChevronUp,
  Clock3,
  MoreHorizontal,
  Search,
  Settings2,
  Sparkles,
  Thermometer,
  Trash2,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { AreaChart, Area, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, PieChart, Pie, Cell } from 'recharts';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { formatBytes } from '@/utils/format';
import type { PageId, SystemMetrics } from '@/types';
import { getMyMacMetrics, setMyMacMetrics } from '@/utils/storage';
import {
  MAX_BATTERY_HISTORY,
  formatBatteryHourTick,
  getBatteryDayBounds,
  getBatteryChartData,
  getBatteryHourTicks,
  getBatteryPercent,
  getBatteryPrediction,
  isBatteryCharging,
  makeBatteryHistoryPoint,
  type BatteryChartPoint,
  type BatteryHistoryPoint,
} from '@/utils/batteryPrediction';

const MAX_HISTORY = 30;
const BATTERY_SAMPLE_INTERVAL = 6 * 60_000;
const PROCESS_MENU_WIDTH = 232;
const PROCESS_MENU_HEIGHT = 276;
const PROCESS_MENU_MARGIN = 8;
const PROCESS_DONUT_OTHER_ID = 'other-processes';
const PROCESS_DONUT_OTHER_COLOR = '#d1d5db';
const GRAPH_EDGE_FADE = '[mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]';
const GLASS_CARD = 'bg-white/45 border border-white/55 shadow-[0_24px_80px_rgba(109,93,252,0.12),inset_0_1px_0_rgba(255,255,255,0.72)] backdrop-blur-2xl';
const ACTION_CARD = 'group relative flex items-center gap-5 rounded-[1.75rem] border border-white/55 bg-white/35 p-5 text-left  backdrop-blur-2xl overflow-hidden transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/45 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent';
const CARD_TOP_VALUE = 'text-xl font-bold leading-none text-right';

interface HistoryPoint {
  t: number;
  cpu: number;
  rx: number;
  tx: number;
  gpu: number;
  battery: number | null;
}

interface MyMacPageProps {
  onNavigate: (page: PageId) => void;
}

interface DetailRowProps {
  icon: LucideIcon;
  label: string;
  value: string;
}

type ProcessInfo = NonNullable<SystemMetrics['processes']>[number];
type ProcessSortKey = 'cpu' | 'memory';

interface ProcessSort {
  key: ProcessSortKey;
  direction: 'asc' | 'desc';
}

interface ProcessMenuState {
  process: ProcessInfo;
  x: number;
  y: number;
}

interface ProcessDonutItem {
  id: string;
  name: string;
  cpu: number;
  value: number;
  color: string;
  totalPercent?: number;
  icon?: string;
  iconMissing?: boolean;
  isOther?: boolean;
}

interface ProcessAppGroup {
  id: string;
  name: string;
  processes: ProcessInfo[];
  totalCpu: number;
  totalMemory: number;
  iconProcess: ProcessInfo;
  icon?: string;
  iconMissing?: boolean;
  pinnedRank: number;
}

function DetailRow({ icon: Icon, label, value }: DetailRowProps) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 border-b border-slate-900/10 py-3 last:border-b-0">
      <div className="flex min-w-0 items-center gap-2.5 text-slate-600">
        <Icon className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
        <span className="truncate font-medium">{label}</span>
      </div>
      <span className="min-w-0 max-w-[58%] truncate text-right font-semibold text-slate-900" title={value}>{value}</span>
    </div>
  );
}

function ProcessAppIcon({ process, icon, iconMissing }: { process: ProcessInfo; icon?: string; iconMissing?: boolean }) {
  return (
    <span
      className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden"
      title={process.name}
      aria-hidden="true"
    >
      {icon ? (
        <img src={icon} alt="" className="h-7 w-7 object-contain" draggable={false} />
      ) : iconMissing ? (
        <svg viewBox="0 0 32 32" className="h-7 w-7 text-slate-400" fill="none" aria-hidden="true">
          <rect x="7" y="7" width="18" height="18" rx="5" fill="currentColor" opacity="0.16" />
          <path d="M11 16h10M16 11v10M10 23l12-14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      ) : (
        <span className="h-2 w-2 rounded-full bg-slate-400/45" />
      )}
    </span>
  );
}

function ProcessDonutIconLabel(props: any) {
  const { cx, cy, midAngle, innerRadius, outerRadius, payload } = props;
  const item = payload as ProcessDonutItem;

  const sliceRadius = Number(innerRadius) + (Number(outerRadius) - Number(innerRadius)) / 2;
  const labelRadius = Number(outerRadius) + 20;
  const radians = -Number(midAngle) * (Math.PI / 180);
  const iconSize = 22;
  const x = Number(cx) + Math.cos(radians) * sliceRadius;
  const y = Number(cy) + Math.sin(radians) * sliceRadius;
  const labelX = Number(cx) + Math.cos(radians) * labelRadius;
  const labelY = Number(cy) + Math.sin(radians) * labelRadius;
  const textAnchor = Math.cos(radians) >= 0 ? 'start' : 'end';
  const percent = item.totalPercent == null ? '' : `${item.totalPercent.toFixed(0)}%`;

  return (
    <g>
      <g transform={`translate(${x}, ${y})`}>
        {item.icon && !item.isOther ? (
          <image
            href={item.icon}
            x={-iconSize / 2}
            y={-15}
            width={iconSize}
            height={iconSize}
            preserveAspectRatio="xMidYMid meet"
          />
        ) : (
          <circle r={item.isOther ? 5 : 7} cy={-11} fill={item.color} opacity={item.isOther ? 0.7 : 0.95} />
        )}
        <text dominantBaseline="central" textAnchor="middle" fill="#334155" fontSize={9} fontWeight={800} y={13}>
          {percent}
        </text>
      </g>
      <text
        x={labelX}
        y={labelY}
        dominantBaseline="central"
        textAnchor={textAnchor}
        fill="#475569"
        fontSize={10}
        fontWeight={700}
      >
        {item.name}
      </text>
    </g>
  );
}

function formatAppBundleName(bundlePath: string): string {
  const appBundlePart = bundlePath
    .split('/')
    .filter(Boolean)
    .reverse()
    .find((part) => part.endsWith('.app'));

  return appBundlePart?.replace(/\.app$/i, '') ?? '';
}

function normalizeProcessAppName(name: string): string {
  return String(name || '')
    .replace(/\.app$/i, '')
    .replace(/\s+Helper(?:\s*\([^)]+\))?.*$/i, '')
    .replace(/\s+\((?:Renderer|GPU|Plugin|Extension)\).*$/i, '')
    .trim();
}

function getProcessMemoryValue(process: ProcessInfo): number {
  return typeof process.memory_bytes === 'number' && Number.isFinite(process.memory_bytes)
    ? process.memory_bytes
    : Math.max(process.memory, 0);
}

function formatProcessMemory(value: number): string {
  return value > 1024 ? formatBytes(value) : `${value.toFixed(1)}%`;
}

function formatFreeGigabytes(value: number, total: number): string {
  const bytes = total > 1024 * 1024 ? value : value * 1024 * 1024 * 1024;
  const freeGb = bytes / (1024 * 1024 * 1024);
  const rounded = freeGb >= 100 ? freeGb.toFixed(0) : freeGb >= 10 ? freeGb.toFixed(1) : freeGb.toFixed(2);
  return `${rounded.replace(/\.0+$/, '')} GB Free`;
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getProcessColor(name: string, icon?: string): string {
  const seed = hashString(icon ? `${name}:${icon.slice(0, 96)}` : name);
  const hue = seed % 360;
  const saturation = icon ? 70 : 62;
  const lightness = icon ? 54 : 58;
  return `hsl(${hue} ${saturation}% ${lightness}%)`;
}

function getProcessAppIdentity(process: ProcessInfo): { id: string; name: string } {
  const command = process.command ?? '';
  const appBundleMatch = command.match(/^(.+?\.app)(?:\/|$)/i);
  const appBundlePath = appBundleMatch?.[1] ?? '';
  const bundleName = formatAppBundleName(appBundlePath);
  const name = bundleName || normalizeProcessAppName(process.name) || process.name || `PID ${process.pid}`;
  const normalizedName = name.toLowerCase().replace(/[^a-z0-9]+/g, '');

  return {
    id: appBundlePath ? appBundlePath.toLowerCase() : `name:${normalizedName || process.pid}`,
    name,
  };
}

function buildProcessAppGroups(
  processes: ProcessInfo[],
  pinnedPids: number[],
  processSort: ProcessSort,
  processIcons: Record<number, string>,
  processIconMisses: Record<number, boolean>,
): ProcessAppGroup[] {
  const groups = new Map<string, ProcessAppGroup>();

  for (const process of processes) {
    const identity = getProcessAppIdentity(process);
    const current = groups.get(identity.id);

    if (current) {
      current.processes.push(process);
      current.totalCpu += Math.max(process.cpu, 0);
      current.totalMemory += getProcessMemoryValue(process);
      const pinnedIndex = pinnedPids.indexOf(process.pid);
      if (pinnedIndex >= 0 && (current.pinnedRank === -1 || pinnedIndex < current.pinnedRank)) {
        current.pinnedRank = pinnedIndex;
      }
      if (!current.icon && processIcons[process.pid]) {
        current.iconProcess = process;
        current.icon = processIcons[process.pid];
        current.iconMissing = false;
      }
      if (!current.icon && !current.iconMissing && processIconMisses[process.pid]) {
        current.iconMissing = true;
      }
    } else {
      groups.set(identity.id, {
        id: identity.id,
        name: identity.name,
        processes: [process],
        totalCpu: Math.max(process.cpu, 0),
        totalMemory: getProcessMemoryValue(process),
        iconProcess: process,
        icon: processIcons[process.pid],
        iconMissing: processIconMisses[process.pid],
        pinnedRank: pinnedPids.indexOf(process.pid),
      });
    }
  }

  return [...groups.values()].map((group) => {
    group.processes.sort((a, b) => {
      const aPinned = pinnedPids.indexOf(a.pid);
      const bPinned = pinnedPids.indexOf(b.pid);
      if (aPinned >= 0 || bPinned >= 0) {
        if (aPinned === -1) return 1;
        if (bPinned === -1) return -1;
        return aPinned - bPinned;
      }
      const sortValue = processSort.direction === 'desc'
        ? b[processSort.key] - a[processSort.key]
        : a[processSort.key] - b[processSort.key];
      if (sortValue !== 0) return sortValue;
      return a.pid - b.pid;
    });

    if (!group.icon) {
      const iconProcess = group.processes.find((process) => processIcons[process.pid]);
      if (iconProcess) {
        group.iconProcess = iconProcess;
        group.icon = processIcons[iconProcess.pid];
        group.iconMissing = false;
      }
    }

    return group;
  }).sort((a, b) => {
    if (a.pinnedRank >= 0 || b.pinnedRank >= 0) {
      if (a.pinnedRank === -1) return 1;
      if (b.pinnedRank === -1) return -1;
      return a.pinnedRank - b.pinnedRank;
    }
    const sortValue = processSort.direction === 'desc'
      ? b[processSort.key === 'cpu' ? 'totalCpu' : 'totalMemory'] - a[processSort.key === 'cpu' ? 'totalCpu' : 'totalMemory']
      : a[processSort.key === 'cpu' ? 'totalCpu' : 'totalMemory'] - b[processSort.key === 'cpu' ? 'totalCpu' : 'totalMemory'];
    if (sortValue !== 0) return sortValue;
    return a.name.localeCompare(b.name);
  });
}

function getHealthColor(score: number): string {
  if (score >= 80) return '#10b981';
  if (score >= 60) return '#f59e0b';
  return '#ef4444';
}

function getHeatColor(percent: number): string {
  if (percent < 50) return '#10b981';
  if (percent < 70) return '#84cc16';
  if (percent < 85) return '#f59e0b';
  return '#ef4444';
}

function getTemperatureValue(metrics: SystemMetrics): string {
  if (metrics.thermal?.cpu_temp != null && metrics.thermal.cpu_temp > 0) {
    return `${metrics.thermal.cpu_temp.toFixed(0)}°C`;
  }
  if (metrics.cpu.temperature != null && metrics.cpu.temperature > 0) {
    return `${metrics.cpu.temperature.toFixed(0)}°C`;
  }
  if (metrics.thermal?.battery_temp != null && metrics.thermal.battery_temp > 0) {
    return `${metrics.thermal.battery_temp.toFixed(0)}°C`;
  }
  if (metrics.thermal?.system_power != null && metrics.thermal.system_power > 0) {
    return `${metrics.thermal.system_power}W`;
  }
  return '—';
}

function getGPUTemperatureValue(metrics: SystemMetrics): string {
  if (metrics.thermal?.gpu_temp != null && metrics.thermal.gpu_temp > 0) {
    return `${metrics.thermal.gpu_temp.toFixed(0)}°C`;
  }
  if (metrics.thermal?.battery_temp != null && metrics.thermal.battery_temp > 0) {
    return `${metrics.thermal.battery_temp.toFixed(0)}°C`;
  }

  return '—';
}

function getGPUUsage(metrics: SystemMetrics): number | null {
  const usage = metrics.gpu?.[0]?.usage;
  if (typeof usage === 'number' && Number.isFinite(usage) && usage >= 0) return Math.min(usage, 100);
  return null;
}

function getNetworkTotals(metrics: SystemMetrics) {
  return (metrics.network ?? []).reduce(
    (totals, item) => ({
      rx: totals.rx + (item.rx_rate_mbs ?? 0),
      tx: totals.tx + (item.tx_rate_mbs ?? 0),
    }),
    { rx: 0, tx: 0 },
  );
}

function formatMacName(host?: string): string {
  if (!host) return 'My Mac';

  return host
    .replace(/\.local$/, '')
    .replace(/-MacBook-(Air|Pro)$/, ' MacBook')
    .replace(/-/g, ' ');
}

function makeHistoryPoint(metrics: SystemMetrics, t: number): HistoryPoint {
  const networkTotals = getNetworkTotals(metrics);

  return {
    t,
    cpu: Math.max(0, Math.min(metrics.cpu.usage, 100)),
    rx: networkTotals.rx,
    tx: networkTotals.tx,
    gpu: getGPUUsage(metrics) ?? 0,
    battery: getBatteryPercent(metrics),
  };
}

function trimHistory<T>(history: T[], maxLength: number): T[] {
  return history.length > maxLength ? history.slice(history.length - maxLength) : history;
}

function appendBatteryHistory(history: BatteryHistoryPoint[], metrics: SystemMetrics, t: number): BatteryHistoryPoint[] {
  const point = makeBatteryHistoryPoint(metrics, t);
  if (!point) return history;

  const previous = history[history.length - 1];
  if (!previous) return [point];

  const percentChanged = point.battery !== previous.battery;
  const statusChanged = point.status !== previous.status;
  const sampleDue = t - previous.t >= BATTERY_SAMPLE_INTERVAL;

  if (!percentChanged && !statusChanged && !sampleDue) return history;

  return trimHistory([...history, point], MAX_BATTERY_HISTORY);
}

function parseHistory(value?: string): HistoryPoint[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((point): point is HistoryPoint => (
      typeof point === 'object' &&
      point !== null &&
      typeof (point as HistoryPoint).t === 'number' &&
      typeof (point as HistoryPoint).cpu === 'number'
    ));
  } catch {
    return [];
  }
}

function parseBatteryHistory(value?: string): BatteryHistoryPoint[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return trimHistory(parsed.filter((point): point is BatteryHistoryPoint => (
      typeof point === 'object' &&
      point !== null &&
      typeof (point as BatteryHistoryPoint).t === 'number' &&
      typeof (point as BatteryHistoryPoint).battery === 'number' &&
      typeof (point as BatteryHistoryPoint).status === 'string'
    )), MAX_BATTERY_HISTORY);
  } catch {
    return [];
  }
}

function getRenderableHistory(metrics: SystemMetrics | null, history: HistoryPoint[]): HistoryPoint[] {
  if (history.length >= 2) return history;
  if (!metrics) return [];

  const now = Date.now();
  const point = makeHistoryPoint(metrics, now);
  return [
    { ...point, t: now - 2000 },
    point,
  ];
}

export function MyMacPage({ onNavigate }: MyMacPageProps) {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [batteryHistory, setBatteryHistory] = useState<BatteryHistoryPoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh] = useState(true);
  const [pinnedPids, setPinnedPids] = useState<number[]>([]);
  const [processSort, setProcessSort] = useState<ProcessSort>({ key: 'cpu', direction: 'desc' });
  const [processMenu, setProcessMenu] = useState<ProcessMenuState | null>(null);
  const [processIcons, setProcessIcons] = useState<Record<number, string>>({});
  const [processIconMisses, setProcessIconMisses] = useState<Record<number, boolean>>({});
  const [isProcessExpanded, setIsProcessExpanded] = useState(false);
  const [processSearch, setProcessSearch] = useState('');
  const [expandedProcessGroups, setExpandedProcessGroups] = useState<Set<string>>(() => new Set());
  const historyRef = useRef<HistoryPoint[]>([]);
  const batteryHistoryRef = useRef<BatteryHistoryPoint[]>([]);
  const requestedProcessIconsRef = useRef<Set<string>>(new Set());
  const mountedRef = useRef(true);

  const fetchMetrics = useCallback(async (isInitial = false) => {
    void isInitial;

    try {
      setError(null);

      if (!window.moleDesktop?.runStatus) {
        throw new Error('Desktop API not available');
      }

      const result = await window.moleDesktop.runStatus();

      if (!result.ok) {
        throw new Error(result.stderr || 'Failed to fetch metrics');
      }

      const data = JSON.parse(result.stdout) as SystemMetrics;

      if (mountedRef.current) {
        const now = Date.now();
        const nextHistory = trimHistory([...historyRef.current, makeHistoryPoint(data, now)], MAX_HISTORY);
        const nextBatteryHistory = appendBatteryHistory(batteryHistoryRef.current, data, now);

        historyRef.current = nextHistory;
        batteryHistoryRef.current = nextBatteryHistory;

        setMetrics(data);
        setHistory(nextHistory);
        setBatteryHistory(nextBatteryHistory);
        await setMyMacMetrics(JSON.stringify(data), JSON.stringify(nextHistory), JSON.stringify(nextBatteryHistory));
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        console.error('Failed to fetch metrics:', err);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    async function loadCachedData() {
      const cached = await getMyMacMetrics();
      if (cached && mountedRef.current) {
        try {
          const cachedBatteryHistory = parseBatteryHistory(cached.batteryHistory);
          batteryHistoryRef.current = cachedBatteryHistory;
          setBatteryHistory(cachedBatteryHistory);

          if (Date.now() - cached.timestamp <= 60000) {
            const cachedMetrics = JSON.parse(cached.metrics) as SystemMetrics;
            const cachedHistory = parseHistory(cached.history);

            historyRef.current = cachedHistory;
            setMetrics(cachedMetrics);
            setHistory(cachedHistory.length > 0 ? cachedHistory : getRenderableHistory(cachedMetrics, []));
          }
        } catch {
          console.error('Failed to parse cached metrics');
        }
      }
      fetchMetrics(true);
    }

    loadCachedData();

    let interval: ReturnType<typeof setInterval> | null = null;
    if (autoRefresh) {
      interval = setInterval(() => fetchMetrics(false), 2000);
    }

    return () => {
      mountedRef.current = false;
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, fetchMetrics]);

  useEffect(() => {
    if (!processMenu) return;

    const closeMenu = () => setProcessMenu(null);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenu();
    };

    window.addEventListener('click', closeMenu);
    window.addEventListener('resize', closeMenu);
    window.addEventListener('scroll', closeMenu, true);
    window.addEventListener('keydown', closeOnEscape);

    return () => {
      window.removeEventListener('click', closeMenu);
      window.removeEventListener('resize', closeMenu);
      window.removeEventListener('scroll', closeMenu, true);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [processMenu]);

  useEffect(() => {
    if (!metrics || !window.moleDesktop?.getProcessIcons) return;

    const sourceProcesses = metrics.processes?.length ? metrics.processes : metrics.top_processes ?? [];
    const processesForIcons = Array.from(
      new Map(sourceProcesses.map((proc) => [proc.pid, proc])).values(),
    );
    const processesNeedingIcons = processesForIcons.filter((proc) => {
      const requestKey = `${proc.pid}:${proc.command ?? ''}:${proc.name}`;
      return (proc.command || proc.name) && !processIcons[proc.pid] && !processIconMisses[proc.pid] && !requestedProcessIconsRef.current.has(requestKey);
    });

    if (processesNeedingIcons.length === 0) return;

    processesNeedingIcons.forEach((proc) => requestedProcessIconsRef.current.add(`${proc.pid}:${proc.command ?? ''}:${proc.name}`));

    let isCancelled = false;

    async function loadProcessIcons() {
      try {
        const result = await window.moleDesktop.getProcessIcons?.(processesNeedingIcons.map((proc) => ({
          pid: proc.pid,
          name: proc.name,
          command: proc.command,
        })));

        if (!isCancelled && result?.ok) {
          setProcessIcons((currentIcons) => ({ ...currentIcons, ...result.icons }));
          setProcessIconMisses((currentMisses) => {
            const nextMisses = { ...currentMisses };
            const missingPids = result.missing?.length
              ? result.missing
              : processesNeedingIcons
                .map((proc) => proc.pid)
                .filter((pid) => !result.icons[pid]);

            missingPids.forEach((pid) => {
              nextMisses[pid] = true;
            });
            Object.keys(result.icons).forEach((pid) => {
              delete nextMisses[Number(pid)];
            });

            return nextMisses;
          });
        }
      } catch (err) {
        if (!isCancelled) console.error('Failed to load process icons:', err);
      }
    }

    void loadProcessIcons();

    return () => {
      isCancelled = true;
    };
  }, [metrics, processIcons, processIconMisses]);

  const openProcessMenuAt = (process: ProcessInfo, x: number, y: number) => {
    const maxX = Math.max(PROCESS_MENU_MARGIN, window.innerWidth - PROCESS_MENU_WIDTH - PROCESS_MENU_MARGIN);
    const maxY = Math.max(PROCESS_MENU_MARGIN, window.innerHeight - PROCESS_MENU_HEIGHT - PROCESS_MENU_MARGIN);

    setProcessMenu({
      process,
      x: Math.max(PROCESS_MENU_MARGIN, Math.min(x, maxX)),
      y: Math.max(PROCESS_MENU_MARGIN, Math.min(y, maxY)),
    });
  };

  const handleProcessContextMenu = (event: MouseEvent, process: ProcessInfo) => {
    event.preventDefault();
    openProcessMenuAt(process, event.clientX, event.clientY);
  };

  const handleProcessMenuButton = (event: MouseEvent<HTMLButtonElement>, process: ProcessInfo) => {
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    openProcessMenuAt(process, rect.right + 8, rect.top);
  };

  const toggleProcessSort = (key: ProcessSortKey) => {
    setProcessSort(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc',
    }));
  };

  const toggleProcessGroup = (groupId: string) => {
    setExpandedProcessGroups((current) => {
      const next = new Set(current);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const sortIndicator = (key: ProcessSortKey) => {
    if (processSort.key !== key) return '';
    return processSort.direction === 'desc' ? ' ↓' : ' ↑';
  };

  const copyProcessText = async (text: string) => {
    if (window.moleDesktop?.copyText) {
      await window.moleDesktop.copyText(text);
      return;
    }
    await navigator.clipboard.writeText(text);
  };

  const runProcessAction = async (action: 'pin' | 'copy-name' | 'copy-pid' | 'reveal' | 'activity-monitor' | 'terminate' | 'force-quit') => {
    if (!processMenu) return;

    const proc = processMenu.process;
    setProcessMenu(null);

    try {
      if (action === 'pin') {
        setPinnedPids(prev => prev.includes(proc.pid) ? prev.filter(pid => pid !== proc.pid) : [proc.pid, ...prev]);
      } else if (action === 'copy-name') {
        await copyProcessText(proc.name);
      } else if (action === 'copy-pid') {
        await copyProcessText(String(proc.pid));
      } else if (action === 'reveal') {
        const result = await window.moleDesktop?.revealPath(proc.command || '');
        if (result && !result.ok) console.warn(result.message);
      } else if (action === 'activity-monitor') {
        const result = await window.moleDesktop?.openActivityMonitor();
        if (result && !result.ok) console.warn(result.message);
      } else if (action === 'terminate') {
        const result = await window.moleDesktop?.signalProcess(proc.pid, 'SIGTERM');
        if (result && !result.ok) console.warn(result.message);
      } else if (action === 'force-quit') {
        const result = await window.moleDesktop?.signalProcess(proc.pid, 'SIGKILL');
        if (result && !result.ok) console.warn(result.message);
      }
    } catch (err) {
      console.error('Process action failed:', err);
    }
  };

  const gpuUsage = metrics ? getGPUUsage(metrics) : null;
  const gpuTemperature = metrics ? getGPUTemperatureValue(metrics) : '—';
  const networkTotals = metrics ? getNetworkTotals(metrics) : { rx: 0, tx: 0 };
  const battery = metrics?.batteries?.[0];
  const batteryPercent = metrics ? getBatteryPercent(metrics) : null;
  const chartHistory = getRenderableHistory(metrics, history);
  const now = Date.now();
  const batteryDayBounds = getBatteryDayBounds(now);
  const batteryHourTicks = getBatteryHourTicks(batteryDayBounds.start);
  const batteryPrediction = getBatteryPrediction(metrics, batteryHistory, now);
  const batteryChartHistory = getBatteryChartData(batteryHistory, batteryPrediction, now);
  const batteryCharging = battery ? isBatteryCharging(battery.status) : false;
  const batteryPredictionStroke = batteryPrediction.direction === 'down' ? '#f97316' : '#22c55e';
  const allProcesses = metrics?.processes?.length ? metrics.processes : metrics?.top_processes ?? [];
  const processAppGroups = buildProcessAppGroups(allProcesses, pinnedPids, processSort, processIcons, processIconMisses);
  const normalizedProcessSearch = processSearch.trim().toLowerCase();
  const visibleProcessAppGroups = normalizedProcessSearch
    ? processAppGroups.filter((group) => (
      group.name.toLowerCase().includes(normalizedProcessSearch) ||
      group.processes.some((proc) => (
        proc.name.toLowerCase().includes(normalizedProcessSearch) ||
        String(proc.pid).includes(normalizedProcessSearch) ||
        (proc.command ?? '').toLowerCase().includes(normalizedProcessSearch)
      ))
    ))
    : processAppGroups;
  const topCpuProcessGroups = [...processAppGroups]
    .sort((a, b) => b.totalCpu - a.totalCpu)
    .slice(0, 5);
  const allProcessCpu = processAppGroups.reduce((sum, group) => sum + Math.max(group.totalCpu, 0), 0);
  const topProcessCpu = topCpuProcessGroups.reduce((sum, group) => sum + Math.max(group.totalCpu, 0), 0);
  const otherProcessCpu = Math.max(allProcessCpu - topProcessCpu, 0);
  const topProcessDonutData = allProcessCpu > 0 ? [
    ...topCpuProcessGroups
      .filter((group) => group.totalCpu > 0)
    .map((group) => ({
      id: group.id,
      name: group.name,
      cpu: group.totalCpu,
      value: Math.max(group.totalCpu, 0),
      color: getProcessColor(group.name, group.icon),
      totalPercent: (Math.max(group.totalCpu, 0) / allProcessCpu) * 100,
      icon: group.icon,
      iconMissing: group.iconMissing,
    })),
    ...(otherProcessCpu > 0 ? [{
      id: PROCESS_DONUT_OTHER_ID,
      name: 'Other apps',
      cpu: otherProcessCpu,
      value: otherProcessCpu,
      color: PROCESS_DONUT_OTHER_COLOR,
      totalPercent: (otherProcessCpu / allProcessCpu) * 100,
      isOther: true,
    }] : []),
  ] : [];
  const memoryFree = Math.max((metrics?.memory.total ?? 0) - (metrics?.memory.used ?? 0), 0);
  const storageFree = Math.max((metrics?.disks?.[0]?.total ?? 0) - (metrics?.disks?.[0]?.used ?? 0), 0);
  const memoryFreeLabel = formatFreeGigabytes(memoryFree, metrics?.memory.total ?? 0).replace(' Free', '');
  const storageFreeLabel = formatFreeGigabytes(storageFree, metrics?.disks?.[0]?.total ?? 0).replace(' Free', '');

  return (
    <div className="relative h-full min-h-0 overflow-hidden">
      <div className="relative flex h-full min-h-0 w-full flex-col p-2">
        {error && !metrics ? (
          <Card className="p-8 text-center">
            <p className="text-accent-danger mb-4">{error}</p>
            <Button onClick={() => fetchMetrics(true)}>Retry</Button>
          </Card>
        ) : metrics && (
          <div
            className="grid h-full min-h-0 grid-cols-4 gap-2"
            style={{ gridTemplateRows: 'repeat(2, minmax(0, 1fr)) repeat(2, minmax(0, 0.78fr))' }}
          >
            {/* Mac Info - Row 1-2, Col 1 */}
            <Card className={`col-start-1 row-start-1 row-span-2 min-h-0 min-w-0 rounded-[1.75rem] p-4 ${GLASS_CARD}`}>
              <div className="flex h-full min-h-0 flex-col justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <img
                      src="./assets/images/mac-preview.png"
                      alt="Mac preview"
                      className="w-24 shrink-0 object-contain drop-shadow-[0_16px_24px_rgba(15,23,42,0.16)]"
                    />
                    <div className="flex shrink-0 flex-col items-end text-right">
                      <span className="text-[11px] font-semibold uppercase text-slate-500">Health</span>
                      <span
                        className="text-4xl font-black leading-none tracking-tight drop-shadow-[0_10px_24px_rgba(139,92,246,0.24)]"
                        style={{ color: getHealthColor(metrics.health_score) }}
                        aria-label={`Health score ${metrics.health_score}`}
                      >
                        {metrics.health_score}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 min-w-0">
                    <h2
                      className="overflow-hidden text-lg font-bold leading-tight text-slate-950 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]"
                      title={formatMacName(metrics.host)}
                    >
                      {formatMacName(metrics.host)}
                    </h2>
                    <p
                      className="mt-1 overflow-hidden text-sm font-medium leading-snug text-slate-600 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]"
                      title={metrics.hardware?.model || 'Mac'}
                    >
                      {metrics.hardware?.model || 'Mac'}
                    </p>
                    <div className="mt-3 flex items-center justify-between gap-3 text-sm text-slate-600">
                      <span className="font-medium">Health Score</span>
                      <span className="flex min-w-0 items-center gap-2 font-semibold text-slate-800">
                        <span className="truncate">{metrics.health_score >= 80 ? 'Excellent' : metrics.health_score >= 60 ? 'Good' : 'Needs attention'}</span>
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: getHealthColor(metrics.health_score) }} />
                      </span>
                    </div>
                  </div>
                </div>
                <div className="min-w-0 rounded-3xl border border-white/60 bg-white/30 px-3 text-sm shadow-inner shadow-white/30 backdrop-blur-xl">
                  <DetailRow icon={Settings2} label="System" value={metrics.hardware?.os_version || 'macOS'} />
                  <DetailRow icon={Clock3} label="Uptime" value={metrics.uptime || '—'} />
                  <DetailRow icon={Battery} label="Battery" value={metrics.batteries?.[0]?.health || 'Normal'} />
                  <DetailRow icon={Thermometer} label="Temperature" value={getTemperatureValue(metrics)} />
                </div>
              </div>
            </Card>

            {/* Clean - Row 3, Col 1 */}
            <button
              className={`hidden col-start-1 row-start-3 ${ACTION_CARD} focus-visible:ring-cyan-500`}
              onClick={() => onNavigate('clean')}
              aria-label="Open Clean page to free up space"
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_25%,rgba(59,130,246,0.18),transparent_42%)]" />
              <div className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-full border border-blue-200/70 bg-blue-100/35 shadow-[0_12px_36px_rgba(59,130,246,0.18)] backdrop-blur-xl">
                <Sparkles className="h-9 w-9 text-blue-500 drop-shadow-[0_8px_18px_rgba(59,130,246,0.35)] transition-transform duration-300 group-hover:scale-110 group-hover:rotate-12" />
              </div>
              <div className="relative min-w-0 flex-1">
                <div className="text-xl font-bold text-blue-500">Clean</div>
                <div className="mt-1 text-sm font-medium text-slate-600">Free up space</div>
              </div>
              <ArrowRight className="relative h-5 w-5 text-slate-500 transition-transform duration-200 group-hover:translate-x-1" />
            </button>

            {/* Uninstall - Row 4, Col 1 */}
            <button
              className={`hidden col-start-1 row-start-4 ${ACTION_CARD} focus-visible:ring-rose-500`}
              onClick={() => onNavigate('uninstall')}
              aria-label="Open Uninstall page to remove apps"
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_25%,rgba(244,63,94,0.16),transparent_42%)]" />
              <div className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-full border border-rose-200/70 bg-rose-100/35 shadow-[0_12px_36px_rgba(244,63,94,0.18)] backdrop-blur-xl">
                <Trash2 className="h-9 w-9 text-rose-500 drop-shadow-[0_8px_18px_rgba(244,63,94,0.32)] transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6" />
              </div>
              <div className="relative min-w-0 flex-1">
                <div className="text-xl font-bold text-rose-500">Uninstall</div>
                <div className="mt-1 text-sm font-medium text-slate-600">Remove apps</div>
              </div>
              <ArrowRight className="relative h-5 w-5 text-slate-500 transition-transform duration-200 group-hover:translate-x-1" />
            </button>

            {/* Processor - Row 1, Col 2 */}
            <Card className={`min-h-36 col-start-2 row-start-1 rounded-[1.75rem] p-4 overflow-hidden ${GLASS_CARD}`}>
              <div className="flex h-full flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div className="text-xl font-bold text-slate-950">Processor</div>
                  <div className={CARD_TOP_VALUE} style={{ color: getHeatColor(metrics.cpu.usage) }}>
                    {metrics.cpu.usage.toFixed(0)}%
                  </div>
                </div>
                <div className={`min-h-0 flex-1 py-2 ${GRAPH_EDGE_FADE}`}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartHistory} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <YAxis domain={[0, 100]} hide />
                      <Tooltip
                        content={({ active, payload }) =>
                          active && payload?.length ? (
                            <div className="bg-white/80 border border-white/70 rounded-lg px-2 py-1 text-xs shadow-md backdrop-blur-xl">
                              {(payload[0].value as number).toFixed(1)}%
                            </div>
                          ) : null
                        }
                      />
                      <Area
                        type="monotone"
                        dataKey="cpu"
                        stroke="#8b5cf6"
                        strokeWidth={1.5}
                        fill="url(#cpuGrad)"
                        dot={false}
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-auto flex items-center justify-between gap-3 text-xs font-medium text-slate-500">
                  <span>{metrics.cpu.core_count} cores</span>
                  <span className="tabular-nums">Load {metrics.cpu.load1.toFixed(2)}</span>
                </div>
              </div>
            </Card>

            {/* GPU - Row 2, Col 2 */}
            <Card className={`min-h-36 col-start-2 row-start-2 rounded-[1.75rem] p-4 overflow-hidden ${GLASS_CARD}`}>
              <div className="flex h-full flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div className="text-xl font-bold text-slate-950">GPU</div>
                  <div className={CARD_TOP_VALUE} style={{ color: gpuUsage == null ? '#64748b' : getHeatColor(gpuUsage) }}>
                    {gpuUsage == null ? '—' : `${gpuUsage.toFixed(0)}%`}
                  </div>
                </div>
                <div className={`min-h-0 flex-1 py-2 ${GRAPH_EDGE_FADE}`}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartHistory} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gpuGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ec4899" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#ec4899" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <YAxis domain={[0, 100]} hide />
                      <Tooltip
                        content={({ active, payload }) =>
                          active && payload?.length ? (
                            <div className="bg-white/80 border border-white/70 rounded-lg px-2 py-1 text-xs shadow-md backdrop-blur-xl">
                              {(payload[0]?.value as number)?.toFixed(1)}%
                            </div>
                          ) : null
                        }
                      />
                      <Area
                        type="monotone"
                        dataKey="gpu"
                        stroke="#ec4899"
                        strokeWidth={1.5}
                        fill="url(#gpuGrad)"
                        dot={false}
                        isAnimationActive={false}
                        connectNulls
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-auto flex items-center justify-between gap-3 text-xs font-medium text-slate-500">
                  <span className="min-w-0 truncate">{metrics.gpu?.[0]?.name || 'Apple GPU'}</span>
                  <span className="shrink-0">Temp {gpuTemperature}</span>
                </div>
              </div>
            </Card>

            {/* Optimize - Row 3, Col 2 */}
            <button
              className={`hidden col-start-2 row-start-3 ${ACTION_CARD} focus-visible:ring-violet-500`}
              onClick={() => onNavigate('optimize')}
              aria-label="Open Optimize page to boost performance"
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_25%,rgba(139,92,246,0.18),transparent_42%)]" />
              <div className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-full border border-violet-200/70 bg-violet-100/35 shadow-[0_12px_36px_rgba(139,92,246,0.20)] backdrop-blur-xl">
                <Zap className="h-9 w-9 fill-violet-500/20 text-violet-500 drop-shadow-[0_8px_18px_rgba(139,92,246,0.35)] transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6" />
              </div>
              <div className="relative min-w-0 flex-1">
                <div className="text-xl font-bold text-violet-500">Optimize</div>
                <div className="mt-1 text-sm font-medium text-slate-600">Boost performance</div>
              </div>
              <ArrowRight className="relative h-5 w-5 text-slate-500 transition-transform duration-200 group-hover:translate-x-1" />
            </button>

            {/* Analyze - Row 4, Col 2 */}
            <button
              className={`hidden col-start-2 row-start-4 ${ACTION_CARD} focus-visible:ring-pink-500`}
              onClick={() => onNavigate('analyze')}
              aria-label="Open Analyze page for disk insights"
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_25%,rgba(236,72,153,0.16),transparent_42%)]" />
              <div className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-full border border-pink-200/70 bg-pink-100/35 shadow-[0_12px_36px_rgba(236,72,153,0.18)] backdrop-blur-xl">
                <Search className="h-9 w-9 text-pink-500 drop-shadow-[0_8px_18px_rgba(236,72,153,0.32)] transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6" />
              </div>
              <div className="relative min-w-0 flex-1">
                <div className="text-xl font-bold text-pink-500">Analyze</div>
                <div className="mt-1 text-sm font-medium text-slate-600">Disk insights</div>
              </div>
              <ArrowRight className="relative h-5 w-5 text-slate-500 transition-transform duration-200 group-hover:translate-x-1" />
            </button>

            {/* RAM - Row 1, Col 3 */}
            <Card className={`min-h-44 col-start-3 row-start-1 rounded-[1.75rem] p-4 overflow-hidden ${GLASS_CARD}`}>
              <div className="flex h-full flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div className="text-xl font-bold text-slate-950">RAM</div>
                  <div className={CARD_TOP_VALUE} style={{ color: getHeatColor(metrics.memory.used_percent) }}>
                    {metrics.memory.used_percent.toFixed(0)}%
                  </div>
                </div>
                <div className="relative flex min-h-0 flex-1 items-center justify-center py-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { value: metrics.memory.used_percent },
                          { value: 100 - metrics.memory.used_percent },
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius="58%"
                        outerRadius="80%"
                        startAngle={90}
                        endAngle={-270}
                        dataKey="value"
                        strokeWidth={0}
                        isAnimationActive={false}
                      >
                        <Cell fill={getHeatColor(metrics.memory.used_percent)} />
                        <Cell fill="rgba(148, 163, 184, 0.16)" />
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Center label */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-sm font-bold leading-none text-slate-950">{memoryFreeLabel}</span>
                    <span className="mt-0.5 text-[10px] font-semibold leading-none text-slate-500">Free</span>
                  </div>
                </div>
                <div className="mt-auto space-y-0.5 text-center">
                  <div className="text-xs font-medium text-slate-500">{formatBytes(metrics.memory.used)} / {formatBytes(metrics.memory.total)}</div>
                  {metrics.memory.swap_total != null && metrics.memory.swap_total > 0 && (
                    <div className="text-xs font-medium text-amber-500">
                      swap {formatBytes(metrics.memory.swap_used ?? 0)}
                    </div>
                  )}
                </div>
              </div>
            </Card>

            {/* Storage - Row 1, Col 4 */}
            <Card className={`min-h-44 col-start-4 row-start-1 rounded-[1.75rem] p-4 overflow-hidden ${GLASS_CARD}`}>
              <div className="flex h-full flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div className="text-xl font-bold text-slate-950">Storage</div>
                  <div className={CARD_TOP_VALUE} style={{ color: getHeatColor(metrics.disks?.[0]?.used_percent ?? 0) }}>
                    {(metrics.disks?.[0]?.used_percent ?? 0).toFixed(0)}%
                  </div>
                </div>
                <div className="relative flex min-h-0 flex-1 items-center justify-center py-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { value: metrics.disks?.[0]?.used_percent ?? 0 },
                          { value: 100 - (metrics.disks?.[0]?.used_percent ?? 0) },
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius="58%"
                        outerRadius="80%"
                        startAngle={90}
                        endAngle={-270}
                        dataKey="value"
                        strokeWidth={0}
                        isAnimationActive={false}
                      >
                        <Cell fill={getHeatColor(metrics.disks?.[0]?.used_percent ?? 0)} />
                        <Cell fill="rgba(148, 163, 184, 0.16)" />
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-sm font-bold leading-none text-slate-950">{storageFreeLabel}</span>
                    <span className="mt-0.5 text-[10px] font-semibold leading-none text-slate-500">Free</span>
                  </div>
                </div>
                <div className="mt-auto text-center">
                  <div className="text-xs font-medium text-slate-500">{formatBytes(metrics.disks?.[0]?.used || 0)} / {formatBytes(metrics.disks?.[0]?.total || 0)}</div>
                </div>
              </div>
            </Card>

            {/* Network - Row 2, Col 3 */}
            <Card className={`min-h-36 col-start-3 row-start-2 rounded-[1.75rem] p-4 overflow-hidden ${GLASS_CARD}`}>
              <div className="flex h-full flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div className="text-xl font-bold text-slate-950">Network</div>
                </div>
                <div className={`min-h-0 flex-1 py-2 ${GRAPH_EDGE_FADE}`}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartHistory} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="rxGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="txGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <YAxis hide />
                      <Tooltip
                        content={({ active, payload }) =>
                          active && payload?.length ? (
                            <div className="bg-white/80 border border-white/70 rounded-lg px-2 py-1 text-xs shadow-md space-y-0.5 backdrop-blur-xl">
                              <div className="text-blue-500">↓ {(payload[0]?.value as number)?.toFixed(2)} MB/s</div>
                              <div className="text-emerald-500">↑ {(payload[1]?.value as number)?.toFixed(2)} MB/s</div>
                            </div>
                          ) : null
                        }
                      />
                      <Area type="monotone" dataKey="rx" stroke="#3b82f6" strokeWidth={1.5} fill="url(#rxGrad)" dot={false} isAnimationActive={false} />
                      <Area type="monotone" dataKey="tx" stroke="#10b981" strokeWidth={1.5} fill="url(#txGrad)" dot={false} isAnimationActive={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-auto flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-blue-500">↓ {networkTotals.rx.toFixed(2)} MB/s</span>
                  <span className="text-xs font-medium text-emerald-500">↑ {networkTotals.tx.toFixed(2)} MB/s</span>
                </div>
              </div>
            </Card>

            {/* Battery - Row 2, Col 4 */}
            <Card className={`min-h-36 col-start-4 row-start-2 rounded-[1.75rem] p-4 overflow-hidden ${GLASS_CARD}`}>
              <div className="flex h-full flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div className="text-xl font-bold text-slate-950">Battery</div>
                  <div className={`${CARD_TOP_VALUE} text-emerald-500`}>{batteryPercent == null ? '—' : `${batteryPercent.toFixed(0)}%`}</div>
                </div>
                <div className="relative min-h-0 flex-1 py-2">
                  {batteryCharging && (
                    <div className="pointer-events-none absolute right-2 top-1 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-emerald-200/80 bg-emerald-100/80 text-emerald-500 shadow-[0_8px_20px_rgba(16,185,129,0.25)] backdrop-blur-xl" aria-label="Battery charging">
                      <Zap className="h-4 w-4 fill-emerald-400/30" aria-hidden="true" />
                    </div>
                  )}
                  <div className="relative h-full overflow-hidden">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={batteryChartHistory} margin={{ top: 2, right: 0, left: 0, bottom: 14 }}>
                      <defs>
                        <linearGradient id="batteryGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22c55e" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#22c55e" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical horizontal={false} stroke="rgba(15, 23, 42, 0.09)" strokeDasharray="1 5" />
                      <XAxis
                        dataKey="t"
                        type="number"
                        domain={[batteryDayBounds.start, batteryDayBounds.end]}
                        ticks={batteryHourTicks}
                        interval={0}
                        tickFormatter={(value) => formatBatteryHourTick(Number(value), batteryDayBounds.start)}
                        axisLine={false}
                        tickLine={false}
                        tickMargin={4}
                        tick={{ fill: '#94a3b8', fontSize: 9 }}
                      />
                      <YAxis domain={[0, 100]} hide />
                      <Tooltip
                        content={({ active, payload }) => {
                          const item = payload?.find((entry) => entry.value != null);
                          const point = item?.payload as BatteryChartPoint | undefined;

                          return active && item?.value != null ? (
                            <div className="space-y-0.5 rounded-lg border border-white/70 bg-white/80 px-2 py-1 text-xs shadow-md backdrop-blur-xl">
                              <div>{(item.value as number).toFixed(0)}% {point?.forecast ? 'predicted' : 'battery'}</div>
                              {point && <div className="text-slate-500">{point.status} · {new Date(point.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>}
                            </div>
                          ) : null;
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="battery"
                        stroke="#22c55e"
                        strokeWidth={2}
                        fill="url(#batteryGrad)"
                        dot={false}
                        isAnimationActive={false}
                        connectNulls
                      />
                      <Area
                        type="monotone"
                        dataKey="predictedBattery"
                        stroke={batteryPredictionStroke}
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        fill="transparent"
                        fillOpacity={0}
                        dot={false}
                        activeDot={false}
                        isAnimationActive={false}
                        connectNulls
                      />
                      </AreaChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute bottom-5 left-0 top-0 w-7 bg-gradient-to-r from-white/55 to-transparent" />
                    <div className="pointer-events-none absolute bottom-5 right-0 top-0 w-7 bg-gradient-to-l from-white/55 to-transparent" />
                  </div>
                </div>
                <div className="mt-auto flex flex-col gap-0.5 text-xs font-medium text-slate-500">
                  <div className="truncate">{batteryPrediction.label}</div>
                  <div className="truncate text-[11px] text-slate-400">{batteryPrediction.detail}</div>
                </div>
              </div>
            </Card>

            {/* Processes - Row 3-4, All Columns */}
            <Card className={`relative col-span-4 row-start-3 row-span-2 min-h-0 rounded-[1.75rem] overflow-visible ${isProcessExpanded ? 'z-40' : 'z-0'} ${GLASS_CARD} bg-transparent`}>
              <div className={`absolute inset-x-0 bottom-0 grid grid-cols-[20rem_minmax(0,1fr)] gap-4 rounded-[1.75rem] border border-white/60 p-4 transition-[height,background-color,box-shadow] duration-300 ease-out ${isProcessExpanded ? 'h-[calc(100%+18rem)] max-h-[calc(100vh-1rem)] bg-white/90 shadow-[0_24px_80px_rgba(15,23,42,0.16)] backdrop-blur-2xl' : 'h-full bg-white/35 shadow-[0_18px_58px_rgba(109,93,252,0.12)] backdrop-blur-2xl'}`}>
                <div className="relative flex min-h-0 overflow-visible p-1">
                  <div className="relative h-full min-h-0 flex-1">
                    {topProcessDonutData.length > 0 ? (
                      <>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={topProcessDonutData}
                              cx="50%"
                              cy="50%"
                              innerRadius="42%"
                              outerRadius="70%"
                              paddingAngle={3}
                              cornerRadius={8}
                              dataKey="value"
                              label={ProcessDonutIconLabel}
                              labelLine={false}
                              stroke="rgba(255,255,255,0.78)"
                              strokeWidth={3}
                              isAnimationActive={false}
                            >
                              {topProcessDonutData.map((proc) => (
                                <Cell key={proc.id} fill={proc.color} />
                              ))}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                          <div className="flex flex-col items-center justify-center text-center">
                            <span className="text-2xl font-black leading-none text-slate-950">{allProcesses.length}</span>
                            <span className="mt-1 text-xs font-semibold text-slate-500">Processes</span>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm font-medium text-slate-500">No process data</div>
                    )}
                  </div>
                </div>
                <div className="flex min-h-0 flex-col">
                  <div className="mb-2 flex items-center justify-between gap-3 px-2">
                    <div className="text-xl font-bold text-slate-950">Apps & Processes</div>
                    <div className="flex min-w-0 items-center gap-2">
                      <label className="relative min-w-0 w-[18rem]" aria-label="Search processes">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                      <input
                        type="search"
                        value={processSearch}
                        onChange={(event) => setProcessSearch(event.target.value)}
                        placeholder="Search processes"
                        className="h-8 w-full rounded-full border border-slate-300 bg-slate-100/80 pl-8 pr-3 text-xs font-semibold text-slate-700 outline-none backdrop-blur-xl placeholder:text-slate-500 focus:border-slate-400 focus:bg-slate-100 focus:ring-2 focus:ring-violet-500/20"
                      />
                      </label>
                      <button
                        type="button"
                        className="flex h-8 w-8 shrink-0 items-center justify-center text-slate-600 transition hover:text-violet-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                        aria-label={isProcessExpanded ? 'Collapse all processes' : 'Expand all processes'}
                        aria-expanded={isProcessExpanded}
                        onClick={() => setIsProcessExpanded((expanded) => !expanded)}
                      >
                        {!isProcessExpanded ? <ChevronUp className="h-5 w-5" aria-hidden="true" /> : <ChevronDown className="h-5 w-5" aria-hidden="true" />}
                      </button>
                    </div>
                  </div>
                  <div className="mb-1 grid grid-cols-[minmax(0,1fr)_9rem_2rem] items-center gap-3 px-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <span />
                    <div className="grid grid-cols-2 items-center gap-3">
                      <button
                        type="button"
                        className="text-left transition hover:text-violet-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                        aria-sort={processSort.key === 'cpu' ? (processSort.direction === 'desc' ? 'descending' : 'ascending') : 'none'}
                        onClick={() => toggleProcessSort('cpu')}
                      >
                        CPU{sortIndicator('cpu')}
                      </button>
                      <button
                        type="button"
                        className="text-left transition hover:text-violet-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                        aria-sort={processSort.key === 'memory' ? (processSort.direction === 'desc' ? 'descending' : 'ascending') : 'none'}
                        onClick={() => toggleProcessSort('memory')}
                      >
                        MEM{sortIndicator('memory')}
                      </button>
                    </div>
                    <span />
                  </div>
                  <div className="flex-1 overflow-auto pr-1 custom-scrollbar">
                    {visibleProcessAppGroups.length === 0 ? (
                      <div className="flex h-full items-center justify-center text-sm font-medium text-slate-500">No matching processes</div>
                    ) : visibleProcessAppGroups.map((group, idx) => {
                      const cpuBar = Math.min(group.totalCpu, 100);
                      const appColor = getProcessColor(group.name, group.icon);
                      const isExpanded = expandedProcessGroups.has(group.id);
                      const canExpand = group.processes.length > 1;
                      const primaryProcess = group.processes[0];
                      const groupMeta = canExpand ? `${group.processes.length} processes` : `PID ${primaryProcess.pid}`;
                      return (
                        <div key={group.id} className="border-b border-slate-900/10 last:border-b-0">
                          <div
                            className="grid grid-cols-[minmax(0,1fr)_9rem_2rem] items-center gap-3 px-2 py-1.5 hover:rounded-xl hover:bg-violet-500/10"
                            onContextMenu={(event) => handleProcessContextMenu(event, primaryProcess)}
                          >
                            <div className="flex min-w-0 items-center gap-2.5">
                              <span className="h-5 w-1 shrink-0 rounded-full" style={{ backgroundColor: appColor }} aria-hidden="true" />
                              <span className={`w-5 shrink-0 text-center text-xs font-bold tabular-nums ${group.pinnedRank >= 0 ? 'text-violet-600' : 'text-slate-400'}`}>{idx + 1}</span>
                              <button
                                type="button"
                                className="flex h-7 w-7 shrink-0 items-center justify-center text-slate-500 transition hover:text-violet-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:pointer-events-none disabled:opacity-35"
                                aria-label={isExpanded ? `Hide processes for ${group.name}` : `Show processes for ${group.name}`}
                                aria-expanded={canExpand ? isExpanded : undefined}
                                disabled={!canExpand}
                                onClick={() => toggleProcessGroup(group.id)}
                              >
                                {isExpanded ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
                              </button>
                              <ProcessAppIcon process={group.iconProcess} icon={group.icon} iconMissing={group.iconMissing} />
                              <div className="min-w-0">
                                <div className="truncate text-sm font-semibold text-slate-800" title={group.name}>{group.name}</div>
                                <div className="text-[11px] font-medium text-slate-400">{groupMeta}</div>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 items-center gap-3 text-xs">
                              <div className="flex items-center gap-2" style={{ color: appColor }} aria-label={`${group.totalCpu.toFixed(1)} percent CPU`}>
                                <span className="h-1.5 w-10 overflow-hidden rounded-full bg-slate-900/5">
                                  <span className="block h-full rounded-full" style={{ width: `${cpuBar}%`, backgroundColor: appColor }} />
                                </span>
                                <span className="font-semibold tabular-nums">{group.totalCpu.toFixed(1)}%</span>
                              </div>
                              <span className="font-medium tabular-nums text-slate-500">{formatProcessMemory(group.totalMemory)}</span>
                            </div>
                            {canExpand ? (
                              <span className="h-7 w-7" aria-hidden="true" />
                            ) : (
                              <button
                                type="button"
                                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-900/10 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                                aria-label={`Open actions for ${primaryProcess.name}`}
                                aria-haspopup="menu"
                                onClick={(event) => handleProcessMenuButton(event, primaryProcess)}
                              >
                                <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                              </button>
                            )}
                          </div>
                          {isExpanded && canExpand && (
                            <div className="pb-1 pl-12">
                              {group.processes.map((proc) => (
                                <div
                                  key={proc.pid}
                                  className="grid grid-cols-[minmax(0,1fr)_9rem_2rem] items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-white/50"
                                  onContextMenu={(event) => handleProcessContextMenu(event, proc)}
                                >
                                  <div className="flex min-w-0 items-center gap-2.5">
                                    <ProcessAppIcon process={proc} icon={processIcons[proc.pid] ?? group.icon} iconMissing={processIconMisses[proc.pid] ?? group.iconMissing} />
                                    <div className="min-w-0">
                                      <div className="truncate text-sm font-medium text-slate-700" title={proc.name}>{proc.name}</div>
                                      <div className="text-[11px] font-medium text-slate-400">PID {proc.pid}</div>
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-2 items-center gap-3 text-xs">
                                    <span className="font-semibold tabular-nums" style={{ color: appColor }}>{proc.cpu.toFixed(1)}%</span>
                                    <span className="font-medium tabular-nums text-slate-500">{formatProcessMemory(getProcessMemoryValue(proc))}</span>
                                  </div>
                                  <button
                                    type="button"
                                    className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-900/10 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                                    aria-label={`Open actions for ${proc.name}`}
                                    aria-haspopup="menu"
                                    onClick={(event) => handleProcessMenuButton(event, proc)}
                                  >
                                    <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </Card>
            {processMenu && createPortal(
              <div
                role="menu"
                className="fixed z-50 max-h-[calc(100vh-1rem)] overflow-auto rounded-2xl border border-slate-900/10 bg-white/95 p-1.5 text-left text-sm font-semibold text-slate-800 shadow-[0_18px_56px_rgba(15,23,42,0.18)] backdrop-blur-2xl"
                style={{ left: processMenu.x, top: processMenu.y, width: PROCESS_MENU_WIDTH }}
                onClick={(event) => event.stopPropagation()}
              >
                <button type="button" role="menuitem" className="w-full rounded-xl px-3 py-2 text-left hover:bg-slate-100" onClick={() => runProcessAction('pin')}>
                  {pinnedPids.includes(processMenu.process.pid) ? 'Unpin Row' : 'Pin Row'}
                </button>
                <div className="my-1 h-px bg-slate-900/10" />
                <button type="button" role="menuitem" className="w-full rounded-xl px-3 py-2 text-left hover:bg-slate-100" onClick={() => runProcessAction('copy-name')}>Copy Process Name</button>
                <button type="button" role="menuitem" className="w-full rounded-xl px-3 py-2 text-left hover:bg-slate-100" onClick={() => runProcessAction('copy-pid')}>Copy PID</button>
                <div className="my-1 h-px bg-slate-900/10" />
                <button type="button" role="menuitem" className="w-full rounded-xl px-3 py-2 text-left hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-45" disabled={!processMenu.process.command} onClick={() => runProcessAction('reveal')}>Reveal in Finder</button>
                <button type="button" role="menuitem" className="w-full rounded-xl px-3 py-2 text-left hover:bg-slate-100" onClick={() => runProcessAction('activity-monitor')}>Open Activity Monitor</button>
                <div className="my-1 h-px bg-slate-900/10" />
                <button type="button" role="menuitem" className="w-full rounded-xl px-3 py-2 text-left hover:bg-slate-100" onClick={() => runProcessAction('terminate')}>Terminate</button>
                <button type="button" role="menuitem" className="w-full rounded-xl px-3 py-2 text-left hover:bg-slate-100" onClick={() => runProcessAction('force-quit')}>Force Quit</button>
              </div>,
              document.body,
            )}
          </div>
        )}
      </div>
    </div>
  );
}
