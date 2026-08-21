import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LoginWindow } from './LoginWindow';

const clerk = vi.hoisted(() => ({
  SignIn: vi.fn((props: { withSignUp?: boolean; signUpUrl?: string }) => (
    props.withSignUp ? <a href={props.signUpUrl}>Sign up</a> : null
  )),
  SignUp: vi.fn(() => <div>Sign-up form</div>),
}));

vi.mock('@clerk/clerk-react', () => ({ SignIn: clerk.SignIn, SignUp: clerk.SignUp }));

describe('LoginWindow', () => {
  it('exposes Clerk sign-up from the sign-in surface and returns to the app after sign-up', async () => {
    render(<LoginWindow />);

    expect(screen.getByRole('link', { name: /sign up/i })).toHaveAttribute('href', '#/sign-up');
    expect(clerk.SignIn).toHaveBeenCalledWith(
      expect.objectContaining({
        withSignUp: true,
        routing: 'virtual',
        signUpUrl: '#/sign-up',
        signUpFallbackRedirectUrl: '#/',
      }),
      expect.anything()
    );

    fireEvent.click(screen.getByRole('link', { name: /create an account/i }));
    await waitFor(() => expect(screen.getByText('Create your Moleui account')).toBeInTheDocument());
    expect(screen.getByText('Sign-up form')).toBeInTheDocument();
    expect(clerk.SignUp).toHaveBeenCalledWith(expect.objectContaining({ routing: 'virtual', signInUrl: '#/' }), expect.anything());
    expect(screen.getByRole('link', { name: /sign in instead/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('link', { name: /sign in instead/i }));
    await waitFor(() => expect(screen.getByText('Sign in to Moleui')).toBeInTheDocument());
  });
});
