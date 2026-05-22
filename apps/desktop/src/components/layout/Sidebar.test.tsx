import { fireEvent, render, screen } from '@testing-library/react';
import { Sidebar } from './Sidebar';

describe('Sidebar', () => {
  beforeEach(() => {
    window.moleDesktop = {
      openSettingsWindow: vi.fn().mockResolvedValue({ ok: true }),
    } as unknown as typeof window.moleDesktop;
  });

  it('opens settings in a desktop window when Settings is clicked', () => {
    render(<Sidebar currentPage="mymac" onPageChange={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /settings/i }));

    expect(window.moleDesktop.openSettingsWindow).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog', { name: /settings/i })).not.toBeInTheDocument();
  });
});
