import { useEffect, useState } from 'react';
import { Activity, CheckCircle2, Clock3, Fingerprint, History, Monitor, RotateCw, Settings, UserRound, XCircle } from 'lucide-react';
import type { BackgroundSystemStatus } from '@/types';

interface SettingsProfile {
  deviceName: string;
  user: {
    name: string;
    email: string;
  };
}

const FALLBACK_PROFILE: SettingsProfile = {
  deviceName: 'This Mac',
  user: {
    name: 'This Mac',
    email: 'This Mac',
  },
};

type SettingsPage = 'general' | 'background';

function formatRunDate(value?: string | null) {
  if (!value) return 'Never';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';

  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDuration(durationMs: number) {
  if (!Number.isFinite(durationMs) || durationMs < 0) return 'Unknown duration';
  if (durationMs < 1000) return `${Math.round(durationMs)} ms`;
  return `${(durationMs / 1000).toFixed(1)} s`;
}

export function SettingsWindow() {
  const [profile, setProfile] = useState<SettingsProfile>(FALLBACK_PROFILE);
  const [activePage, setActivePage] = useState<SettingsPage>('general');
  const [backgroundSystems, setBackgroundSystems] = useState<BackgroundSystemStatus[]>([]);
  const [backgroundRefreshKey, setBackgroundRefreshKey] = useState(0);
  const [isLoadingBackgroundSystems, setIsLoadingBackgroundSystems] = useState(false);
  const [isTouchIdEnabled, setIsTouchIdEnabled] = useState(false);
  const [isToggling, setIsToggling] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadProfile() {
      try {
        const nextProfile = await window.moleDesktop?.getSettingsProfile?.();
        if (isMounted && nextProfile) {
          setProfile(nextProfile);
        }
      } catch (error) {
        console.error('Failed to load settings profile:', error);
      }
    }

    async function loadTouchIdStatus() {
      try {
        const result = await window.moleDesktop?.touchid?.status?.();
        if (isMounted && result?.stdout?.includes('enabled')) {
          setIsTouchIdEnabled(true);
        }
      } catch (error) {
        console.error('Failed to load Touch ID status:', error);
      }
    }

    void loadProfile();
    void loadTouchIdStatus();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadBackgroundSystems() {
      setIsLoadingBackgroundSystems(true);

      try {
        const nextSystems = await window.moleDesktop?.getBackgroundSystems?.();
        if (isMounted && Array.isArray(nextSystems)) {
          setBackgroundSystems(nextSystems);
        }
      } catch (error) {
        console.error('Failed to load background systems:', error);
      } finally {
        if (isMounted) {
          setIsLoadingBackgroundSystems(false);
        }
      }
    }

    void loadBackgroundSystems();

    return () => {
      isMounted = false;
    };
  }, [backgroundRefreshKey]);

  async function handleTouchIdToggle(checked: boolean) {
    if (isToggling) return;
    setIsToggling(true);

    try {
      if (checked) {
        await window.moleDesktop?.touchid?.enable?.();
      } else {
        await window.moleDesktop?.touchid?.disable?.();
      }
      setIsTouchIdEnabled(checked);
    } catch (error) {
      console.error('Failed to toggle Touch ID:', error);
      setIsTouchIdEnabled(!checked);
    } finally {
      setIsToggling(false);
    }
  }

  return (
    <main className="min-h-screen overflow-y-auto bg-[linear-gradient(135deg,#f8f7ff_0%,#eef7ff_48%,#f7fbf7_100%)] text-slate-950">
      <div className="window-drag-region" aria-hidden="true" />
      <section className="flex min-h-screen flex-col px-7 pb-7 pt-10">
        <header className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/72 text-violet-600 shadow-[0_10px_30px_rgba(88,70,220,0.14)] ring-1 ring-white/80">
            <Settings className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-2xl font-bold leading-tight">Settings</h1>
            <p className="mt-1 text-sm text-slate-600">Device preferences</p>
          </div>
        </header>

        <nav className="mt-6 grid grid-cols-2 rounded-xl border border-white/70 bg-white/42 p-1 shadow-[0_16px_45px_rgba(79,70,229,0.08)] backdrop-blur-xl" aria-label="Settings pages">
          <button
            type="button"
            onClick={() => setActivePage('general')}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${activePage === 'general' ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            aria-current={activePage === 'general' ? 'page' : undefined}
          >
            General
          </button>
          <button
            type="button"
            onClick={() => setActivePage('background')}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${activePage === 'background' ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            aria-current={activePage === 'background' ? 'page' : undefined}
          >
            Background Systems
          </button>
        </nav>

        {activePage === 'general' ? (
        <div className="mt-6 space-y-6">
          <section aria-labelledby="account-heading">
            <h2 id="account-heading" className="text-sm font-semibold uppercase text-slate-500">
              Account
            </h2>
            <div className="mt-3 flex items-center gap-4 rounded-lg border border-white/70 bg-white/58 p-4 shadow-[0_16px_45px_rgba(79,70,229,0.10)] backdrop-blur-xl">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
                <UserRound className="h-6 w-6" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-base font-semibold">{profile.user.name}</p>
                <p className="truncate text-sm text-slate-600">{profile.user.email}</p>
              </div>
            </div>
          </section>

          <section aria-labelledby="settings-heading">
            <h2 id="settings-heading" className="text-sm font-semibold uppercase text-slate-500">
              Settings
            </h2>
            <div className="mt-3 overflow-hidden rounded-lg border border-white/70 bg-white/58 shadow-[0_16px_45px_rgba(79,70,229,0.10)] backdrop-blur-xl">
              <div className="flex items-center justify-between gap-4 p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-100 text-sky-700">
                    <Fingerprint className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-base font-semibold">Touch ID</p>
                    <p className="text-sm text-slate-600">Use biometric confirmation for protected actions.</p>
                  </div>
                </div>
                <label className="relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center">
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={isTouchIdEnabled}
                    onChange={(event) => void handleTouchIdToggle(event.target.checked)}
                    aria-label="Enable Touch ID"
                  />
                  <span className="h-7 w-12 rounded-full bg-slate-300 transition-colors peer-checked:bg-violet-600" />
                  <span className="absolute left-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5" />
                </label>
              </div>
            </div>
          </section>

          <div className="flex items-center gap-3 rounded-lg border border-white/70 bg-white/42 p-4 text-sm text-slate-600 backdrop-blur-xl">
            <Monitor className="h-5 w-5 shrink-0 text-emerald-700" aria-hidden="true" />
            <p>Device account details are placeholders until sign-in is available.</p>
          </div>
        </div>
        ) : (
        <div className="mt-6 space-y-5">
          <section aria-labelledby="background-heading" className="rounded-lg border border-white/70 bg-white/58 p-4 shadow-[0_16px_45px_rgba(79,70,229,0.10)] backdrop-blur-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="background-heading" className="text-base font-semibold">Background Systems</h2>
                <p className="mt-1 text-sm text-slate-600">Monitor Moleui systems that run without a visible window.</p>
              </div>
              <button
                type="button"
                onClick={() => setBackgroundRefreshKey((key) => key + 1)}
                className="inline-flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-700 transition hover:bg-violet-100"
              >
                <RotateCw className={`h-4 w-4 ${isLoadingBackgroundSystems ? 'animate-spin' : ''}`} aria-hidden="true" />
                Refresh
              </button>
            </div>
          </section>

          {backgroundSystems.length === 0 ? (
            <div className="rounded-lg border border-white/70 bg-white/50 p-4 text-sm text-slate-600 backdrop-blur-xl">
              {isLoadingBackgroundSystems ? 'Loading background systems...' : 'No background systems reported.'}
            </div>
          ) : (
            <div className="space-y-4">
              {backgroundSystems.map((system) => (
                <section key={system.id} className="overflow-hidden rounded-lg border border-white/70 bg-white/62 shadow-[0_16px_45px_rgba(79,70,229,0.10)] backdrop-blur-xl" aria-label={system.name}>
                  <div className="flex items-start justify-between gap-4 p-4">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
                        <Activity className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-base font-semibold">{system.name}</h3>
                        <p className="mt-1 text-sm text-slate-600">{system.description}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${system.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                        {system.enabled ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> : <XCircle className="h-3.5 w-3.5" aria-hidden="true" />}
                        {system.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${system.active ? 'bg-sky-100 text-sky-700' : 'bg-white/80 text-slate-600'}`}>
                        <span className={`h-2 w-2 rounded-full ${system.active ? 'bg-sky-500' : 'bg-slate-300'}`} />
                        {system.active ? 'Active' : 'Idle'}
                      </span>
                    </div>
                  </div>

                  <div className="grid gap-3 border-t border-white/70 bg-white/38 p-4 sm:grid-cols-2">
                    <div className="rounded-lg bg-white/58 p-3">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-500">
                        <Clock3 className="h-4 w-4" aria-hidden="true" />
                        Last run
                      </div>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{formatRunDate(system.lastRun?.finishedAt)}</p>
                      {system.lastRun && (
                        <p className={`mt-1 text-xs ${system.lastRun.ok ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {system.lastRun.ok ? 'Succeeded' : 'Failed'} in {formatDuration(system.lastRun.durationMs)}
                        </p>
                      )}
                    </div>

                    <div className="rounded-lg bg-white/58 p-3">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-500">
                        <History className="h-4 w-4" aria-hidden="true" />
                        Schedule
                      </div>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{system.schedule}</p>
                      <p className="mt-1 text-xs text-slate-500">Last 3 runs are kept on this Mac.</p>
                    </div>
                  </div>

                  <div className="border-t border-white/70 p-4">
                    <h4 className="text-xs font-semibold uppercase text-slate-500">Last 3 runs</h4>
                    {system.recentRuns.length > 0 ? (
                      <ol className="mt-3 space-y-2">
                        {system.recentRuns.map((run) => (
                          <li key={`${system.id}-${run.finishedAt}`} className="flex items-start justify-between gap-3 rounded-lg bg-white/48 p-3 text-sm">
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-900">{formatRunDate(run.finishedAt)}</p>
                              <p className="mt-0.5 truncate text-xs text-slate-500">{run.message}</p>
                            </div>
                            <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${run.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                              {run.ok ? 'Success' : 'Failed'}
                            </span>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="mt-3 rounded-lg bg-white/48 p-3 text-sm text-slate-600">No runs recorded yet.</p>
                    )}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
        )}
      </section>
    </main>
  );
}
