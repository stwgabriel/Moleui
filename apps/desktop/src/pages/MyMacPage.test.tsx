import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

function metricsWithProcesses(processes: NonNullable<SystemMetrics['processes']>): SystemMetrics {
  return {
    ...metricsWithBattery(60, 'discharging'),
    processes,
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

function findCard(label: string, matchingClass?: string): HTMLElement {
  const cards = screen.getAllByText(label).map((textElement) => {
    let element = textElement.parentElement;

    while (element && !element.className.includes('bg-white/45')) {
      element = element.parentElement;
    }

    return element;
  }).filter((element): element is HTMLElement => Boolean(element));

  const card = matchingClass
    ? cards.find((element) => element.className.includes(matchingClass))
    : cards[0];

  if (!card) throw new Error(`Card not found for ${label}`);
  return card;
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
    getProcessIcons: vi.fn().mockResolvedValue({ ok: true, icons: {}, missing: [] }),
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

  it('lays out Mac info and metrics on equal-width dashboard columns', async () => {
    render(<MyMacPage onNavigate={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('Processor')).toBeInTheDocument());

    const macInfoCard = findCard('Health Score');
    const processorCard = findCard('Processor');
    const ramCard = findCard('RAM');
    const storageCard = findCard('Storage');
    const gpuCard = findCard('GPU');
    const networkCard = findCard('Network');
    const batteryCard = findCard('Battery', 'row-start-2');
    const metricsGrid = processorCard.parentElement;

    expect(metricsGrid).toHaveClass('grid-cols-4');
    expect(macInfoCard).toHaveClass('col-start-1', 'row-span-2');
    expect(processorCard).toHaveClass('col-start-2');
    expect(ramCard).toHaveClass('col-start-3');
    expect(storageCard).toHaveClass('col-start-4');
    expect(gpuCard).toHaveClass('col-start-2', 'row-start-2');
    expect(networkCard).toHaveClass('col-start-3', 'row-start-2');
    expect(batteryCard).toHaveClass('col-start-4', 'row-start-2');
  });

  it('requests icons for every process so lower-ranked rows can receive app artwork', async () => {
    const processes = Array.from({ length: 40 }, (_, index) => ({
      name: `Process ${index + 1}`,
      pid: 3000 + index,
      cpu: 40 - index,
      memory: 40 - index,
      command: `/Applications/Process ${index + 1}.app/Contents/MacOS/Process ${index + 1}`,
    }));
    mockMoleDesktop(metricsWithProcesses(processes));

    render(<MyMacPage onNavigate={vi.fn()} />);

    const getProcessIcons = vi.mocked(window.moleDesktop.getProcessIcons!);
    await waitFor(() => expect(getProcessIcons).toHaveBeenCalled());

    const firstIconRequest = getProcessIcons.mock.calls[0];
    expect(firstIconRequest).toBeDefined();
    const requestedProcesses = firstIconRequest![0];
    expect(requestedProcesses).toHaveLength(40);
    expect(requestedProcesses).toEqual(expect.arrayContaining([
      expect.objectContaining({ pid: 3039 }),
    ]));
  });

  it('groups related processes by app and expands to show each process amount', async () => {
    mockMoleDesktop(metricsWithProcesses([
      {
        name: 'Example',
        pid: 4201,
        cpu: 7,
        memory: 2.5,
        memory_bytes: 100 * 1024 * 1024,
        command: '/Applications/Example.app/Contents/MacOS/Example',
      },
      {
        name: 'Example Helper',
        pid: 4202,
        cpu: 18,
        memory: 4.5,
        memory_bytes: 200 * 1024 * 1024,
        command: '/Applications/Example.app/Contents/Frameworks/Example Helper.app/Contents/MacOS/Example Helper',
      },
      {
        name: 'Safari',
        pid: 4301,
        cpu: 4,
        memory: 1.5,
        memory_bytes: 50 * 1024 * 1024,
        command: '/Applications/Safari.app/Contents/MacOS/Safari',
      },
    ]));

    render(<MyMacPage onNavigate={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('Apps & Processes')).toBeInTheDocument());

    expect(screen.getAllByText('Example').length).toBeGreaterThan(0);
    expect(screen.getByText('25.0%')).toBeInTheDocument();
    expect(screen.getByText('300 MB')).toBeInTheDocument();
    expect(screen.getByText('2 processes')).toBeInTheDocument();
    expect(screen.queryByText('Example Helper')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show processes for Example' }));

    expect(screen.getByText('Example Helper')).toBeInTheDocument();
    expect(screen.getByText('PID 4202')).toBeInTheDocument();
    expect(screen.getByText('18.0%')).toBeInTheDocument();
    expect(screen.getByText('200 MB')).toBeInTheDocument();
  });
});
