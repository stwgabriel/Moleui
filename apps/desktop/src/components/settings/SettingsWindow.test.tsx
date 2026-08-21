import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { SettingsWindow } from './SettingsWindow';

const mocks = vi.hoisted(() => ({
  useSubscription: vi.fn(),
}));

vi.mock('@/hooks/useSubscription', () => ({
  useSubscription: mocks.useSubscription,
}));

function subscriptionFixture(overrides: Partial<ReturnType<typeof mocks.useSubscription>> = {}) {
  return {
    isSubscribed: true,
    isDeveloperUnlocked: false,
    isSignedIn: true,
    isLoading: false,
    status: 'active',
    country: 'US',
    startCheckout: vi.fn().mockResolvedValue(undefined),
    openBillingPortal: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('SettingsWindow', () => {
  beforeEach(() => {
    mocks.useSubscription.mockReturnValue(subscriptionFixture());
    window.moleDesktop = {
      getSettingsProfile: vi.fn().mockResolvedValue({
        deviceName: 'Gabriel-MacBook-Pro',
        user: {
          name: 'Gabriel-MacBook-Pro',
          email: 'Gabriel-MacBook-Pro',
        },
      }),
      getBackgroundSystems: vi.fn().mockResolvedValue([
        {
          id: 'battery-sampler',
          name: 'Battery metrics sampler',
          description: 'Refreshes cached system and battery metrics while Moleui is open.',
          enabled: true,
          active: false,
          schedule: 'Every 6 minutes',
          lastRun: {
            startedAt: '2026-05-26T10:00:00.000Z',
            finishedAt: '2026-05-26T10:00:01.000Z',
            ok: true,
            durationMs: 1000,
            message: 'Updated battery metrics cache',
          },
          recentRuns: [
            {
              startedAt: '2026-05-26T10:00:00.000Z',
              finishedAt: '2026-05-26T10:00:01.000Z',
              ok: true,
              durationMs: 1000,
              message: 'Updated battery metrics cache',
            },
          ],
        },
      ]),
      touchid: {
        status: vi.fn().mockResolvedValue({ stdout: 'Touch ID is not configured' }),
        enable: vi.fn(),
        disable: vi.fn(),
      },
      theme: {
        get: vi.fn().mockResolvedValue({ theme: 'system' }),
        set: vi.fn().mockResolvedValue({ ok: true, theme: 'system' }),
      },
      appIcon: {
        list: vi.fn().mockResolvedValue({
          icons: [
            { id: 'classic', label: 'Classic Purple', preview: 'assets/base/molui-purple.png' },
            { id: 'midnight', label: 'Midnight', preview: 'assets/base/molui-midnight.png' },
          ],
        }),
        get: vi.fn().mockResolvedValue({ icon: 'classic' }),
        set: vi.fn().mockResolvedValue({ ok: true, icon: 'midnight', appliesOnQuit: true }),
      },
      updates: {
        getState: vi.fn().mockResolvedValue({
          status: 'idle',
          currentVersion: '0.12.0',
          availableVersion: null,
          progress: null,
          message: 'Moleui checks for updates automatically.',
          lastCheckedAt: null,
        }),
        check: vi.fn().mockResolvedValue({
          status: 'up-to-date',
          currentVersion: '0.12.0',
          availableVersion: null,
          progress: null,
          message: 'Moleui is up to date.',
          lastCheckedAt: '2026-08-02T12:00:00.000Z',
        }),
        install: vi.fn().mockResolvedValue({ ok: true }),
        onState: vi.fn(),
        removeListeners: vi.fn(),
      },
    } as unknown as typeof window.moleDesktop;
  });

  it('shows the placeholder device account and Touch ID setting', async () => {
    const { container } = render(<SettingsWindow />);

    expect(await screen.findByRole('heading', { level: 1, name: /settings/i })).toBeInTheDocument();
    const accountPanel = screen.getByRole('region', { name: /account/i });
    expect(within(accountPanel).getAllByText('Gabriel-MacBook-Pro')).toHaveLength(2);
    expect(screen.getByText('Touch ID')).toBeInTheDocument();
    expect(container.querySelector('[data-testid="settings-window"]')).toHaveClass('h-screen', 'overflow-hidden');
    expect(container.querySelector('[data-testid="settings-content"]')).toHaveClass('overflow-y-auto', 'custom-scrollbar');
    expect(screen.getByRole('navigation', { name: /settings categories/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(window.moleDesktop.getSettingsProfile).toHaveBeenCalledTimes(1);
    });
  });

  it('shows background systems with status and recent runs', async () => {
    render(<SettingsWindow />);

    fireEvent.click(screen.getByRole('button', { name: /^background$/i }));

    expect(await screen.findByRole('heading', { level: 2, name: /background systems/i })).toBeInTheDocument();
    expect(screen.getByText('Battery metrics sampler')).toBeInTheDocument();
    expect(screen.getByText('On')).toBeInTheDocument();
    expect(screen.getByText('Idle')).toBeInTheDocument();
    expect(screen.getByText('Every 6 minutes')).toBeInTheDocument();
    expect(screen.getByText(/Succeeded in/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(window.moleDesktop.getBackgroundSystems).toHaveBeenCalledTimes(1);
    });
  });

  it('switches the theme from the appearance section and persists the choice', () => {
    render(<SettingsWindow />);

    const group = screen.getByRole('radiogroup', { name: /theme/i });
    const dark = within(group).getByRole('radio', { name: /dark/i });
    const light = within(group).getByRole('radio', { name: /light/i });
    const system = within(group).getByRole('radio', { name: /system/i });

    fireEvent.click(dark);
    expect(dark).toHaveAttribute('aria-checked', 'true');
    expect(document.documentElement).toHaveClass('dark');
    expect(localStorage.getItem('mole-theme')).toBe('dark');
    expect(window.moleDesktop.theme?.set).toHaveBeenCalledWith('dark');

    fireEvent.click(light);
    expect(light).toHaveAttribute('aria-checked', 'true');
    expect(document.documentElement).not.toHaveClass('dark');
    expect(localStorage.getItem('mole-theme')).toBe('light');

    // jsdom has no matchMedia, so "system" resolves to light here; the point is
    // the preference itself round-trips and the dark class clears.
    fireEvent.click(system);
    expect(system).toHaveAttribute('aria-checked', 'true');
    expect(document.documentElement).not.toHaveClass('dark');
    expect(localStorage.getItem('mole-theme')).toBe('system');
  });

  it('switches the app icon and surfaces the applies-on-quit notice', async () => {
    render(<SettingsWindow />);

    const group = await screen.findByRole('radiogroup', { name: /app icon/i });
    expect(within(group).getByRole('radio', { name: /classic purple/i })).toHaveAttribute('aria-checked', 'true');

    const midnight = within(group).getByRole('radio', { name: /midnight/i });
    fireEvent.click(midnight);

    await waitFor(() => {
      expect(window.moleDesktop.appIcon?.set).toHaveBeenCalledWith('midnight');
    });
    expect(midnight).toHaveAttribute('aria-checked', 'true');
    expect(await screen.findByText(/after you quit/i)).toBeInTheDocument();
  });

  it('checks for application updates from General settings', async () => {
    render(<SettingsWindow />);

    expect(await screen.findByText('Moleui 0.12.0')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /check for updates/i }));

    await waitFor(() => {
      expect(window.moleDesktop.updates?.check).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByText('Moleui is up to date.')).toBeInTheDocument();
  });

  it('restarts to install a downloaded update', async () => {
    vi.mocked(window.moleDesktop.updates!.getState).mockResolvedValue({
      status: 'downloaded',
      currentVersion: '0.12.0',
      availableVersion: '0.13.0',
      progress: 100,
      message: 'Moleui 0.13.0 is ready. Restart to finish updating.',
      lastCheckedAt: '2026-08-02T12:00:00.000Z',
    });

    render(<SettingsWindow />);
    fireEvent.click(await screen.findByRole('button', { name: /restart to update/i }));

    await waitFor(() => {
      expect(window.moleDesktop.updates?.install).toHaveBeenCalledTimes(1);
    });
  });

  it('opens checkout from the subscription panel inside the app window', async () => {
    let resolveCheckout!: () => void;
    const startCheckout = vi.fn(() => new Promise<void>((resolve) => {
      resolveCheckout = resolve;
    }));
    mocks.useSubscription.mockReturnValue(subscriptionFixture({
      isSubscribed: false,
      status: 'none',
      startCheckout,
    }));

    render(<SettingsWindow />);

    fireEvent.click(screen.getByRole('button', { name: /subscribe/i }));

    expect(startCheckout).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('button', { name: /opening/i })).toBeDisabled();

    resolveCheckout();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /subscribe/i })).not.toBeDisabled();
    });
  });

  it('opens the billing portal from the subscription panel', async () => {
    let resolvePortal!: () => void;
    const openBillingPortal = vi.fn(() => new Promise<void>((resolve) => {
      resolvePortal = resolve;
    }));
    mocks.useSubscription.mockReturnValue(subscriptionFixture({
      openBillingPortal,
    }));

    render(<SettingsWindow />);

    fireEvent.click(screen.getByRole('button', { name: /manage billing/i }));

    expect(openBillingPortal).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('button', { name: /opening/i })).toBeDisabled();

    resolvePortal();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /manage billing/i })).not.toBeDisabled();
    });
  });
});
