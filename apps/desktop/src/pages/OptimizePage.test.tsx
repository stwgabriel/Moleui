import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { OptimizePage } from './OptimizePage';
import type { MoleResult } from '@/types';

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

function mockMoleDesktop() {
  window.moleDesktop = {
    getRuntimeInfo: vi.fn(),
    openExternal: vi.fn(),
    copyText: vi.fn(),
    revealPath: vi.fn(),
    openPathInFinder: vi.fn(),
    deletePath: vi.fn(),
    openActivityMonitor: vi.fn(),
    signalProcess: vi.fn(),
    runStatus: vi.fn(),
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

const successfulOptimizeResult: MoleResult = {
  ok: true,
  command: 'mole optimize --dry-run',
  exitCode: 0,
  stdout: '',
  stderr: '',
};

describe('OptimizePage', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    mockLocalStorage();
    localStorage.clear();
    mockMoleDesktop();
    vi.mocked(window.moleDesktop.optimize.kill).mockResolvedValue({ ok: true } as any);
  });

  it('returns to the start screen when cancelling a recovered preview', async () => {
    localStorage.setItem('mole-optimize-stage', JSON.stringify('previewing'));

    render(<OptimizePage />);

    fireEvent.click(screen.getByRole('button', { name: /cancel preview/i }));

    await waitFor(() => expect(screen.getByRole('button', { name: /start optimization/i })).toBeInTheDocument());
    expect(window.moleDesktop.optimize.kill).toHaveBeenCalledOnce();
    expect(window.moleDesktop.optimize.removeListeners).toHaveBeenCalled();
  });

  it('ignores a late successful preview result after cancellation', async () => {
    let finishPreview: (result: MoleResult) => void = () => {};
    vi.mocked(window.moleDesktop.optimize.execute).mockReturnValue(
      new Promise<MoleResult>((resolve) => {
        finishPreview = resolve;
      })
    );

    render(<OptimizePage />);

    fireEvent.click(screen.getByRole('button', { name: /start optimization/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /cancel preview/i })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /cancel preview/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /start optimization/i })).toBeInTheDocument());

    await act(async () => {
      finishPreview(successfulOptimizeResult);
    });

    expect(screen.getByRole('button', { name: /start optimization/i })).toBeInTheDocument();
    expect(screen.queryByText('Preview Results')).not.toBeInTheDocument();
  });

  it('runs only selected preview tasks', async () => {
    localStorage.setItem('mole-optimize-stage', JSON.stringify('preview-results'));
    localStorage.setItem('mole-optimize-preview-timeline', JSON.stringify([
      {
        id: 'task-login',
        name: 'Login Items Audit',
        status: 'complete',
        items: ['Would review login items'],
        selected: true,
      },
      {
        id: 'task-fonts',
        name: 'Font Cache Rebuild',
        status: 'complete',
        items: ['Would rebuild font cache'],
        selected: true,
      },
    ]));
    vi.mocked(window.moleDesktop.optimize.execute).mockResolvedValue(successfulOptimizeResult);

    render(<OptimizePage />);

    fireEvent.click(screen.getByRole('button', { name: 'Deselect Font Cache Rebuild' }));
    fireEvent.click(screen.getByRole('button', { name: /apply optimizations/i }));

    await waitFor(() => expect(window.moleDesktop.optimize.execute).toHaveBeenCalled());
    expect(window.moleDesktop.optimize.execute).toHaveBeenCalledWith({
      dryRun: false,
      taskNames: ['Login Items Audit'],
    });
  });

  it('builds preview tasks from streamed optimize stdout', async () => {
    let stdoutHandler: (text: string) => void = () => {};
    vi.mocked(window.moleDesktop.optimize.onStdout).mockImplementation((handler: (text: string) => void) => {
      stdoutHandler = handler;
    });
    vi.mocked(window.moleDesktop.optimize.execute).mockImplementation(async () => {
      stdoutHandler('\u001b[1;34m➤ DNS & Spotlight Check\u001b[0m\n  \u001b[0;33m→\u001b[0m DNS cache flushed\n');
      return successfulOptimizeResult;
    });

    render(<OptimizePage />);

    fireEvent.click(screen.getByRole('button', { name: /start optimization/i }));

    await waitFor(() => expect(screen.getByText('DNS & Spotlight Check')).toBeInTheDocument());
    expect(screen.getByText('Would flush DNS cache')).toBeInTheDocument();
  });

  it('shows the centered staged cards with system impact metrics', () => {
    localStorage.setItem('mole-optimize-stage', JSON.stringify('preview-results'));
    localStorage.setItem('mole-optimize-preview-timeline', JSON.stringify([
      {
        id: 'task-dns',
        name: 'DNS & Spotlight Check',
        status: 'complete',
        items: ['Would refresh DNS cache', 'Would rebuild Spotlight index'],
        selected: true,
      },
    ]));

    render(<OptimizePage />);

    expect(screen.getAllByText('Analyze').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Tune').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Apply').length).toBeGreaterThan(0);
    expect(screen.getByText('1/1 tweaks selected')).toBeInTheDocument();
    expect(screen.getByRole('meter', { name: 'Performance impact' })).toHaveAttribute('aria-valuenow', '5');
    expect(screen.getByRole('meter', { name: 'Responsiveness impact' })).toHaveAttribute('aria-valuenow', '6');
    expect(screen.getAllByText(/tweaks ready/i).length).toBeGreaterThan(0);
  });

  it('shows an explicit no optimizations result from preview output', () => {
    localStorage.setItem('mole-optimize-stage', JSON.stringify('preview-results'));
    localStorage.setItem('mole-optimize-preview-logs', JSON.stringify([
      {
        text: 'No Optimizations Found\nNo changes would be applied\nSystem already optimized',
        timestamp: Date.now(),
        type: 'success',
      },
    ]));

    render(<OptimizePage />);

    expect(screen.getByText('System is clean.')).toBeInTheDocument();
    expect(screen.getByText('There is nothing to optimize.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /apply optimizations/i })).not.toBeInTheDocument();
  });

  it('treats all-noop preview tasks as no optimizations found', () => {
    localStorage.setItem('mole-optimize-stage', JSON.stringify('preview-results'));
    localStorage.setItem('mole-optimize-preview-timeline', JSON.stringify([
      {
        id: 'task-health',
        name: 'System Health Check',
        status: 'complete',
        items: ['All preference files valid', 'Network stack already optimal', 'Launch Agents all healthy'],
        selected: true,
      },
    ]));

    render(<OptimizePage />);

    expect(screen.getByText('System is clean.')).toBeInTheDocument();
    expect(screen.getByText('There is nothing to optimize.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /apply optimizations/i })).not.toBeInTheDocument();
  });

  it('filters no-op streamed optimize lines before showing preview tweaks', async () => {
    let stdoutHandler: (text: string) => void = () => {};
    vi.mocked(window.moleDesktop.optimize.onStdout).mockImplementation((handler: (text: string) => void) => {
      stdoutHandler = handler;
    });
    vi.mocked(window.moleDesktop.optimize.execute).mockImplementation(async () => {
      stdoutHandler('➤ System Health Check\n  ✓ All preference files valid\n  ○ No outdated launch agents found\n  ℹ Network stack already optimal\n');
      return successfulOptimizeResult;
    });

    render(<OptimizePage />);

    fireEvent.click(screen.getByRole('button', { name: /start optimization/i }));

    await waitFor(() => expect(screen.getByText('System is clean.')).toBeInTheDocument());
    expect(screen.queryByText('System Health Check')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /apply optimizations/i })).not.toBeInTheDocument();
  });

  it('shows only actionable streamed optimize tweaks', async () => {
    let stdoutHandler: (text: string) => void = () => {};
    vi.mocked(window.moleDesktop.optimize.onStdout).mockImplementation((handler: (text: string) => void) => {
      stdoutHandler = handler;
    });
    vi.mocked(window.moleDesktop.optimize.execute).mockImplementation(async () => {
      stdoutHandler('➤ DNS & Spotlight Check\n  ✓ DNS already optimal\n  → Spotlight index rebuilt\n  ○ No network issues found\n');
      return successfulOptimizeResult;
    });

    render(<OptimizePage />);

    fireEvent.click(screen.getByRole('button', { name: /start optimization/i }));

    await waitFor(() => expect(screen.getByText('DNS & Spotlight Check')).toBeInTheDocument());
    expect(screen.getByText('Would rebuild Spotlight index')).toBeInTheDocument();
    expect(screen.queryByText('DNS already optimal')).not.toBeInTheDocument();
    expect(screen.queryByText('No network issues found')).not.toBeInTheDocument();
  });
});
