import { useEffect, useState } from 'react';
import { useClerk, useUser } from '@clerk/clerk-react';
import { Activity, CheckCircle2, Clock3, CreditCard, Crown, Fingerprint, History, LogOut, RotateCw, Settings, ShieldCheck, XCircle, type LucideIcon } from 'lucide-react';
import type { BackgroundSystemStatus } from '@/types';
import { UserAvatar } from '@/components/account/UserAvatar';
import { PermissionsPanel } from '@/components/permissions/PermissionsPanel';
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

type SettingsPage = 'general' | 'permissions' | 'background';

// Glass panel that matches the main app surfaces: translucent white over the body
// gradient, purple-tinted shadow, soft blur and an inset highlight.
const PANEL = 'rounded-2xl border border-white/55 bg-white/60 shadow-[0_18px_50px_rgba(109,93,252,0.12),inset_0_1px_0_rgba(255,255,255,0.65)] backdrop-blur-2xl';
const SECTION_LABEL = 'text-[0.7rem] font-bold uppercase tracking-[0.08em] text-slate-400';

const SETTINGS_PAGES: Array<{ id: SettingsPage; label: string; icon: LucideIcon }> = [
  { id: 'general', label: 'General', icon: Settings },
  { id: 'permissions', label: 'Permissions', icon: ShieldCheck },
  { id: 'background', label: 'Background', icon: Activity },
];

function IconTile({ icon: Icon, className }: { icon: LucideIcon; className?: string }) {
  return (
    <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', className)}>
      <Icon className="h-5 w-5" aria-hidden="true" />
    </div>
  );
}

function formatRunDate(value?: string | null) {
  if (!value) return 'Never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function formatDuration(durationMs: number) {
  if (!Number.isFinite(durationMs) || durationMs < 0) return 'Unknown duration';
  if (durationMs < 1000) return `${Math.round(durationMs)} ms`;
  return `${(durationMs / 1000).toFixed(1)} s`;
}

