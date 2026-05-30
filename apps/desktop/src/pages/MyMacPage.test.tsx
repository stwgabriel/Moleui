import { render, screen, waitFor } from '@testing-library/react';
import { getBatteryChartData, getBatteryPrediction } from '@/utils/batteryPrediction';
import type { SystemMetrics } from '@/types';
import { MyMacPage } from './MyMacPage';

const HOUR_MS = 60 * 60 * 1000;

function metricsWithBattery(percent: number, status: string, timeLeft?: string): SystemMetrics {
  return {
    host: 'Test Mac',
    uptime: '1 day',
    cpu: { usage: 12, core_count: 8, load1: 1, load5: 1, load15: 1 },
    memory: { used: 4, total: 16, used_percent: 25 },
    disks: [{ mount: '/', used: 100, total: 500, used_percent: 20 }],
    network: [],
    disk_io: { read_rate: 0, write_rate: 0 },
    batteries: [{
      percent,
      status,
      health: 'Normal',
      cycle_count: 120,
      time_left: timeLeft,
    }],
    gpu: [],
    processes: [],
    health_score: 92,
  };
}

describe('getBatteryPrediction', () => {
  it('predicts time to full from previous charging percentage changes', () => {
    const now = new Date('2026-05-23T12:00:00Z').getTime();

    const prediction = getBatteryPrediction(metricsWithBattery(60, 'charging'), [
      { t: now - 4 * HOUR_MS, battery: 40, status: 'charging' },
      { t: now - 2 * HOUR_MS, battery: 50, status: 'charging' },
    ], now);

    expect(prediction.direction).toBe('up');
    expect(prediction.ratePerHour).toBeCloseTo(5);
    expect(prediction.label).toBe('Full in 8h');
    expect(prediction.detail).toBe('+5.0%/hr charging');
    expect(prediction.projectedBattery).toBe(100);
  });

  it('predicts time to empty from previous discharging percentage changes', () => {
    const now = new Date('2026-05-23T12:00:00Z').getTime();

    const prediction = getBatteryPrediction(metricsWithBattery(60, 'discharging'), [
      { t: now - 5 * HOUR_MS, battery: 90, status: 'discharging' },
      { t: now - 2 * HOUR_MS, battery: 75, status: 'discharging' },
    ], now);

    expect(prediction.direction).toBe('down');
    expect(prediction.ratePerHour).toBeCloseTo(-6);
    expect(prediction.label).toBe('Empty in 10h');
    expect(prediction.detail).toBe('-6.0%/hr discharging');
    expect(prediction.projectedBattery).toBe(0);
  });

  it('ends the forecast graph at the predicted full time', () => {
    const now = new Date('2026-05-23T12:00:00Z').getTime();
    const prediction = getBatteryPrediction(metricsWithBattery(60, 'charging'), [
      { t: now - 4 * HOUR_MS, battery: 40, status: 'charging' },
      { t: now - 2 * HOUR_MS, battery: 50, status: 'charging' },
    ], now);

    const chartData = getBatteryChartData([], prediction, now);
    const forecastPoints = chartData.filter((point) => point.forecast);
    const finalForecastPoint = forecastPoints[forecastPoints.length - 1];

    expect(forecastPoints).toHaveLength(2);
    expect(finalForecastPoint.t).toBe(prediction.targetTime);
    expect(finalForecastPoint.predictedBattery).toBe(100);
  });
});

function findCard(label: string): HTMLElement {
  let element = screen.getByText(label).parentElement;

  while (element && !element.className.includes('bg-white/45')) {
    element = element.parentElement;
  }

  if (!element) throw new Error(`Card not found for ${label}`);
  return element;
}

function mockLocalStorage() {
  const storage = new Map<string, string>();

  vi.stubGlobal('localStorage', {
    getItem: vi.fn((key: string) => storage.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      storage.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      storage.delete(key);
    }),
    clear: vi.fn(() => {
      storage.clear();
    }),
  });
}

function mockMoleDesktop(metrics: SystemMetrics) {
  window.moleDesktop = {
    getRuntimeInfo: vi.fn(),
    openExternal: vi.fn(),
    copyText: vi.fn(),
    revealPath: vi.fn(),
    openPathInFinder: vi.fn(),
    deletePath: vi.fn(),
    openActivityMonitor: vi.fn(),
    signalProcess: vi.fn(),
    runStatus: vi.fn().mockResolvedValue({
      ok: true,
      command: 'mo status --json',
      exitCode: 0,
      stdout: JSON.stringify(metrics),
      stderr: '',
    }),
    clean: {
      execute: vi.fn(),
      kill: vi.fn(),
      onStdout: vi.fn(),
      onStderr: vi.fn(),
      removeListeners: vi.fn(),
    },
    optimize: {
      execute: vi.fn(),
      kill: vi.fn(),
      onStdout: vi.fn(),
      onStderr: vi.fn(),
      removeListeners: vi.fn(),
    },
    analyze: {
      execute: vi.fn(),
      kill: vi.fn(),
      onStdout: vi.fn(),
      onStderr: vi.fn(),
      removeListeners: vi.fn(),
    },
    uninstall: {
      list: vi.fn(),
      killList: vi.fn(),
      getAppIcon: vi.fn(),
      getAppIcons: vi.fn(),
      dryRun: vi.fn(),
      execute: vi.fn(),
      onListStdout: vi.fn(),
      onListStderr: vi.fn(),
      onDryRunStdout: vi.fn(),
      onDryRunStderr: vi.fn(),
      onExecuteStdout: vi.fn(),
      onExecuteStderr: vi.fn(),
      removeListeners: vi.fn(),
    },
  };
}

describe('MyMacPage layout', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    mockLocalStorage();
    mockMoleDesktop(metricsWithBattery(60, 'discharging'));
  });

  it('gives Mac info and processor full columns while RAM and storage split one column', async () => {
    render(<MyMacPage onNavigate={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('Processor')).toBeInTheDocument());

    const processorCard = findCard('Processor');
    const ramCard = findCard('RAM');
    const storageCard = findCard('Storage');
    const metricsGrid = processorCard.parentElement;

    expect(metricsGrid).toHaveClass('grid-cols-[1fr_1fr_0.5fr_0.5fr]');
    expect(processorCard).toHaveClass('col-start-2');
    expect(ramCard).toHaveClass('col-start-3');
    expect(storageCard).toHaveClass('col-start-4');
  });
});
