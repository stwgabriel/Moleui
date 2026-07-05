import { StrictMode } from 'react';
import { ClerkProvider, useAuth } from '@clerk/clerk-react';
import { ConvexReactClient } from 'convex/react';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { MissingClientConfig } from '@/components/auth/MissingClientConfig';
import {
  clerkAllowedRedirectOrigins,
  clerkAllowedRedirectProtocols,
  clerkPublishableKey,
  convexUrl,
  hasClientConfig,
} from '@/lib/clientConfig';

const convex = hasClientConfig() ? new ConvexReactClient(convexUrl!) : null;

function Root() {
  if (!clerkPublishableKey || !convex) {
    return <MissingClientConfig />;
  }

  return (
    <ClerkProvider
      publishableKey={clerkPublishableKey}
      allowedRedirectOrigins={clerkAllowedRedirectOrigins}
      allowedRedirectProtocols={clerkAllowedRedirectProtocols}
      // Clerk persists its session in cookies on the renderer's origin and shares
      // it across the separate login and main BrowserWindows (same
      // session.defaultSession). For that to work the renderer must be served
      // from a cookieable origin: http://localhost in both dev and the packaged
      // app (see the loopback server in main.mjs). file:// and custom app://
      // schemes are non-cookieable in Electron, so cookie writes were silently
      // dropped and the main window booted signed-out, bouncing the user back to
      // the login screen. standardBrowser is left at its default (true).
    >
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <App />
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <Root />
    </ErrorBoundary>
  </StrictMode>
);
