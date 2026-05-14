import { fireEvent, render, screen } from '@testing-library/react';
import { AnalyzePage } from './AnalyzePage';

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

describe('AnalyzePage', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    mockLocalStorage();
    mockMoleDesktop();
  });

  it('updates the scan path when a quick mode is selected', () => {
    render(<AnalyzePage />);

    fireEvent.click(screen.getByRole('button', { name: /analyze storage/i }));

    const pathInput = screen.getByPlaceholderText('/path/to/folder');
    expect(pathInput).toHaveValue('/');

    fireEvent.click(screen.getByRole('button', { name: /home folder/i }));
    expect(pathInput).toHaveValue('~');

    fireEvent.click(screen.getByRole('button', { name: /downloads/i }));
    expect(pathInput).toHaveValue('~/Downloads');
  });
});
