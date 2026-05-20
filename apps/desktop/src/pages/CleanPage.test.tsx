import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CleanPage } from './CleanPage';

const groups = [
  {
    id: 'system',
    name: 'System',
    subtitle: 'System, user, Apple, firmware and Time Machine cleanup',
    command: 'clean',
    sections: ['System'],
    color: '#3b82f6',
    tint: 'bg-violet-100 text-violet-600 shadow-violet-200/70',
    icon: 'system',
    size: 1024 * 1024 * 1024,
    fileCount: 2,
    items: [
      {
        id: 'system-1',
        label: 'System cache, 1 GB',
        size: 1024 * 1024 * 1024,
        sourceLine: 'System cache, 1 GB',
        selected: true,
      },
    ],
    logs: [],
    status: 'ready',
    selected: true,
    expanded: true,
  },
  {
    id: 'apps',
    name: 'Application Junk',
    subtitle: 'Browsers, cloud apps, GUI apps, app support and leftovers',
    command: 'clean',
    sections: ['Browsers'],
    color: '#a855f7',
    tint: 'bg-blue-100 text-blue-500 shadow-blue-200/70',
    icon: 'apps',
    size: 512 * 1024 * 1024,
    fileCount: 1,
    items: [
      {
        id: 'apps-1',
        label: 'Chrome cache, 512 MB',
        size: 512 * 1024 * 1024,
        sourceLine: 'Chrome cache, 512 MB',
        selected: true,
      },
    ],
    logs: [],
    status: 'ready',
    selected: true,
    expanded: false,
  },
] as const;

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
  localStorage.setItem('mole-clean-groups', JSON.stringify(groups));
  localStorage.setItem('mole-clean-cleaned-size', JSON.stringify(0));
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

