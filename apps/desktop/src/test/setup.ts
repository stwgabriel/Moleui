import '@testing-library/jest-dom';
import { beforeEach, vi } from 'vitest';

// The desktop test command may be launched with an invalid Node
// `--localstorage-file`, which leaves jsdom's storage object without methods.
// Keep browser persistence deterministic for auth, settings and page-state tests.
const localStorageStore = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => localStorageStore.get(key) ?? null,
  setItem: (key: string, value: string) => localStorageStore.set(key, value),
  removeItem: (key: string) => localStorageStore.delete(key),
  clear: () => localStorageStore.clear(),
  key: (index: number) => [...localStorageStore.keys()][index] ?? null,
  get length() {
    return localStorageStore.size;
  },
};

Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: localStorageMock });

beforeEach(() => {
  localStorageStore.clear();
});

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
