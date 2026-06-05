import { StrictMode } from 'react';
import { ClerkProvider, useAuth } from '@clerk/clerk-react';
import { ConvexReactClient } from 'convex/react';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { MissingClientConfig } from '@/components/auth/MissingClientConfig';
import { clerkPublishableKey, convexUrl, hasClientConfig } from '@/lib/clientConfig';

const convex = hasClientConfig() ? new ConvexReactClient(convexUrl!) : null;

function Root() {
  if (!clerkPublishableKey || !convex) {
    return <MissingClientConfig />;
  }

  return (
    <ClerkProvider publishableKey={clerkPublishableKey}>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <App />
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
