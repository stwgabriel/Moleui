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

  return storage;
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

describe('AnalyzePage', () => {
  let storage: Map<string, string>;

  beforeEach(() => {
    vi.unstubAllGlobals();
    storage = mockLocalStorage();
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

  it('filters analyzed results between files and folders across the file map', () => {
    storage.set('mole-analyze-stage', JSON.stringify('results'));
    storage.set('mole-analyze-result', JSON.stringify({
      path: '/Users/example',
      overview: false,
      total_size: 1000,
      entries: [
        { name: 'Documents', path: '/Users/example/Documents', size: 600, is_dir: true, last_access: '2026-05-10T10:00:00Z' },
        { name: 'movie.mov', path: '/Users/example/movie.mov', size: 400, is_dir: false, last_access: '2026-05-12T10:00:00Z' },
        { name: 'archive.zip', path: '/Users/example/archive.zip', size: 100, is_dir: false },
      ],
      large_files: [],
    }));

    render(<AnalyzePage />);

    expect(screen.getByRole('button', { name: /filter results/i })).toBeInTheDocument();
    expect(screen.getAllByTitle(/movie.mov - 400 b/i).length).toBeGreaterThan(0);
    expect(screen.queryByLabelText(/disk usage proportions/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /filter results/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /files/i }));

    expect(screen.queryAllByTitle(/movie.mov - 400 b/i)).toHaveLength(0);
    expect(screen.getAllByTitle(/documents - 600 b/i).length).toBeGreaterThan(0);
    expect(screen.queryByText('Other')).not.toBeInTheDocument();
  });

  it('switches to file management list mode and sorts by date', () => {
    storage.set('mole-analyze-stage', JSON.stringify('results'));
    storage.set('mole-analyze-result', JSON.stringify({
      path: '/Users/example',
      overview: false,
      total_size: 1000,
      entries: [
        { name: 'Documents', path: '/Users/example/Documents', size: 600, is_dir: true, last_access: '2026-05-10T10:00:00Z' },
        { name: 'movie.mov', path: '/Users/example/movie.mov', size: 400, is_dir: false, last_access: '2026-05-12T10:00:00Z' },
        { name: 'archive.zip', path: '/Users/example/archive.zip', size: 100, is_dir: false },
      ],
      large_files: [],
    }));

    render(<AnalyzePage />);

    fireEvent.click(screen.getByRole('button', { name: /file management list/i }));
    expect(screen.getByRole('heading', { name: /file management/i })).toBeInTheDocument();
    expect(screen.getByText('60.0% of parent')).toBeInTheDocument();
    expect(screen.getByLabelText(/disk usage proportions/i)).toBeInTheDocument();
    expect(screen.queryByText('Date unavailable')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /sort by date/i }));

    const rows = screen.getAllByTestId('file-management-row');
    expect(rows[0]).toHaveTextContent('movie.mov');
    expect(rows[1]).toHaveTextContent('Documents');
  });
});
