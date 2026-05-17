import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CleanPage } from './CleanPage';

const categories = [
  {
    section: 'Developer tools',
    name: 'Developer Tools',
    icon: 'Code',
    color: '#ec4899',
    size: 3 * 1024 * 1024 * 1024,
    fileCount: 42,
    items: ['npm cache, 1.5 GB'],
    cleanable: true,
    scanned: true,
  },
  {
    section: 'App caches',
    name: 'App Caches',
    icon: 'Package',
    color: '#06b6d4',
    size: 700 * 1024 * 1024,
    fileCount: 18,
    items: ['Slack cache, 700 MB'],
    cleanable: true,
    scanned: true,
  },
  {
    section: 'Browsers',
    name: 'Browser Data',
    icon: 'Globe',
    color: '#10b981',
    size: 1024 * 1024 * 1024,
    fileCount: 27,
    items: ['Chrome cache, 1 GB'],
    cleanable: true,
    scanned: true,
  },
  {
    section: 'Applications',
    name: 'Applications',
    icon: 'AppWindow',
    color: '#f97316',
    size: 0,
    fileCount: 0,
    items: ['No cleanable files found in this section.'],
    cleanable: false,
    scanned: true,
  },
];

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

function seedCleanResults() {
  localStorage.setItem('mole-clean-stage', JSON.stringify('results'));
  localStorage.setItem('mole-clean-categories', JSON.stringify(categories));
  localStorage.setItem(
    'mole-clean-selected-sections',
    JSON.stringify(categories.filter((category) => category.cleanable).map((category) => category.section)),
  );
  localStorage.setItem('mole-clean-total-size', JSON.stringify(categories.reduce((sum, category) => sum + category.size, 0)));
  localStorage.setItem('mole-clean-cleaned-size', JSON.stringify(0));
  localStorage.setItem('mole-clean-expanded-sections', JSON.stringify([]));
  localStorage.setItem('mole-clean-sort-by', JSON.stringify('size'));
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

function visibleSectionNames() {
  return screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent);
}

describe('CleanPage', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    mockLocalStorage();
    localStorage.clear();
    mockMoleDesktop();
    seedCleanResults();
  });

  it('sorts scan results by size and name', () => {
    render(<CleanPage />);

    expect(visibleSectionNames()).toEqual(['Developer Tools', 'Browser Data', 'App Caches', 'Applications']);

    fireEvent.change(screen.getByLabelText('Sort cleanup sections'), { target: { value: 'name' } });

    expect(visibleSectionNames()).toEqual(['App Caches', 'Applications', 'Browser Data', 'Developer Tools']);
  });

  it('returns to the start screen when stopping a stale scan', async () => {
    localStorage.setItem('mole-clean-stage', JSON.stringify('scanning'));
    vi.mocked(window.moleDesktop.clean.kill).mockResolvedValue({ ok: false } as any);

    render(<CleanPage />);

    fireEvent.click(screen.getByRole('button', { name: /stop scan/i }));

    await waitFor(() => expect(screen.getByRole('button', { name: /start cleaning/i })).toBeInTheDocument());
    expect(window.moleDesktop.clean.kill).toHaveBeenCalledOnce();
    expect(window.moleDesktop.clean.removeListeners).toHaveBeenCalled();
  });

  it('returns to results when stopping a stale cleanup', async () => {
    localStorage.setItem('mole-clean-stage', JSON.stringify('cleaning'));
    vi.mocked(window.moleDesktop.clean.kill).mockResolvedValue({ ok: false } as any);

    render(<CleanPage />);

    fireEvent.click(screen.getByRole('button', { name: /stop cleaning/i }));

    await waitFor(() => expect(screen.getByText('Scan Results')).toBeInTheDocument());
    expect(window.moleDesktop.clean.kill).toHaveBeenCalledOnce();
    expect(window.moleDesktop.clean.removeListeners).toHaveBeenCalled();
  });
});
