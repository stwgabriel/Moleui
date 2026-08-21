import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  const configured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
  return <main className="auth-page"><a href="/" className="brand">← Moleui</a>{configured ? <SignUp signInUrl="/sign-in" /> : <section className="auth-message"><p className="overline">Accounts are not enabled locally</p><h1>Sign-up will be available on the configured Moleui site.</h1><p>Set <code>NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code> to enable Clerk’s verified, scalable sign-up flow.</p><a className="button button-dark" href="/">Return to Moleui</a></section>}</main>;
}
