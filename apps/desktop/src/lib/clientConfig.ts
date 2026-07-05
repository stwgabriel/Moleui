// Fallback config so a packaged build always has working endpoints even when the
// build host had no .env (CI, a clean checkout). Both values are public by
// design: the pk_test_ publishable key and the Convex URL are already embedded in
// the shipped client bundle, so there is no secret to leak here. Real secrets
// (Clerk secret key, Stripe keys, webhook secrets) live only in Convex env vars.
// An explicit VITE_* env var always wins over these defaults.
const DEFAULT_CLERK_PUBLISHABLE_KEY = 'pk_test_bWFnaWNhbC1hbGJhY29yZS01MS5jbGVyay5hY2NvdW50cy5kZXYk';
const DEFAULT_CONVEX_URL = 'https://effervescent-sturgeon-55.eu-west-1.convex.cloud';

export const clerkPublishableKey =
  (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined) || DEFAULT_CLERK_PUBLISHABLE_KEY;
export const convexUrl =
  (import.meta.env.VITE_CONVEX_URL as string | undefined) || DEFAULT_CONVEX_URL;

// Packaged Electron serves the renderer from a loopback origin on a dynamic port
// (http://localhost:<port>), and dev from the Vite server. Always allow the
// renderer's own current origin so Clerk's post-sign-in redirect is accepted
// whatever port the loopback server landed on, plus the known dev origin.
export const clerkAllowedRedirectOrigins = [
  ...(typeof window !== 'undefined' && window.location?.origin ? [window.location.origin] : []),
  'http://localhost:30736',
];
export const clerkAllowedRedirectProtocols = ['http:', 'https:'];

export function isElectronDesktop() {
  return typeof window !== 'undefined' && Boolean(window.moleDesktop);
}

export function hasClientConfig() {
  return Boolean(clerkPublishableKey && convexUrl);
}
