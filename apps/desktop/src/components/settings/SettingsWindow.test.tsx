import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SettingsWindow } from './SettingsWindow';

describe('SettingsWindow', () => {
  beforeEach(() => {
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
    render(<SettingsWindow />);

    expect(await screen.findByRole('heading', { level: 1, name: /settings/i })).toBeInTheDocument();
    expect(screen.getAllByText('Gabriel-MacBook-Pro')).toHaveLength(2);
    expect(screen.getByText('Touch ID')).toBeInTheDocument();

    await waitFor(() => {
      expect(window.moleDesktop.getSettingsProfile).toHaveBeenCalledTimes(1);
    });
  });

  it('shows background systems with status and recent runs', async () => {
    render(<SettingsWindow />);

    fireEvent.click(screen.getByRole('button', { name: /background systems/i }));

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
});
