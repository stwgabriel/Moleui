import { useState, useEffect, useCallback, useRef, type MouseEvent } from 'react';
import {
  ArrowRight,
  Battery,
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

const MAX_HISTORY = 30;
const MAX_BATTERY_HISTORY = 24 * 60;
const BATTERY_SAMPLE_INTERVAL = 60_000;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const PROCESS_MENU_WIDTH = 232;
const PROCESS_MENU_HEIGHT = 276;
const PROCESS_MENU_MARGIN = 8;
const GLASS_CARD = 'bg-white/45 border border-white/55 shadow-[0_24px_80px_rgba(109,93,252,0.12),inset_0_1px_0_rgba(255,255,255,0.72)] backdrop-blur-2xl';
const ACTION_CARD = 'group relative flex items-center gap-5 rounded-[1.75rem] border border-white/55 bg-white/35 p-5 text-left  backdrop-blur-2xl overflow-hidden transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/45 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent';

interface HistoryPoint {
  t: number;
  cpu: number;
  rx: number;
  tx: number;
  gpu: number;
  battery: number | null;
}

interface BatteryHistoryPoint {
  t: number;
  battery: number;
  status: string;
  timeLeft?: string;
}

interface BatteryChartPoint {
  t: number;
  battery: number | null;
  predictedBattery: number | null;
  status?: string;
  timeLeft?: string;
  forecast?: boolean;
}

interface BatteryPrediction {
  label: string;
  detail: string;
  current: BatteryHistoryPoint | null;
  projectedBattery: number | null;
  ratePerHour: number | null;
  direction: 'up' | 'down' | 'flat';
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

function DetailRow({ icon: Icon, label, value }: DetailRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-900/10 py-3 last:border-b-0">
      <div className="flex items-center gap-3 text-slate-600">
        <Icon className="h-5 w-5 text-slate-500" aria-hidden="true" />
        <span className="font-medium">{label}</span>
      </div>
      <span className="max-w-[58%] truncate text-right font-semibold text-slate-900">{value}</span>
    </div>
  );
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
  if (metrics.thermal?.cpu_temp != null) return `${metrics.thermal.cpu_temp.toFixed(0)}°C`;
  if (metrics.cpu.temperature != null) return `${metrics.cpu.temperature.toFixed(0)}°C`;
  if (metrics.thermal?.system_power != null) return `${metrics.thermal.system_power}W`;
  return '—';
}

function getGPUTemperatureValue(metrics: SystemMetrics): string {
  if (metrics.thermal?.gpu_temp != null && metrics.thermal.gpu_temp > 0) {
    return `${metrics.thermal.gpu_temp.toFixed(0)}°C`;
  }

  return '—';
}

function getGPUUsage(metrics: SystemMetrics): number | null {
  const usage = metrics.gpu?.[0]?.usage;
  if (typeof usage === 'number' && Number.isFinite(usage) && usage >= 0) return Math.min(usage, 100);
  return null;
}

function getBatteryPercent(metrics: SystemMetrics): number | null {
  const percent = metrics.batteries?.[0]?.percent;
  if (typeof percent === 'number' && Number.isFinite(percent)) return Math.max(0, Math.min(percent, 100));
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

function formatBatteryTimeLeft(timeLeft?: string): string {
  if (!timeLeft || timeLeft === '0:00') return '—';
  if (timeLeft.toLowerCase().includes('no')) return '—';
  return timeLeft;
}

function formatBatteryDischargeLabel(battery?: SystemMetrics['batteries'][number]): string {
  if (!battery) return 'No battery data';
  const timeLeft = formatBatteryTimeLeft(battery.time_left);
  if (timeLeft === '—') return battery.status || 'Battery status unavailable';
  return `${timeLeft} to 0%`;
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

function makeBatteryHistoryPoint(metrics: SystemMetrics, t: number): BatteryHistoryPoint | null {
  const battery = metrics.batteries?.[0];
  const percent = getBatteryPercent(metrics);
  if (!battery || percent == null) return null;

  return {
    t,
    battery: percent,
    status: battery.status || 'Unknown',
    timeLeft: battery.time_left,
  };
}

function isBatteryDraining(status: string): boolean {
  return status.toLowerCase().includes('discharging');
}

function isBatteryCharging(status: string): boolean {
  const statusLower = status.toLowerCase();
  return !statusLower.includes('discharging') && (statusLower.includes('charging') || statusLower.includes('charged'));
}

function clampBatteryPercent(percent: number): number {
  return Math.max(0, Math.min(percent, 100));
}

function parseBatteryTimeLeftMs(timeLeft?: string): number | null {
  const formatted = formatBatteryTimeLeft(timeLeft);
  if (formatted === '—') return null;

  const match = formatted.match(/^(\d+):(\d{2})$/);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || minutes >= 60) return null;

  const milliseconds = (hours * 60 + minutes) * 60000;
  return milliseconds > 0 ? milliseconds : null;
}

function getBatteryDayBounds(now: number): { start: number; end: number } {
  const startDate = new Date(now);
  startDate.setHours(0, 0, 0, 0);
  const start = startDate.getTime();

  return { start, end: start + DAY_MS };
}

function getBatteryHourTicks(dayStart: number): number[] {
  return Array.from({ length: 25 }, (_, hour) => dayStart + hour * HOUR_MS);
}

function formatBatteryHourTick(value: number, dayStart: number): string {
  const hour = Math.round((value - dayStart) / HOUR_MS);
  return hour % 6 === 0 ? String(hour).padStart(2, '0') : '';
}

function getBatteryHistoryRate(
  points: BatteryHistoryPoint[],
  current: BatteryHistoryPoint,
  direction: 'up' | 'down' | 'any',
): number | null {
  const baseline = [...points]
    .reverse()
    .find((point) => {
      if (point.t >= current.t || point.battery === current.battery) return false;

      const delta = current.battery - point.battery;
      if (direction === 'up') return delta > 0;
      if (direction === 'down') return delta < 0;
      return delta !== 0;
    });

  if (!baseline) return null;

  const elapsedHours = (current.t - baseline.t) / HOUR_MS;
  if (elapsedHours <= 0) return null;

  const ratePerHour = (current.battery - baseline.battery) / elapsedHours;
  return Number.isFinite(ratePerHour) && ratePerHour !== 0 ? ratePerHour : null;
}

function getBatteryPrediction(metrics: SystemMetrics | null, history: BatteryHistoryPoint[], now: number): BatteryPrediction {
  const current = metrics ? makeBatteryHistoryPoint(metrics, now) : null;
  if (!current) {
    return {
      label: 'No battery data',
      detail: 'Waiting for samples',
      current: null,
      projectedBattery: null,
      ratePerHour: null,
      direction: 'flat',
    };
  }

  const timeLeftMs = parseBatteryTimeLeftMs(current.timeLeft);
  const points = trimHistory([...history, current], MAX_BATTERY_HISTORY).sort((a, b) => a.t - b.t);
  let direction: BatteryPrediction['direction'] = 'flat';
  let ratePerHour: number | null = null;

  if (isBatteryCharging(current.status)) {
    if (current.battery >= 99.5 || current.status.toLowerCase().includes('charged')) {
      ratePerHour = 0;
    } else {
      direction = 'up';
      ratePerHour = timeLeftMs ? (100 - current.battery) / (timeLeftMs / HOUR_MS) : getBatteryHistoryRate(points, current, 'up');
    }
  } else if (isBatteryDraining(current.status)) {
    direction = 'down';
    ratePerHour = timeLeftMs ? -current.battery / (timeLeftMs / HOUR_MS) : getBatteryHistoryRate(points, current, 'down');
  } else {
    ratePerHour = getBatteryHistoryRate(points, current, 'any');
    if (ratePerHour != null) direction = ratePerHour > 0 ? 'up' : 'down';
  }

  if (ratePerHour != null && Math.abs(ratePerHour) < 0.01) {
    ratePerHour = 0;
    direction = 'flat';
  }

  if (ratePerHour == null) {
    return {
      label: isBatteryCharging(current.status) ? current.status : formatBatteryDischargeLabel(metrics?.batteries?.[0]),
      detail: 'Learning trend',
      current,
      projectedBattery: current.battery,
      ratePerHour,
      direction,
    };
  }

  const { end } = getBatteryDayBounds(now);
  const hoursToMidnight = Math.max(0, (end - current.t) / HOUR_MS);
  const projectedBattery = clampBatteryPercent(current.battery + ratePerHour * hoursToMidnight);

  if (ratePerHour === 0) {
    return {
      label: `Midnight ${projectedBattery.toFixed(0)}%`,
      detail: 'Flat estimate',
      current,
      projectedBattery,
      ratePerHour,
      direction: 'flat',
    };
  }

  return {
    label: `Midnight ${projectedBattery.toFixed(0)}%`,
    detail: `${ratePerHour > 0 ? '+' : ''}${ratePerHour.toFixed(1)}%/hr ${direction}`,
    current,
    projectedBattery,
    ratePerHour,
    direction,
  };
}

function appendBatteryHistory(history: BatteryHistoryPoint[], metrics: SystemMetrics, t: number): BatteryHistoryPoint[] {
  const point = makeBatteryHistoryPoint(metrics, t);
  if (!point) return history;

  const previous = history[history.length - 1];
  if (!previous) return [point];

  const percentChanged = point.battery !== previous.battery;
  const percentDropped = point.battery < previous.battery;
  const statusChanged = point.status !== previous.status;
  const sampleDue = t - previous.t >= BATTERY_SAMPLE_INTERVAL;
  const charging = isBatteryCharging(point.status) && point.battery < 99.5;
  const activeBattery = isBatteryDraining(point.status) || charging || percentDropped || percentChanged;

  if (!activeBattery && !statusChanged) return history;
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

function upsertBatteryChartPoint(chart: Map<number, BatteryChartPoint>, point: BatteryChartPoint): void {
  const existing = chart.get(point.t);

  chart.set(point.t, {
    t: point.t,
    battery: point.battery ?? existing?.battery ?? null,
    predictedBattery: point.predictedBattery ?? existing?.predictedBattery ?? null,
    status: point.status ?? existing?.status,
    timeLeft: point.timeLeft ?? existing?.timeLeft,
    forecast: point.forecast ?? existing?.forecast,
  });
}

function getBatteryChartData(history: BatteryHistoryPoint[], prediction: BatteryPrediction, now: number): BatteryChartPoint[] {
  const { start, end } = getBatteryDayBounds(now);
  const chart = new Map<number, BatteryChartPoint>();
  const current = prediction.current;
  const actualPoints = history.filter((point) => point.t >= start && point.t <= Math.min(now, end));

  if (current && current.t >= start && current.t <= end) {
    actualPoints.push(current);
  }

  if (actualPoints.length === 1) {
    const [point] = actualPoints;
    upsertBatteryChartPoint(chart, {
      t: Math.max(start, point.t - 2000),
      battery: point.battery,
      predictedBattery: null,
      status: point.status,
      timeLeft: point.timeLeft,
    });
  }

  actualPoints.forEach((point) => {
    upsertBatteryChartPoint(chart, {
      t: point.t,
      battery: point.battery,
      predictedBattery: null,
      status: point.status,
      timeLeft: point.timeLeft,
    });
  });

  if (current && current.t <= end) {
    const projectedBattery = prediction.projectedBattery ?? current.battery;
    upsertBatteryChartPoint(chart, {
      t: current.t,
      battery: null,
      predictedBattery: current.battery,
      status: current.status,
      timeLeft: current.timeLeft,
      forecast: true,
    });
    upsertBatteryChartPoint(chart, {
      t: end,
      battery: null,
      predictedBattery: projectedBattery,
      status: 'Predicted',
      forecast: true,
    });
  }

  return [...chart.values()].sort((a, b) => a.t - b.t);
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
  const historyRef = useRef<HistoryPoint[]>([]);
  const batteryHistoryRef = useRef<BatteryHistoryPoint[]>([]);
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
            className="grid min-h-0  gap-2 grid-cols-[1fr_1fr_1.15fr]"
            style={{ gridTemplateRows: 'repeat(2, minmax(0, 1.25fr)) repeat(2, minmax(0, 0.75fr))' }}
          >
            {/* Mac Info - Row 1-2, Col 1 */}
            <Card className={`col-span-1 row-span-2 rounded-[1.75rem] p-5 ${GLASS_CARD}`}>
              <div className="flex h-full flex-col justify-between gap-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-4">
                    <img
                      src="./assets/images/mac-preview.png"
                      alt="Mac preview"
                      className="mt-1 w-28 shrink-0 object-contain drop-shadow-[0_16px_24px_rgba(15,23,42,0.16)]"
                    />
                    <div className="min-w-0">
                      <h2 className="truncate text-xl font-bold text-slate-950">{formatMacName(metrics.host)}</h2>
                      <p className="mt-1 text-sm font-medium text-slate-600">{metrics.hardware?.model || 'Mac'}</p>
                      <div className="mt-5 text-sm text-slate-600">
                        <span>Health Score</span>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="font-medium">{metrics.health_score >= 80 ? 'Excellent' : metrics.health_score >= 60 ? 'Good' : 'Needs attention'}</span>
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: getHealthColor(metrics.health_score) }} />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div
                    className="text-5xl font-black leading-none tracking-tight drop-shadow-[0_10px_24px_rgba(139,92,246,0.28)]"
                    style={{ color: getHealthColor(metrics.health_score) }}
                    aria-label={`Health score ${metrics.health_score}`}
                  >
                    {metrics.health_score}
                  </div>
                </div>
                <div className="rounded-3xl border border-white/60 bg-white/30 px-4 text-sm shadow-inner shadow-white/30 backdrop-blur-xl">
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
                  <div className="text-sm font-semibold" style={{ color: getHeatColor(metrics.cpu.usage) }}>
                    {metrics.cpu.usage.toFixed(0)}%
                  </div>
                </div>
                <div className="min-h-0 flex-1 py-2">
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
                  <div className="text-sm font-semibold" style={{ color: gpuUsage == null ? '#64748b' : getHeatColor(gpuUsage) }}>
                    {gpuUsage == null ? '—' : `${gpuUsage.toFixed(0)}%`}
                  </div>
                </div>
                <div className="min-h-0 flex-1 py-2">
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

            {/* RAM + Storage - Row 1, Col 3 */}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 col-start-3 row-start-1">
              {/* RAM */}
              <Card className={`min-h-44 rounded-[1.75rem] p-4 overflow-hidden ${GLASS_CARD}`}>
                <div className="flex h-full flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-xl font-bold text-slate-950">RAM</div>
                    <div className="text-sm font-semibold" style={{ color: getHeatColor(metrics.memory.used_percent) }}>
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
                      <span className="text-base font-bold text-slate-950 leading-none">{metrics.memory.used_percent.toFixed(0)}%</span>
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
              {/* Storage */}
              <Card className={`min-h-44 rounded-[1.75rem] p-4 overflow-hidden ${GLASS_CARD}`}>
                <div className="flex h-full flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-xl font-bold text-slate-950">Storage</div>
                    <div className="text-sm font-semibold" style={{ color: getHeatColor(metrics.disks?.[0]?.used_percent ?? 0) }}>
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
                      <span className="text-base font-bold text-slate-950 leading-none">{(metrics.disks?.[0]?.used_percent ?? 0).toFixed(0)}%</span>
                    </div>
                  </div>
                  <div className="mt-auto text-center">
                    <div className="text-xs font-medium text-slate-500">{formatBytes(metrics.disks?.[0]?.used || 0)} / {formatBytes(metrics.disks?.[0]?.total || 0)}</div>
                  </div>
                </div>
              </Card>
            </div>

            {/* Network + Battery - Row 2, Col 3 */}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 col-start-3 row-start-2">
              <Card className={`min-h-36 rounded-[1.75rem] p-4 overflow-hidden ${GLASS_CARD}`}>
                <div className="flex h-full flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-xl font-bold text-slate-950">Network</div>
                  </div>
                  <div className="min-h-0 flex-1 py-2">
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
              <Card className={`min-h-36 rounded-[1.75rem] p-4 overflow-hidden ${GLASS_CARD}`}>
                <div className="flex h-full flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-xl font-bold text-slate-950">Battery</div>
                    <div className="text-sm font-semibold text-emerald-500">{batteryPercent == null ? '—' : `${batteryPercent.toFixed(0)}%`}</div>
                  </div>
                  <div className="relative min-h-0 flex-1 py-2">
                    {batteryCharging && (
                      <div className="pointer-events-none absolute right-2 top-1 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-emerald-200/80 bg-emerald-100/80 text-emerald-500 shadow-[0_8px_20px_rgba(16,185,129,0.25)] backdrop-blur-xl" aria-label="Battery charging">
                        <Zap className="h-4 w-4 fill-emerald-400/30" aria-hidden="true" />
                      </div>
                    )}
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
                  </div>
                  {/* <div className="mt-auto grid grid-cols-2 gap-2 text-xs font-medium text-slate-500">
                    <div className="truncate">{batteryPrediction.label}</div>
                    <div className="truncate text-right">{batteryPrediction.detail}</div>
                  </div> */}
                </div>
              </Card>
            </div>

            {/* Processes - Row 3-4, All Columns */}
            <Card className={`min-h-72 col-span-3 row-start-3 row-span-2 rounded-[1.75rem] p-4 ${GLASS_CARD}`}>
              <div className="flex flex-col h-full">
                <div className="mb-2 grid grid-cols-[minmax(0,1fr)_9rem_2rem] items-end gap-3 px-2">
                  <div className="text-xl font-bold text-slate-950">All Processes</div>
                  <div className="grid grid-cols-2 items-center gap-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
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
                  <div aria-hidden="true" />
                </div>
                <div className="flex-1 overflow-auto pr-1 custom-scrollbar">
                  {(() => {
                    const allProcesses = metrics.processes?.length ? metrics.processes : metrics.top_processes ?? [];
                    const orderedProcesses = [...allProcesses].sort((a, b) => {
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

                    return orderedProcesses.map((proc, idx) => {
                      const cpuBar = Math.min(proc.cpu, 100);
                      const isPinned = pinnedPids.includes(proc.pid);
                      return (
                        <div
                          key={proc.pid}
                          className="grid grid-cols-[minmax(0,1fr)_9rem_2rem] items-center gap-3 border-b border-slate-900/10 px-2 py-1.5 last:border-b-0 hover:rounded-xl hover:bg-violet-500/10"
                          onContextMenu={(event) => handleProcessContextMenu(event, proc)}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${isPinned ? 'bg-violet-500 text-white' : 'bg-slate-900/10 text-slate-600'}`}>{idx + 1}</span>
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium text-slate-700">{proc.name}</div>
                              <div className="text-[11px] font-medium text-slate-400">PID {proc.pid}</div>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 items-center gap-3 text-xs">
                            <div className="flex items-center gap-2 text-violet-600" aria-label={`${proc.cpu.toFixed(1)} percent CPU`}>
                              <span className="h-1.5 w-10 overflow-hidden rounded-full bg-slate-900/5">
                                <span className="block h-full rounded-full bg-violet-500" style={{ width: `${cpuBar}%` }} />
                              </span>
                              <span className="font-semibold tabular-nums">{proc.cpu.toFixed(0)}</span>
                            </div>
                            <span className="font-medium tabular-nums text-slate-500">{proc.memory.toFixed(1)}%</span>
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
                      );
                    });
                  })()}
                </div>
              </div>
            </Card>
            {processMenu && (
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
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
