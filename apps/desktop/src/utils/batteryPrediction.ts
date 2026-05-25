import type { SystemMetrics } from '@/types';

export const MAX_BATTERY_HISTORY = 24 * 60;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export interface BatteryHistoryPoint {
  t: number;
  battery: number;
  status: string;
  timeLeft?: string;
}

export interface BatteryPrediction {
  label: string;
  detail: string;
  current: BatteryHistoryPoint | null;
  projectedBattery: number | null;
  targetTime: number | null;
  ratePerHour: number | null;
  direction: 'up' | 'down' | 'flat';
}

export interface BatteryChartPoint {
  t: number;
  battery: number | null;
  predictedBattery: number | null;
  status?: string;
  timeLeft?: string;
  forecast?: boolean;
}

function trimBatteryHistory(history: BatteryHistoryPoint[]): BatteryHistoryPoint[] {
  return history.length > MAX_BATTERY_HISTORY ? history.slice(history.length - MAX_BATTERY_HISTORY) : history;
}

export function getBatteryPercent(metrics: SystemMetrics): number | null {
  const percent = metrics.batteries?.[0]?.percent;
  if (typeof percent === 'number' && Number.isFinite(percent)) return Math.max(0, Math.min(percent, 100));
  return null;
}

export function formatBatteryTimeLeft(timeLeft?: string): string {
  if (!timeLeft || timeLeft === '0:00') return '-';
  if (timeLeft.toLowerCase().includes('no')) return '-';
  return timeLeft;
}

export function formatBatteryDischargeLabel(battery?: SystemMetrics['batteries'][number]): string {
  if (!battery) return 'No battery data';
  const timeLeft = formatBatteryTimeLeft(battery.time_left);
  if (timeLeft === '-') return battery.status || 'Battery status unavailable';
  return `${timeLeft} to 0%`;
}

export function makeBatteryHistoryPoint(metrics: SystemMetrics, t: number): BatteryHistoryPoint | null {
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

export function isBatteryDraining(status: string): boolean {
  return status.toLowerCase().includes('discharging');
}

export function isBatteryCharging(status: string): boolean {
  const statusLower = status.toLowerCase();
  return !statusLower.includes('discharging') && (statusLower.includes('charging') || statusLower.includes('charged'));
}

export function clampBatteryPercent(percent: number): number {
  return Math.max(0, Math.min(percent, 100));
}

function parseBatteryTimeLeftMs(timeLeft?: string): number | null {
  const formatted = formatBatteryTimeLeft(timeLeft);
  if (formatted === '-') return null;

  const match = formatted.match(/^(\d+):(\d{2})$/);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || minutes >= 60) return null;

  const milliseconds = (hours * 60 + minutes) * 60000;
  return milliseconds > 0 ? milliseconds : null;
}

