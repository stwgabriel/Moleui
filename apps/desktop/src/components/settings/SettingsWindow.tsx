import { useEffect, useState } from 'react';
import { Activity, CheckCircle2, Clock3, CreditCard, Crown, Fingerprint, History, LogOut, Monitor, RotateCw, Settings, XCircle, type LucideIcon } from 'lucide-react';
import type { BackgroundSystemStatus } from '@/types';
import { UserAvatar } from '@/components/account/UserAvatar';
import { useSubscription } from '@/hooks/useSubscription';
import { cn } from '@/utils/cn';

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

const PANEL_CLASS = 'rounded-lg border border-white/70 bg-white/62 shadow-[0_16px_45px_rgba(79,70,229,0.08)] backdrop-blur-xl';
const SECTION_LABEL_CLASS = 'text-xs font-semibold uppercase text-slate-500';

const SETTINGS_PAGES: Array<{
  id: SettingsPage;
  label: string;
  icon: LucideIcon;
}> = [
  { id: 'general', label: 'General', icon: Settings },
  { id: 'background', label: 'Background', icon: Activity },
];

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
  const subscription = useSubscription();
  const clerkUser = (window as any).Clerk?.user;
  const [profile, setProfile] = useState<SettingsProfile>(FALLBACK_PROFILE);
  const [activePage, setActivePage] = useState<SettingsPage>('general');
  const [backgroundSystems, setBackgroundSystems] = useState<BackgroundSystemStatus[]>([]);
  const [backgroundRefreshKey, setBackgroundRefreshKey] = useState(0);
  const [isLoadingBackgroundSystems, setIsLoadingBackgroundSystems] = useState(false);
  const [isTouchIdEnabled, setIsTouchIdEnabled] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [isBillingBusy, setIsBillingBusy] = useState(false);
  const [billingError, setBillingError] = useState<string | null>(null);
  const displayName = clerkUser?.fullName || profile.user.name;
  const displayEmail = clerkUser?.primaryEmailAddress?.emailAddress || profile.user.email;

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

  async function handleSubscribeClick() {
    setIsBillingBusy(true);
    setBillingError(null);
    try {
      await subscription.startCheckout();
    } catch (error) {
      setBillingError(error instanceof Error ? error.message : 'Failed to open checkout');
    } finally {
      setIsBillingBusy(false);
    }
  }

  async function handleBillingPortalClick() {
    setIsBillingBusy(true);
    setBillingError(null);
    try {
      await subscription.openBillingPortal();
    } catch (error) {
      setBillingError(error instanceof Error ? error.message : 'Failed to open billing portal');
    } finally {
      setIsBillingBusy(false);
    }
  }

  async function handleSignOut() {
    await (window as any).Clerk?.signOut?.();
    await window.moleDesktop.auth?.signOut();
  }

  return (
    <main data-testid="settings-window" className="h-screen min-h-0 overflow-hidden bg-[#fbf9ff] text-slate-950">
      <div className="window-drag-region" aria-hidden="true" />
      <section className="grid h-full min-h-0 grid-cols-[9.25rem_minmax(0,1fr)] gap-4 px-5 pb-5 pt-9">
        <aside className="flex min-h-0 flex-col">
          <header className="px-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/72 text-violet-600 shadow-[0_10px_30px_rgba(88,70,220,0.14)] ring-1 ring-white/80">
              <Settings className="h-5 w-5" aria-hidden="true" />
            </div>
            <h1 className="mt-4 text-xl font-bold leading-tight">Settings</h1>
            <p className="mt-1 truncate text-xs font-medium text-slate-500">{profile.deviceName}</p>
          </header>

          <nav className="mt-6 space-y-1" aria-label="Settings categories">
            {SETTINGS_PAGES.map((page) => {
              const Icon = page.icon;
              const isActive = activePage === page.id;

              return (
                <button
                  key={page.id}
                  type="button"
                  onClick={() => setActivePage(page.id)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-semibold transition',
                    isActive
                      ? 'bg-white text-violet-700 shadow-[0_10px_28px_rgba(88,70,220,0.12)] ring-1 ring-white/80'
                      : 'text-slate-500 hover:bg-white/44 hover:text-slate-800'
                  )}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{page.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        <div data-testid="settings-content" className="min-h-0 overflow-y-auto pr-1 custom-scrollbar">
          <div className="mx-auto max-w-[620px] space-y-4 pb-2">
            {activePage === 'general' ? (
              <>
                <section aria-labelledby="account-heading" className={PANEL_CLASS}>
                  <div className="border-b border-white/70 px-4 py-3">
                    <h2 id="account-heading" className={SECTION_LABEL_CLASS}>
                      Account
                    </h2>
                  </div>
                  <div className="flex min-w-0 items-center gap-3 p-4">
                    <UserAvatar className="h-12 w-12 shrink-0" />
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold">{displayName}</p>
                      <p className="truncate text-sm text-slate-600">{displayEmail}</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="ml-auto inline-flex items-center gap-2 rounded-full border border-rose-100 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-100"
                    >
                      <LogOut className="h-4 w-4" aria-hidden="true" />
                      Sign out
                    </button>
                  </div>
                </section>

                <section aria-labelledby="subscription-heading" className={PANEL_CLASS}>
                  <div className="border-b border-white/70 px-4 py-3">
                    <h2 id="subscription-heading" className={SECTION_LABEL_CLASS}>
                      Subscription
                    </h2>
                  </div>
                  <div className="space-y-4 p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
                        <Crown className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-base font-semibold">Moleui Pro</p>
                        <p className="mt-1 text-sm leading-5 text-slate-600">
                          {subscription.isSubscribed
                            ? 'Active subscription. Paid tools are unlocked on this account.'
                            : 'My Mac is free. Cleanup, Optimize, Uninstall, and Storage runs require Pro.'}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className={cn('inline-flex rounded-full px-2.5 py-1 text-xs font-semibold', subscription.isSubscribed ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600')}>
                            {subscription.isSubscribed ? 'Subscribed' : 'Not subscribed'}
                          </span>
                          <span className="inline-flex rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700">
                            {subscription.country === 'BR' ? 'R$15/month' : '$5/month'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {subscription.isSubscribed ? (
                        <button
                          type="button"
                          onClick={handleBillingPortalClick}
                          disabled={isBillingBusy}
                          className="inline-flex items-center gap-2 rounded-full bg-violet-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-violet-700 disabled:opacity-60"
                        >
                          <CreditCard className="h-4 w-4" aria-hidden="true" />
                          Manage billing
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleSubscribeClick}
                          disabled={isBillingBusy}
                          className="inline-flex items-center gap-2 rounded-full bg-violet-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-violet-700 disabled:opacity-60"
                        >
                          <CreditCard className="h-4 w-4" aria-hidden="true" />
                          Subscribe in app
                        </button>
                      )}
                    </div>
                    {billingError && (
                      <p className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
                        {billingError}
                      </p>
                    )}
                  </div>
                </section>

                <section aria-labelledby="security-heading" className={PANEL_CLASS}>
                  <div className="border-b border-white/70 px-4 py-3">
                    <h2 id="security-heading" className={SECTION_LABEL_CLASS}>
                      Security
                    </h2>
                  </div>
                  <div className="flex items-center justify-between gap-4 p-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-700">
                        <Fingerprint className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-base font-semibold">Touch ID</p>
                        <p className="text-sm text-slate-600">Protected actions</p>
                      </div>
                    </div>
                    <label className={cn('relative inline-flex h-7 w-12 shrink-0 items-center', isToggling ? 'cursor-wait opacity-70' : 'cursor-pointer')}>
                      <input
                        type="checkbox"
                        className="peer sr-only"
                        checked={isTouchIdEnabled}
                        disabled={isToggling}
                        onChange={(event) => void handleTouchIdToggle(event.target.checked)}
                        aria-label="Enable Touch ID"
                      />
                      <span className="h-7 w-12 rounded-full bg-slate-300 transition-colors peer-checked:bg-violet-600" />
                      <span className="absolute left-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5" />
                    </label>
                  </div>
                </section>

                <section aria-labelledby="device-heading" className={PANEL_CLASS}>
                  <div className="border-b border-white/70 px-4 py-3">
                    <h2 id="device-heading" className={SECTION_LABEL_CLASS}>
                      Device
                    </h2>
                  </div>
                  <div className="flex items-center gap-3 p-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                      <Monitor className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold">{profile.deviceName}</p>
                      <p className="text-sm text-slate-600">This Mac</p>
                    </div>
                  </div>
                </section>
              </>
            ) : (
              <>
                <section aria-labelledby="background-heading" className={PANEL_CLASS}>
                  <div className="flex items-center justify-between gap-3 border-b border-white/70 px-4 py-3">
                    <h2 id="background-heading" className={SECTION_LABEL_CLASS}>
                      Background Systems
                    </h2>
                    <button
                      type="button"
                      onClick={() => setBackgroundRefreshKey((key) => key + 1)}
                      className="inline-flex h-8 items-center gap-2 rounded-md border border-violet-200 bg-white/72 px-2.5 text-sm font-semibold text-violet-700 transition hover:bg-violet-50"
                    >
                      <RotateCw className={`h-4 w-4 ${isLoadingBackgroundSystems ? 'animate-spin' : ''}`} aria-hidden="true" />
                      Refresh
                    </button>
                  </div>
                  {backgroundSystems.length === 0 ? (
                    <div className="p-4 text-sm text-slate-600">
                      {isLoadingBackgroundSystems ? 'Loading background systems...' : 'No background systems reported.'}
                    </div>
                  ) : (
                    <div className="divide-y divide-white/70">
                      {backgroundSystems.map((system) => (
                        <section key={system.id} className="p-4" aria-label={system.name}>
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex min-w-0 items-start gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
                                <Activity className="h-5 w-5" aria-hidden="true" />
                              </div>
                              <div className="min-w-0">
                                <h3 className="text-base font-semibold">{system.name}</h3>
                                <p className="mt-1 text-sm leading-snug text-slate-600">{system.description}</p>
                              </div>
                            </div>
                            <div className="flex shrink-0 flex-col items-end gap-2">
                              <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold', system.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600')}>
                                {system.enabled ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> : <XCircle className="h-3.5 w-3.5" aria-hidden="true" />}
                                {system.enabled ? 'Enabled' : 'Disabled'}
                              </span>
                              <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold', system.active ? 'bg-sky-100 text-sky-700' : 'bg-white/80 text-slate-600')}>
                                <span className={cn('h-2 w-2 rounded-full', system.active ? 'bg-sky-500' : 'bg-slate-300')} />
                                {system.active ? 'Active' : 'Idle'}
                              </span>
                            </div>
                          </div>

                          <dl className="mt-4 grid gap-x-4 gap-y-3 border-t border-white/60 pt-4 sm:grid-cols-2">
                            <div>
                              <dt className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-500">
                                <Clock3 className="h-4 w-4" aria-hidden="true" />
                                Last run
                              </dt>
                              <dd className="mt-1 text-sm font-semibold text-slate-900">{formatRunDate(system.lastRun?.finishedAt)}</dd>
                              {system.lastRun && (
                                <dd className={cn('mt-0.5 text-xs', system.lastRun.ok ? 'text-emerald-700' : 'text-rose-700')}>
                                  {system.lastRun.ok ? 'Succeeded' : 'Failed'} in {formatDuration(system.lastRun.durationMs)}
                                </dd>
                              )}
                            </div>
                            <div>
                              <dt className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-500">
                                <History className="h-4 w-4" aria-hidden="true" />
                                Schedule
                              </dt>
                              <dd className="mt-1 text-sm font-semibold text-slate-900">{system.schedule}</dd>
                            </div>
                          </dl>

                          <div className="mt-4 border-t border-white/60 pt-4">
                            <h4 className={SECTION_LABEL_CLASS}>Last 3 runs</h4>
                            {system.recentRuns.length > 0 ? (
                              <ol className="mt-2 divide-y divide-white/60 overflow-hidden rounded-lg border border-white/60">
                                {system.recentRuns.map((run) => (
                                  <li key={`${system.id}-${run.finishedAt}`} className="flex items-start justify-between gap-3 bg-white/38 px-3 py-2.5 text-sm">
                                    <div className="min-w-0">
                                      <p className="font-semibold text-slate-900">{formatRunDate(run.finishedAt)}</p>
                                      <p className="mt-0.5 truncate text-xs text-slate-500">{run.message}</p>
                                    </div>
                                    <span className={cn('shrink-0 rounded-full px-2 py-1 text-xs font-semibold', run.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700')}>
                                      {run.ok ? 'Success' : 'Failed'}
                                    </span>
                                  </li>
                                ))}
                              </ol>
                            ) : (
                              <p className="mt-2 text-sm text-slate-600">No runs recorded yet.</p>
                            )}
                          </div>
                        </section>
                      ))}
                    </div>
                  )}
                </section>
              </>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
