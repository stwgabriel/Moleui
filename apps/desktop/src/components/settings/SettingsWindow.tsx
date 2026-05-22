import { useEffect, useState } from 'react';
import { Fingerprint, Monitor, Settings, UserRound } from 'lucide-react';

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

export function SettingsWindow() {
  const [profile, setProfile] = useState<SettingsProfile>(FALLBACK_PROFILE);
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
    <main className="h-screen overflow-hidden bg-[linear-gradient(135deg,#f8f7ff_0%,#eef7ff_48%,#f7fbf7_100%)] text-slate-950">
      <div className="window-drag-region" aria-hidden="true" />
      <section className="flex h-full flex-col px-7 pb-7 pt-10">
        <header className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/72 text-violet-600 shadow-[0_10px_30px_rgba(88,70,220,0.14)] ring-1 ring-white/80">
            <Settings className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-2xl font-bold leading-tight">Settings</h1>
            <p className="mt-1 text-sm text-slate-600">Device preferences</p>
          </div>
        </header>

        <div className="mt-8 space-y-6">
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
      </section>
    </main>
  );
}