function formatBatteryDuration(milliseconds: number): string {
  const totalMinutes = Math.max(1, Math.round(milliseconds / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours <= 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

export function getBatteryDayBounds(now: number): { start: number; end: number } {
  const startDate = new Date(now);
  startDate.setHours(0, 0, 0, 0);
  const start = startDate.getTime();

  return { start, end: start + DAY_MS };
}

export function getBatteryHourTicks(dayStart: number): number[] {
  return Array.from({ length: 25 }, (_, hour) => dayStart + hour * HOUR_MS);
}

export function formatBatteryHourTick(value: number, dayStart: number): string {
  const hour = Math.round((value - dayStart) / HOUR_MS);
  return hour % 6 === 0 ? String(hour).padStart(2, '0') : '';
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

function getForecastEndBattery(prediction: BatteryPrediction, forecastEnd: number): number | null {
  const current = prediction.current;
  if (!current || prediction.ratePerHour == null) return null;
  if (prediction.targetTime != null && forecastEnd === prediction.targetTime) {
    if (prediction.direction === 'up') return 100;
    if (prediction.direction === 'down') return 0;
  }

  return prediction.projectedBattery ?? clampBatteryPercent(current.battery + prediction.ratePerHour * ((forecastEnd - current.t) / HOUR_MS));
}

export function getBatteryChartData(history: BatteryHistoryPoint[], prediction: BatteryPrediction, now: number): BatteryChartPoint[] {
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

  if (current && current.t <= end && prediction.ratePerHour != null) {
    const forecastEnd = prediction.targetTime != null && prediction.targetTime > current.t
      ? Math.min(prediction.targetTime, end)
      : end;
    const projectedBattery = getForecastEndBattery(prediction, forecastEnd);

    upsertBatteryChartPoint(chart, {
      t: current.t,
      battery: null,
      predictedBattery: current.battery,
      status: current.status,
      timeLeft: current.timeLeft,
      forecast: true,
    });
    upsertBatteryChartPoint(chart, {
      t: forecastEnd,
      battery: null,
      predictedBattery: projectedBattery,
      status: 'Predicted',
      forecast: true,
    });
  }

  return [...chart.values()].sort((a, b) => a.t - b.t);
}

function getBatteryHistoryRate(
  points: BatteryHistoryPoint[],
  current: BatteryHistoryPoint,
  direction: 'up' | 'down' | 'any',
): number | null {
  const sortedPoints = trimBatteryHistory([...points, current])
    .sort((a, b) => a.t - b.t)
    .filter((point, index, all) => index === all.length - 1 || point.t !== all[index + 1].t);

  let totalDelta = 0;
  let totalHours = 0;

  for (let index = 1; index < sortedPoints.length; index += 1) {
    const previous = sortedPoints[index - 1];
    const next = sortedPoints[index];
    const delta = next.battery - previous.battery;
    const elapsedHours = (next.t - previous.t) / HOUR_MS;

    if (elapsedHours <= 0 || delta === 0) continue;
    if (direction === 'up' && delta <= 0) continue;
    if (direction === 'down' && delta >= 0) continue;

    totalDelta += delta;
    totalHours += elapsedHours;
  }

  if (totalHours <= 0) return null;

  const ratePerHour = totalDelta / totalHours;
  return Number.isFinite(ratePerHour) && ratePerHour !== 0 ? ratePerHour : null;
}

function getBatteryTargetTime(current: BatteryHistoryPoint, ratePerHour: number): number | null {
  if (ratePerHour > 0) {
    const percentToFull = 100 - current.battery;
    if (percentToFull <= 0) return current.t;
    return current.t + (percentToFull / ratePerHour) * HOUR_MS;
  }

  if (ratePerHour < 0) {
    const hoursToEmpty = current.battery / Math.abs(ratePerHour);
    return current.t + hoursToEmpty * HOUR_MS;
  }

  return null;
}

export function getBatteryPrediction(metrics: SystemMetrics | null, history: BatteryHistoryPoint[], now: number): BatteryPrediction {
  const current = metrics ? makeBatteryHistoryPoint(metrics, now) : null;
  if (!current) {
    return {
      label: 'No battery data',
      detail: 'Waiting for samples',
      current: null,
      projectedBattery: null,
      targetTime: null,
      ratePerHour: null,
      direction: 'flat',
    };
  }

  const timeLeftMs = parseBatteryTimeLeftMs(current.timeLeft);
  const points = trimBatteryHistory([...history, current]).sort((a, b) => a.t - b.t);
  let direction: BatteryPrediction['direction'] = 'flat';
  let ratePerHour: number | null = null;

  if (isBatteryCharging(current.status)) {
    if (current.battery >= 99.5 || current.status.toLowerCase().includes('charged')) {
      ratePerHour = 0;
    } else {
      direction = 'up';
      ratePerHour = getBatteryHistoryRate(points, current, 'up') ?? (timeLeftMs ? (100 - current.battery) / (timeLeftMs / HOUR_MS) : null);
    }
  } else if (isBatteryDraining(current.status)) {
    direction = 'down';
    ratePerHour = getBatteryHistoryRate(points, current, 'down') ?? (timeLeftMs ? -current.battery / (timeLeftMs / HOUR_MS) : null);
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
      targetTime: null,
      ratePerHour,
      direction,
    };
  }

  const { end } = getBatteryDayBounds(now);
  const hoursToMidnight = Math.max(0, (end - current.t) / HOUR_MS);
  const projectedBattery = clampBatteryPercent(current.battery + ratePerHour * hoursToMidnight);
  const targetTime = getBatteryTargetTime(current, ratePerHour);

  if (ratePerHour === 0) {
    return {
      label: `Midnight ${projectedBattery.toFixed(0)}%`,
      detail: 'Flat estimate',
      current,
      projectedBattery,
      targetTime,
      ratePerHour,
      direction: 'flat',
    };
  }

  const statusLabel = direction === 'up' ? 'charging' : 'discharging';
  const targetLabel = direction === 'up' ? 'Full' : 'Empty';
  const targetDuration = targetTime ? formatBatteryDuration(targetTime - current.t) : null;

  return {
    label: targetDuration ? `${targetLabel} in ${targetDuration}` : `Midnight ${projectedBattery.toFixed(0)}%`,
    detail: `${ratePerHour > 0 ? '+' : ''}${ratePerHour.toFixed(1)}%/hr ${statusLabel}`,
    current,
    projectedBattery,
    targetTime,
    ratePerHour,
    direction,
  };
}
