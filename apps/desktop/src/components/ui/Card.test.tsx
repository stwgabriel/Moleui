import { render, screen } from '@testing-library/react';
import { Card, CardHeader, CardTitle } from './Card';

describe('Card', () => {
  it('renders children correctly', () => {
    render(<Card>Card content</Card>);
    expect(screen.getByText('Card content')).toBeInTheDocument();
  });

  it('applies variant classes correctly', () => {
    render(<Card variant="elevated">Elevated</Card>);
    const card = screen.getByText('Elevated');
    expect(card).toHaveClass('glass-elevated');
  });

  it('renders CardHeader with correct classes', () => {
    render(
      <Card>
        <CardHeader>Header</CardHeader>
      </Card>
    );
    const header = screen.getByText('Header');
    expect(header).toBeInTheDocument();
  });

  it('renders CardTitle with correct classes', () => {
    render(
      <Card>
        <CardTitle>Title</CardTitle>
      </Card>
    );
    const title = screen.getByText('Title');
    expect(title).toHaveClass('text-xl');
  });
});
