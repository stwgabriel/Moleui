import { render, screen } from '@testing-library/react';
import { UninstallPage } from './UninstallPage';

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

describe('UninstallPage', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    mockLocalStorage();
    localStorage.clear();
    mockMoleDesktop();
  });

  it('renders uninstall progress from multi-line execute output chunks', () => {
    localStorage.setItem('mole-uninstall-stage', JSON.stringify('executing'));
    localStorage.setItem(
      'mole-uninstall-execute-output',
      JSON.stringify([
        [
          '[1/2] Uninstalling App 1...',
          '  ✓ /Applications/App 1.app',
          '✓ [1/2] App 1',
          '[2/2] Uninstalling App 2...',
          '  ✓ ~/Library/Caches/App 2',
        ].join('\n'),
      ]),
    );

    render(<UninstallPage />);

    expect(screen.getByText('App 1')).toBeInTheDocument();
    expect(screen.getAllByText('App 2').length).toBeGreaterThan(0);
    expect(screen.getByText('2 of 2')).toBeInTheDocument();
    expect(screen.queryByText(/Removing App 2/i)).not.toBeInTheDocument();
  });
});
