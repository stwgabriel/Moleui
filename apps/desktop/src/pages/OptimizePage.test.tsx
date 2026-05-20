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
});