describe('CleanPage', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    mockLocalStorage();
    localStorage.clear();
    mockMoleDesktop();
    seedCleanResults();
  });

  it('shows grouped cleanup results', () => {
    render(<CleanPage />);

    expect(screen.getByText('Review junk before cleaning')).toBeInTheDocument();
    expect(screen.queryByText('Smart Cleanup')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'System' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Application Junk' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start cleaning 1\.5 GB/i })).toBeInTheDocument();
  });

  it('allows cleanup groups to be excluded from cleaning', () => {
    render(<CleanPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Deselect System' }));
    fireEvent.click(screen.getByRole('button', { name: 'Deselect Application Junk' }));

    expect(screen.getByRole('button', { name: /start cleaning 0 GB/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Select System' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Select Application Junk' })).toBeInTheDocument();
  });

  it('scans every cleanup section exposed by the cleanup CLI', async () => {
    localStorage.clear();
    vi.mocked(window.moleDesktop.clean.execute).mockResolvedValue({ ok: true, stdout: '', stderr: '' } as any);

    render(<CleanPage />);

    fireEvent.click(screen.getByRole('button', { name: /scan for junk/i }));

    await waitFor(() => expect(window.moleDesktop.clean.execute).toHaveBeenCalled());

    const cleanDryRunCalls = vi.mocked(window.moleDesktop.clean.execute).mock.calls
      .map(([options]) => options)
      .filter((options) => options.command === 'clean' && options.dryRun);
    const scannedSections = cleanDryRunCalls.flatMap((options) => options.sections ?? []);

    expect(scannedSections).toEqual([
      'System',
      'User essentials',
      'App caches',
      'Browsers',
      'Cloud & Office',
      'Developer tools',
      'Applications',
      'Virtualization',
      'Application Support',
      'App leftovers',
      'Apple Silicon',
      'Device backups & firmware',
      'Time Machine',
      'Large files',
      'System Data clues',
      'Project artifacts',
    ]);
  });

  it('surfaces dry-run command failures instead of reporting the category as clean', async () => {
    localStorage.clear();
    vi.mocked(window.moleDesktop.clean.execute).mockImplementation(async (options) => {
      if (options.command === 'installer') {
        return {
          ok: false,
          stdout: '',
          stderr: '/runtime/bin/installer.sh: No such file or directory',
          exitCode: 127,
        } as any;
      }

      return { ok: true, stdout: '', stderr: '' } as any;
    });

    render(<CleanPage />);

    fireEvent.click(screen.getByRole('button', { name: /scan for junk/i }));

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Installer Files' })).toBeInTheDocument());
    expect(screen.getByText('/runtime/bin/installer.sh: No such file or directory')).toBeInTheDocument();
    expect(screen.queryByText('Installer Files 0 GB Clean')).not.toBeInTheDocument();
  });

  it('keeps cleanable arrow-prefixed dry-run results after the group finishes scanning', async () => {
    localStorage.clear();
    vi.mocked(window.moleDesktop.clean.execute).mockImplementation(async (options) => {
      if (options.command === 'clean' && options.sections?.includes('User essentials')) {
        return {
          ok: true,
          stdout: '➤ User essentials\n  → User app cache 174 items, 3.31GB dry\n',
          stderr: '',
          exitCode: 0,
        } as any;
      }

      return { ok: true, stdout: '', stderr: '', exitCode: 0 } as any;
    });

    render(<CleanPage />);

    fireEvent.click(screen.getByRole('button', { name: /scan for junk/i }));

    await waitFor(() => expect(screen.getByRole('button', { name: /start cleaning 3\.3 GB/i })).toBeInTheDocument());
    expect(screen.getByRole('heading', { name: 'User Essentials' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Expand User Essentials' }));
    expect(screen.getByText('User app cache 174 items')).toBeInTheDocument();
  });

  it('treats dry-run exit code 2 as an empty cleanup group', async () => {
    localStorage.clear();
    vi.mocked(window.moleDesktop.clean.execute).mockImplementation(async (options) => {
      if (options.command === 'purge') {
        return {
          ok: false,
          stdout: 'Great! No old project artifacts to clean',
          stderr: '',
          exitCode: 2,
        } as any;
      }

      return { ok: true, stdout: '', stderr: '' } as any;
    });

    render(<CleanPage />);

    fireEvent.click(screen.getByRole('button', { name: /scan for junk/i }));

    await waitFor(() => expect(screen.getByRole('button', { name: /start cleaning 0 GB/i })).toBeDisabled());
    expect(screen.queryByRole('heading', { name: 'Project Artifacts' })).not.toBeInTheDocument();
    expect(screen.queryByText(/scan failed/i)).not.toBeInTheDocument();
  });

  it('shows only the active category row while scanning', () => {
    localStorage.setItem('mole-clean-stage', JSON.stringify('analyzing'));
    localStorage.setItem(
      'mole-clean-groups',
      JSON.stringify([
        {
          ...groups[0],
          id: 'user',
          name: 'User Essentials',
          sections: ['User essentials'],
          status: 'active',
          items: [],
          size: 0,
          fileCount: 0,
          selected: false,
          expanded: true,
        },
      ]),
    );

    render(<CleanPage />);

    expect(screen.getByRole('heading', { name: 'User Essentials' })).toBeInTheDocument();
    expect(screen.queryByText('Finding more junk')).not.toBeInTheDocument();
  });

  it('returns to the start screen when stopping analysis', async () => {
    localStorage.setItem('mole-clean-stage', JSON.stringify('analyzing'));
    vi.mocked(window.moleDesktop.clean.kill).mockResolvedValue({ ok: false } as any);

    render(<CleanPage />);

    fireEvent.click(screen.getByRole('button', { name: /stop/i }));

    await waitFor(() => expect(screen.getByRole('button', { name: /scan for junk/i })).toBeInTheDocument());
    expect(window.moleDesktop.clean.kill).toHaveBeenCalledOnce();
    expect(window.moleDesktop.clean.removeListeners).toHaveBeenCalled();
  });

  it('falls back to the start screen for an invalid recovered cleanup stage', () => {
    localStorage.setItem('mole-clean-stage', JSON.stringify('cleanup'));

    render(<CleanPage />);

    expect(screen.getByRole('button', { name: /scan for junk/i })).toBeInTheDocument();
  });

  it('returns to results when stopping cleanup', async () => {
    localStorage.setItem('mole-clean-stage', JSON.stringify('cleaning'));
    vi.mocked(window.moleDesktop.clean.kill).mockResolvedValue({ ok: false } as any);

    render(<CleanPage />);

    fireEvent.click(screen.getByRole('button', { name: /stop/i }));

    await waitFor(() => expect(screen.getByRole('button', { name: /start cleaning 1\.5 GB/i })).toBeInTheDocument());
    expect(window.moleDesktop.clean.kill).toHaveBeenCalledOnce();
    expect(window.moleDesktop.clean.removeListeners).toHaveBeenCalled();
  });
});
