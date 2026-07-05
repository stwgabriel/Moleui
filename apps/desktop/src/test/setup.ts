import '@testing-library/jest-dom';
import { vi } from 'vitest';

// jsdom has no Clerk context, so any component that reads auth state would throw
// "useUser can only be used within the <ClerkProvider />". Stub the hooks and
// components the app imports so trees like Sidebar -> UserAvatar and the
// SettingsWindow render without a real provider. Returning `user: null` keeps
// the app's own fallbacks in play (e.g. SettingsWindow showing the device-name
// profile instead of a Clerk display name), which is what the tests assert on.
vi.mock('@clerk/clerk-react', () => ({
  ClerkProvider: (props: { children?: unknown }) => props.children,
  SignIn: () => null,
  useUser: () => ({ isLoaded: true, isSignedIn: true, user: null }),
  useClerk: () => ({ signOut: vi.fn() }),
  useAuth: () => ({ isLoaded: true, isSignedIn: true, userId: null, getToken: vi.fn() }),
}));
