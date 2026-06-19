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
    expect(screen.getByText('Enabled')).toBeInTheDocument();
    expect(screen.getByText('Idle')).toBeInTheDocument();
    expect(screen.getByText('Every 6 minutes')).toBeInTheDocument();
    expect(screen.getByText('Updated battery metrics cache')).toBeInTheDocument();

    await waitFor(() => {
      expect(window.moleDesktop.getBackgroundSystems).toHaveBeenCalledTimes(1);
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

    fireEvent.click(screen.getByRole('button', { name: /subscribe in app/i }));

    expect(startCheckout).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('button', { name: /opening checkout/i })).toBeDisabled();

    resolveCheckout();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /subscribe in app/i })).not.toBeDisabled();
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
    expect(await screen.findByRole('button', { name: /opening billing/i })).toBeDisabled();

    resolvePortal();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /manage billing/i })).not.toBeDisabled();
    });
  });
});
