import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  const configured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
  return <main className="auth-page"><a href="/" className="brand">← Moleui</a>{configured ? <SignIn signUpUrl="/sign-up" /> : <section className="auth-message"><p className="overline">Accounts are not enabled locally</p><h1>Sign-in will be available on the configured Moleui site.</h1><p>Configure Clerk to enable verified account access.</p><a className="button button-dark" href="/">Return to Moleui</a></section>}</main>;
}
