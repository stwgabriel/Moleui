import { SignIn, useUser } from '@clerk/clerk-react';
import { LockKeyhole, MonitorCheck, ShieldCheck, Sparkles } from 'lucide-react';
import { useEffect } from 'react';

function LoginLoadingState() {
  return (
    <main className="relative flex h-screen items-center justify-center overflow-hidden bg-[#fbf9ff] text-slate-950">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(109,93,252,0.22),transparent_34%),radial-gradient(circle_at_92%_24%,rgba(236,72,153,0.12),transparent_32%),radial-gradient(circle_at_70%_96%,rgba(59,130,246,0.13),transparent_38%)]" />
      <div className="relative flex h-28 w-28 items-center justify-center">
        <div className="absolute inset-0 animate-spin rounded-full border-[5px] border-violet-300/30 border-t-violet-600 shadow-[0_0_55px_rgba(109,93,252,0.28)]" />
        <div className="flex h-24 w-24 items-center justify-center rounded-[2rem]">
          <img src="./assets/images/rounded-logo.png" alt="Moleui" className="h-24 w-24 object-contain" draggable={false} />
        </div>
      </div>
    </main>
  );
}

export function LoginWindow() {
  const { isLoaded, isSignedIn } = useUser();

  useEffect(() => {
    if (!isLoaded) return;

    if (isSignedIn) {
      void window.moleDesktop.auth?.complete();
      return;
    }

    void window.moleDesktop.auth?.showLogin();
  }, [isLoaded, isSignedIn]);

  if (!isLoaded || isSignedIn) {
    return <LoginLoadingState />;
  }

  return (
    <main className="relative h-screen overflow-hidden bg-[#fbf9ff] p-5 text-slate-950">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(109,93,252,0.22),transparent_34%),radial-gradient(circle_at_92%_24%,rgba(236,72,153,0.12),transparent_32%),radial-gradient(circle_at_70%_96%,rgba(59,130,246,0.13),transparent_38%)]" />
      <div className="pointer-events-none absolute -left-24 top-20 h-72 w-72 rounded-full border border-white/55" />
      <div className="pointer-events-none absolute -right-20 bottom-10 h-96 w-96 rounded-full border border-white/45" />

      <section className="relative grid h-full min-h-0 grid-cols-[0.92fr_1.08fr] overflow-hidden rounded-[2rem] border border-white/70 bg-white/42 shadow-[0_30px_90px_rgba(109,93,252,0.16),inset_0_1px_1px_rgba(255,255,255,0.72)] backdrop-blur-2xl">
        <aside className="relative flex min-h-0 flex-col justify-between overflow-hidden border-r border-white/60 p-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_24%,rgba(109,93,252,0.18),transparent_42%),linear-gradient(145deg,rgba(255,255,255,0.46),rgba(255,255,255,0.14))]" />
          <div className="relative">
            <div className="flex items-center gap-3">
              <img src="./assets/images/rounded-logo.png" alt="Moleui" className="h-16 w-16 object-contain drop-shadow-[0_16px_34px_rgba(109,93,252,0.20)]" draggable={false} />
              <div>
                <p className="text-sm font-black uppercase tracking-[0.18em] text-violet-600">Moleui</p>
                <h1 className="text-3xl font-black tracking-[-0.055em] text-slate-950">Your Mac, protected.</h1>
              </div>
            </div>

            <p className="mt-8 max-w-sm text-[1.05rem] font-semibold leading-7 text-slate-600">
              Sign in before using local tools. My Mac stays free; Pro unlocks cleanup, optimize, uninstall, and storage actions.
            </p>

            <div className="mt-8 space-y-3">
              {[
                { icon: ShieldCheck, title: 'Account-secured tools', text: 'Your subscription follows your Clerk account.' },
                { icon: MonitorCheck, title: 'My Mac included', text: 'System dashboard remains available without Pro.' },
                { icon: Sparkles, title: 'In-app billing', text: 'Subscribe and manage billing without leaving Moleui.' },
              ].map(({ icon: Icon, title, text }) => (
                <div key={title} className="flex items-start gap-3 rounded-2xl border border-white/60 bg-white/40 p-3 shadow-inner shadow-white/30 backdrop-blur-xl">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-slate-950">{title}</h2>
                    <p className="mt-0.5 text-xs font-semibold leading-5 text-slate-500">{text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative flex items-center gap-2 rounded-full border border-violet-100 bg-violet-50/80 px-4 py-3 text-sm font-bold text-violet-700 shadow-[0_14px_34px_rgba(109,93,252,0.10)]">
            <LockKeyhole className="h-4 w-4" aria-hidden="true" />
            Brazil R$15/mo, everywhere else $5/mo
          </div>
        </aside>

        <div className="relative flex min-h-0 items-center justify-center overflow-y-auto p-8">
          <div className="w-full max-w-[390px] rounded-[1.6rem] border border-white/70 bg-white/72 p-5 shadow-[0_24px_70px_rgba(83,76,148,0.13)] backdrop-blur-2xl">
            <div className="mb-5 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-[0_16px_40px_rgba(15,23,42,0.16)]">
                <LockKeyhole className="h-5 w-5" aria-hidden="true" />
              </div>
              <h2 className="mt-4 text-2xl font-black tracking-[-0.045em]">Welcome back</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">Use a magic link or password to continue.</p>
            </div>
            <SignIn
              routing="hash"
              appearance={{
                elements: {
                  rootBox: 'w-full',
                  card: 'shadow-none border-0 bg-transparent p-0 w-full',
                  headerTitle: 'hidden',
                  headerSubtitle: 'hidden',
                  main: 'gap-4',
                  socialButtonsBlockButton: 'rounded-xl border-white/70 bg-white/70 font-semibold shadow-inner shadow-white/40',
                  formButtonPrimary: 'rounded-full bg-violet-600 hover:bg-violet-700 text-sm font-bold shadow-[0_14px_30px_rgba(109,93,252,0.22)]',
                  formFieldInput: 'rounded-xl border-white/70 bg-white/70 shadow-inner shadow-white/40 focus:ring-violet-500',
                  formFieldLabel: 'text-slate-600 font-bold',
                  footerActionLink: 'text-violet-700 font-bold',
                  identityPreviewEditButton: 'text-violet-700 font-bold',
                },
              }}
            />
          </div>
        </div>
      </section>
    </main>
  );
}