export function SettingsWindow() {
  const subscription = useSubscription();
  const { user: clerkUser } = useUser();
  const { signOut: clerkSignOut } = useClerk();
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
        if (isMounted && nextProfile) setProfile(nextProfile);
      } catch (error) {
        console.error('Failed to load settings profile:', error);
      }
    }

    async function loadTouchIdStatus() {
      try {
        const result = await window.moleDesktop?.touchid?.status?.();
        if (isMounted && result?.stdout?.includes('enabled')) setIsTouchIdEnabled(true);
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
        if (isMounted && Array.isArray(nextSystems)) setBackgroundSystems(nextSystems);
      } catch (error) {
        console.error('Failed to load background systems:', error);
      } finally {
        if (isMounted) setIsLoadingBackgroundSystems(false);
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
    // Kick off Clerk's server-side session revocation, but don't await it: Clerk
    // navigates the window on sign-out, which can tear this handler down before
    // the window hand-off runs. The main process clears the local session and
    // returns to a clean login window authoritatively, so sign-out is guaranteed
    // either way.
    void clerkSignOut().catch((error) => {
      console.error('Clerk sign-out failed:', error);
    });
    await window.moleDesktop.auth?.signOut();
  }

  const isSubscribed = subscription.isSubscribed;
  const priceLabel = subscription.country === 'BR' ? 'R$15 / month' : '$5 / month';

  return (
    <main data-testid="settings-window" className="h-screen min-h-0 overflow-hidden text-slate-900">
      <div className="window-drag-region" aria-hidden="true" />
      <section className="grid h-full min-h-0 grid-cols-[10rem_minmax(0,1fr)] gap-5 px-6 pb-6 pt-10">
        <aside className="flex min-h-0 flex-col">
          <header className="px-1">
            <IconTile icon={Settings} className="bg-violet-600 text-white shadow-[0_12px_30px_rgba(124,58,237,0.35)]" />
            <h1 className="mt-4 text-[1.35rem] font-bold leading-tight">Settings</h1>
            <p className="mt-1 truncate text-xs font-medium text-slate-500">{profile.deviceName}</p>
          </header>

          <nav className="mt-7 space-y-1" aria-label="Settings categories">
            {SETTINGS_PAGES.map((page) => {
              const Icon = page.icon;
              const isActive = activePage === page.id;
              return (
                <button
                  key={page.id}
                  type="button"
                  onClick={() => setActivePage(page.id)}
                  className={cn(
                    'group flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-semibold transition-all duration-200 ease-out',
                    isActive
                      ? 'bg-white/75 text-violet-700 shadow-[0_10px_26px_rgba(109,93,252,0.14)] ring-1 ring-white/70'
                      : 'text-slate-500 hover:bg-white/45 hover:text-slate-800'
                  )}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon className={cn('h-4 w-4 shrink-0 transition-transform duration-200 group-hover:scale-110', isActive && 'text-violet-600')} aria-hidden="true" />
                  <span className="truncate">{page.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        <div data-testid="settings-content" className="min-h-0 overflow-y-auto pr-1 custom-scrollbar">
          <div className="mx-auto max-w-[600px] space-y-4 pb-2">
            {activePage === 'general' ? (
              <>
                {/* Account */}
                <section aria-labelledby="account-heading" className={cn(PANEL, 'p-4')}>
                  <h2 id="account-heading" className="sr-only">Account</h2>
                  <div className="flex min-w-0 items-center gap-3.5">
                    <UserAvatar className="h-12 w-12 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[0.95rem] font-bold leading-tight">{displayName}</p>
                      <p className="truncate text-sm text-slate-500">{displayEmail}</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold text-slate-500 transition-colors duration-200 hover:bg-rose-50 hover:text-rose-600"
                    >
                      <LogOut className="h-4 w-4" aria-hidden="true" />
                      Sign out
                    </button>
                  </div>
                </section>

                {/* Subscription — the hero of this page */}
                <section aria-labelledby="subscription-heading" className={cn(PANEL, 'overflow-hidden')}>
                  <h2 id="subscription-heading" className="sr-only">Subscription</h2>
                  <div className="bg-gradient-to-br from-violet-500/[0.07] to-fuchsia-500/[0.04] p-5">
                    <div className="flex items-start gap-3.5">
                      <IconTile icon={Crown} className="h-11 w-11 bg-violet-600 text-white shadow-[0_12px_30px_rgba(124,58,237,0.35)]" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-[1.05rem] font-bold leading-tight">Moleui Pro</p>
                          <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold', isSubscribed ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500')}>
                            {isSubscribed && <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />}
                            {isSubscribed ? 'Active' : 'Not subscribed'}
                          </span>
                        </div>
                        <p className="mt-1.5 text-sm leading-5 text-slate-600">
                          {isSubscribed
                            ? 'Cleanup, Optimize, Uninstall, and Storage are unlocked on this account.'
                            : 'My Mac is free. Cleanup, Optimize, Uninstall, and Storage require Pro.'}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-slate-500">{priceLabel}</span>
                      <button
                        type="button"
                        onClick={isSubscribed ? handleBillingPortalClick : handleSubscribeClick}
                        disabled={isBillingBusy}
                        aria-busy={isBillingBusy}
                        className="inline-flex items-center gap-2 rounded-full bg-violet-600 px-5 py-2.5 text-sm font-bold text-white shadow-[0_12px_28px_rgba(124,58,237,0.32)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-violet-700 active:translate-y-0 disabled:translate-y-0 disabled:opacity-60"
                      >
                        <CreditCard className="h-4 w-4" aria-hidden="true" />
                        {isBillingBusy ? 'Opening…' : isSubscribed ? 'Manage billing' : 'Subscribe'}
                      </button>
                    </div>

                    {billingError && (
                      <p className="mt-3 rounded-xl border border-rose-100 bg-rose-50/80 px-3 py-2 text-sm font-semibold text-rose-700">
                        {billingError}
                      </p>
                    )}
                  </div>
                </section>

                {/* Security */}
                <section aria-labelledby="security-heading" className={cn(PANEL, 'p-4')}>
                  <h2 id="security-heading" className={cn(SECTION_LABEL, 'mb-3 block')}>Security</h2>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <IconTile icon={Fingerprint} className="bg-sky-100 text-sky-600" />
                      <div className="min-w-0">
                        <p className="text-[0.95rem] font-semibold">Touch ID</p>
                        <p className="text-sm text-slate-500">Confirm protected actions with your fingerprint</p>
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
                      <span className="h-7 w-12 rounded-full bg-slate-300 transition-colors duration-200 peer-checked:bg-violet-600" />
                      <span className="absolute left-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 peer-checked:translate-x-5" />
                    </label>
                  </div>
                </section>
              </>
            ) : activePage === 'permissions' ? (
              <section aria-labelledby="permissions-heading" className={cn(PANEL, 'p-4 sm:p-5')}>
                <h2 id="permissions-heading" className="mb-3 text-base font-bold text-slate-900">Permissions</h2>
                <PermissionsPanel />
              </section>
            ) : (
              <section aria-labelledby="background-heading" className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <h2 id="background-heading" className={SECTION_LABEL}>Background systems</h2>
                  <button
                    type="button"
                    onClick={() => setBackgroundRefreshKey((key) => key + 1)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white/60 px-3 text-sm font-semibold text-violet-700 ring-1 ring-white/60 transition-colors duration-200 hover:bg-white/80"
                  >
                    <RotateCw className={cn('h-3.5 w-3.5', isLoadingBackgroundSystems && 'animate-spin')} aria-hidden="true" />
                    Refresh
                  </button>
                </div>

                {backgroundSystems.length === 0 ? (
                  <div className={cn(PANEL, 'px-4 py-6 text-center text-sm text-slate-500')}>
                    {isLoadingBackgroundSystems ? 'Loading background systems…' : 'No background systems reported.'}
                  </div>
                ) : (
                  backgroundSystems.map((system) => (
                    <section key={system.id} className={cn(PANEL, 'p-4')} aria-label={system.name}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex min-w-0 items-start gap-3">
                          <IconTile icon={Activity} className="bg-violet-100 text-violet-600" />
                          <div className="min-w-0">
                            <h3 className="text-[0.95rem] font-semibold">{system.name}</h3>
                            <p className="mt-0.5 text-sm leading-snug text-slate-500">{system.description}</p>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold', system.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500')}>
                            {system.enabled ? <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> : <XCircle className="h-3 w-3" aria-hidden="true" />}
                            {system.enabled ? 'On' : 'Off'}
                          </span>
                          <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold', system.active ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-500')}>
                            <span className={cn('h-1.5 w-1.5 rounded-full', system.active ? 'bg-sky-500' : 'bg-slate-300')} />
                            {system.active ? 'Active' : 'Idle'}
                          </span>
                        </div>
                      </div>

                      <dl className="mt-4 grid gap-x-4 gap-y-3 border-t border-white/55 pt-3.5 sm:grid-cols-2">
                        <div>
                          <dt className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
                            <Clock3 className="h-3.5 w-3.5" aria-hidden="true" /> Last run
                          </dt>
                          <dd className="mt-1 text-sm font-semibold text-slate-800">{formatRunDate(system.lastRun?.finishedAt)}</dd>
                          {system.lastRun && (
                            <dd className={cn('mt-0.5 text-xs font-medium', system.lastRun.ok ? 'text-emerald-600' : 'text-rose-600')}>
                              {system.lastRun.ok ? 'Succeeded' : 'Failed'} in {formatDuration(system.lastRun.durationMs)}
                            </dd>
                          )}
                        </div>
                        <div>
                          <dt className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
                            <History className="h-3.5 w-3.5" aria-hidden="true" /> Schedule
                          </dt>
                          <dd className="mt-1 text-sm font-semibold text-slate-800">{system.schedule}</dd>
                        </div>
                      </dl>
                    </section>
                  ))
                )}
              </section>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
