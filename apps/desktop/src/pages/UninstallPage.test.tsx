import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

    const { container } = render(<UninstallPage />);

    expect(screen.getByText('App 1')).toBeInTheDocument();
    expect(screen.getAllByText('App 2').length).toBeGreaterThan(0);
    expect(screen.getByText('2 of 2')).toBeInTheDocument();
    expect(screen.queryByText(/Removing App 2/i)).not.toBeInTheDocument();

    const animation = container.querySelector('[data-testid="uninstall-removal-animation"]');
    expect(animation).toBeInTheDocument();
    expect(animation?.querySelector('.animate-uninstall-strip-into-receiver')).toBeInTheDocument();
    expect(animation?.querySelector('.animate-uninstall-receiver-lid')).toBeInTheDocument();
    expect(animation?.querySelector('.uninstall-animation-removal-field')).toBeInTheDocument();
  });

  it('renders selected applications as glass bubbles and removes them from the cluster', () => {
    localStorage.setItem('mole-uninstall-stage', JSON.stringify('selection'));
    localStorage.setItem(
      'mole-uninstall-apps',
      JSON.stringify([
        {
          name: 'Figma',
          bundle_id: 'com.figma.Desktop',
          source: 'Application',
          uninstall_name: 'Figma',
          path: '/Applications/Figma.app',
          size: '1.2 GB',
        },
        {
          name: 'Raycast',
          bundle_id: 'com.raycast.macos',
          source: 'Homebrew',
          uninstall_name: 'Raycast',
          path: '/Applications/Raycast.app',
          size: '350 MB',
        },
        {
          name: 'Linear',
          bundle_id: 'com.linear',
          source: 'Application',
          uninstall_name: 'Linear',
          path: '/Applications/Linear.app',
          size: '700 MB',
        },
      ]),
    );
    localStorage.setItem('mole-uninstall-selected-apps', JSON.stringify([0]));

    const { container } = render(<UninstallPage />);

    expect(screen.getByText('1 of 3 selected')).toBeInTheDocument();
    expect(container.querySelector('[data-testid="selected-app-bubble-cluster"]')).toBeInTheDocument();
    expect(within(screen.getByTestId('selected-app-center-bubble')).getByText('1 selected')).toBeInTheDocument();
    expect(within(screen.getByTestId('selected-app-center-bubble')).getByText('1.2 GB')).toBeInTheDocument();
    expect(screen.getAllByTestId('selected-app-bubble')).toHaveLength(1);
    expect(screen.getByTestId('selected-app-orbit-stage')).toBeInTheDocument();
    expect(screen.getAllByTestId('selected-app-bubble')[0]).toHaveClass('absolute', 'left-0', 'top-0', 'aspect-square');

    fireEvent.click(screen.getByRole('button', { name: 'Select Raycast' }));
    expect(screen.getAllByTestId('selected-app-bubble')).toHaveLength(2);
    expect(screen.getByText('2 of 3 selected')).toBeInTheDocument();
    expect(within(screen.getByTestId('selected-app-center-bubble')).getByText('2 selected')).toBeInTheDocument();
    expect(within(screen.getByTestId('selected-app-center-bubble')).getByText('1.54 GB')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Select Linear' }));
    expect(screen.getAllByTestId('selected-app-bubble')).toHaveLength(3);
    expect(screen.getByText('3 of 3 selected')).toBeInTheDocument();
    expect(within(screen.getByTestId('selected-app-center-bubble')).getByText('3 selected')).toBeInTheDocument();
    expect(within(screen.getByTestId('selected-app-center-bubble')).getByText('2.23 GB')).toBeInTheDocument();

    fireEvent.click(screen.getAllByTestId('selected-app-bubble')[0]);
    expect(screen.getAllByTestId('selected-app-bubble')).toHaveLength(2);
    expect(screen.getByText('2 of 3 selected')).toBeInTheDocument();
  });

  it('background-refreshes a cached list on open, resolving "--" sizes while preserving selection', async () => {
    localStorage.setItem('mole-uninstall-stage', JSON.stringify('selection'));
    localStorage.setItem(
      'mole-uninstall-apps',
      JSON.stringify([
        {
          name: 'Figma',
          bundle_id: 'com.figma.Desktop',
          source: 'Application',
          uninstall_name: 'Figma',
          path: '/Applications/Figma.app',
          size: '--',
        },
        {
          name: 'Raycast',
          bundle_id: 'com.raycast.macos',
          source: 'Homebrew',
          uninstall_name: 'Raycast',
          path: '/Applications/Raycast.app',
          size: '--',
        },
      ]),
    );
    localStorage.setItem('mole-uninstall-selected-apps', JSON.stringify([0]));

    // Backend returns the same apps with real sizes, in a different order (the
    // backend re-sorts as metadata fills in).
    window.moleDesktop.uninstall.list = vi.fn().mockResolvedValue({
      ok: true,
      killed: false,
      stdout: JSON.stringify([
        {
          name: 'Raycast',
          bundle_id: 'com.raycast.macos',
          source: 'Homebrew',
          uninstall_name: 'Raycast',
          path: '/Applications/Raycast.app',
          size: '350 MB',
        },
        {
          name: 'Figma',
          bundle_id: 'com.figma.Desktop',
          source: 'Application',
          uninstall_name: 'Figma',
          path: '/Applications/Figma.app',
          size: '1.2 GB',
        },
      ]),
    });

    render(<UninstallPage />);

    expect(window.moleDesktop.uninstall.list).toHaveBeenCalled();

    // Size resolves in the bubble cluster, and Figma stays selected (selection
    // is remapped by path, not by the now-changed array index).
    await waitFor(() => {
      expect(within(screen.getByTestId('selected-app-center-bubble')).getByText('1.2 GB')).toBeInTheDocument();
    });
    expect(screen.getByText('1 of 2 selected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Select Raycast' })).toBeInTheDocument();
  });

  it('keeps a selection made during the size-settle window after the deferred re-list resolves', async () => {
    vi.useFakeTimers();
    try {
      localStorage.setItem('mole-uninstall-stage', JSON.stringify('selection'));
      localStorage.setItem(
        'mole-uninstall-apps',
        JSON.stringify([
          {
            name: 'Figma',
            bundle_id: 'com.figma.Desktop',
            source: 'Application',
            uninstall_name: 'Figma',
            path: '/Applications/Figma.app',
            size: '--',
          },
          {
            name: 'Raycast',
            bundle_id: 'com.raycast.macos',
            source: 'Homebrew',
            uninstall_name: 'Raycast',
            path: '/Applications/Raycast.app',
            size: '--',
          },
        ]),
      );
      localStorage.setItem('mole-uninstall-selected-apps', JSON.stringify([]));

      const appsCold = [
        { name: 'Figma', bundle_id: 'com.figma.Desktop', source: 'Application', uninstall_name: 'Figma', path: '/Applications/Figma.app', size: '--' },
        { name: 'Raycast', bundle_id: 'com.raycast.macos', source: 'Homebrew', uninstall_name: 'Raycast', path: '/Applications/Raycast.app', size: '--' },
      ];
      const appsWarm = appsCold.map(app => ({ ...app, size: app.name === 'Figma' ? '1.2 GB' : '350 MB' }));

      // First open-refresh returns still-cold sizes (arms the settle timer);
      // the deferred re-list returns warm sizes.
      window.moleDesktop.uninstall.list = vi
        .fn()
        .mockResolvedValueOnce({ ok: true, killed: false, stdout: JSON.stringify(appsCold) })
        .mockResolvedValueOnce({ ok: true, killed: false, stdout: JSON.stringify(appsWarm) });

      render(<UninstallPage />);

      // Let the on-open refresh settle into state.
      await vi.advanceTimersByTimeAsync(0);
      expect(screen.getByText('0 of 2 selected')).toBeInTheDocument();

      // User selects Raycast inside the 1.5s settle window.
      fireEvent.click(screen.getByRole('button', { name: 'Select Raycast' }));
      expect(screen.getByText('1 of 2 selected')).toBeInTheDocument();

      // Fire the settle re-list (SIZE_SETTLE_DELAY_MS is 1500ms); a selection
      // made mid-window must survive.
      await vi.advanceTimersByTimeAsync(1510);

      expect(screen.getByText('1 of 2 selected')).toBeInTheDocument();
      expect(within(screen.getByTestId('selected-app-center-bubble')).getByText('350 MB')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
