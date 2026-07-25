import { useEffect, useState } from 'react';
import type { ThemePreference } from '@/types';

// Theme preference lives in localStorage so the first paint of every window can
// resolve it synchronously (no flash), and changes propagate to the other
// BrowserWindows (settings <-> main) through the shared-origin `storage` event.
// Electron's nativeTheme is kept in sync over IPC so window vibrancy and the
// `prefers-color-scheme` media query (which drives the "system" preference)
// follow along.
const THEME_STORAGE_KEY = 'mole-theme';

const THEME_PREFERENCES: readonly ThemePreference[] = ['system', 'light', 'dark'];

function isThemePreference(value: unknown): value is ThemePreference {
  return THEME_PREFERENCES.includes(value as ThemePreference);
}

function getStoredTheme(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(stored) ? stored : 'system';
  } catch (error) {
    console.error('Failed to read theme preference from localStorage:', error);
    return 'system';
  }
}

function systemPrefersDark(): boolean {
  return typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : false;
}

function applyTheme(preference: ThemePreference) {
  const isDark = preference === 'dark' || (preference === 'system' && systemPrefersDark());
  document.documentElement.classList.toggle('dark', isDark);
}

let currentTheme: ThemePreference = 'system';
const listeners = new Set<(theme: ThemePreference) => void>();

function notify(theme: ThemePreference) {
  currentTheme = theme;
  applyTheme(theme);
  listeners.forEach((listener) => listener(theme));
}

export function setThemePreference(theme: ThemePreference) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch (error) {
    console.error('Failed to persist theme preference:', error);
  }
  void window.moleDesktop?.theme?.set?.(theme);
  notify(theme);
}

/** Resolve and apply the stored theme before first render, and keep it applied
 *  as the OS scheme or another window's preference changes. Call once per window. */
export function initTheme() {
  currentTheme = getStoredTheme();
  applyTheme(currentTheme);
  // Re-align nativeTheme (vibrancy, prefers-color-scheme) with this window's
  // stored preference; idempotent when several windows boot.
  void window.moleDesktop?.theme?.set?.(currentTheme);

  if (typeof window.matchMedia === 'function') {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (currentTheme === 'system') applyTheme('system');
    });
  }

  window.addEventListener('storage', (event) => {
    if (event.key !== THEME_STORAGE_KEY) return;
    notify(isThemePreference(event.newValue) ? event.newValue : 'system');
  });
}

export function useTheme() {
  const [theme, setTheme] = useState<ThemePreference>(currentTheme);

  useEffect(() => {
    listeners.add(setTheme);
    return () => {
      listeners.delete(setTheme);
    };
  }, []);

  return { theme, setTheme: setThemePreference } as const;
}

/** The theme actually in effect ('system' resolved against the OS scheme).
 *  For JS-driven colors that can't use `dark:` classes (e.g. Clerk appearance). */
export function useResolvedTheme(): 'light' | 'dark' {
  const { theme } = useTheme();
  const [systemDark, setSystemDark] = useState(systemPrefersDark);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setSystemDark(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  return theme === 'dark' || (theme === 'system' && systemDark) ? 'dark' : 'light';
}
