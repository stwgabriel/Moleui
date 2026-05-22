import { render, screen, waitFor } from '@testing-library/react';
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
});
