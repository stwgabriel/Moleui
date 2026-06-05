import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { LockKeyhole, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useSubscription } from '@/hooks/useSubscription';

interface PaywallContextValue {
  requireSubscription: (featureName: string) => boolean;
  openSubscribeModal: (featureName?: string) => void;
}

const PaywallContext = createContext<PaywallContextValue | null>(null);

export function PaywallProvider({ children }: { children: ReactNode }) {
  const subscription = useSubscription();
  const [modalFeature, setModalFeature] = useState<string | null>(null);
  const [isStartingCheckout, setIsStartingCheckout] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const subscribe = async () => {
    setIsStartingCheckout(true);
    setCheckoutError(null);
    try {
      await subscription.startCheckout();
      setModalFeature(null);
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : 'Failed to open checkout');
    } finally {
      setIsStartingCheckout(false);
    }
  };

  const value = useMemo<PaywallContextValue>(() => ({
    requireSubscription: (featureName: string) => {
      if (subscription.isSubscribed) return true;
      setCheckoutError(null);
      setModalFeature(featureName);
      return false;
    },
    openSubscribeModal: (featureName = 'Moleui Pro') => {
      setCheckoutError(null);
      setModalFeature(featureName);
    },
  }), [subscription.isSubscribed]);

  const showBanner = subscription.isSignedIn && !subscription.isSubscribed && !subscription.isLoading;

  return (
    <PaywallContext.Provider value={value}>
      {children}
      {showBanner && (
        <aside className="fixed bottom-5 right-5 z-40 w-[min(calc(100vw-2rem),22rem)] overflow-hidden rounded-[1.7rem] border border-white/60 bg-white/45 p-4 text-slate-950 shadow-[0_24px_80px_rgba(76,29,149,0.24),inset_0_1px_0_rgba(255,255,255,0.9),inset_0_-18px_44px_rgba(124,58,237,0.1)] backdrop-blur-2xl">
          <div className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-violet-400/30 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-12 left-6 h-24 w-24 rounded-full bg-fuchsia-300/24 blur-2xl" />
          <div className="relative flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/70 bg-white/55 text-violet-700 shadow-[8px_8px_24px_rgba(76,29,149,0.16),-8px_-8px_24px_rgba(255,255,255,0.75),inset_0_1px_0_rgba(255,255,255,0.9)]">
              <LockKeyhole className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-black">Unlock Moleui Pro</h2>
              <Button
                size="sm"
                icon={LockKeyhole}
                onClick={() => setModalFeature('Moleui Pro')}
                className="mt-3 h-11 w-full rounded-2xl bg-violet-600/92 shadow-[0_14px_34px_rgba(109,40,217,0.32),inset_0_1px_0_rgba(255,255,255,0.28)] ring-1 ring-white/35 hover:bg-violet-700"
              >
                Unlock Pro
              </Button>
            </div>
          </div>
        </aside>
      )}
      {modalFeature && !subscription.isSubscribed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/24 p-6 backdrop-blur-sm">
          <section className="relative w-full max-w-md rounded-[1.75rem] border border-white/70 bg-white/82 p-6 text-center text-slate-950 shadow-[0_28px_90px_rgba(15,23,42,0.18)] backdrop-blur-2xl">
            <button
              type="button"
              onClick={() => setModalFeature(null)}
              className="absolute right-4 top-4 rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close subscription prompt"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
              <LockKeyhole className="h-7 w-7" />
            </div>
            <h2 className="mt-5 text-2xl font-black tracking-[-0.04em]">Subscription required</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
              {modalFeature} requires Moleui Pro.
            </p>
            {checkoutError && (
              <p className="mt-4 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
                {checkoutError}
              </p>
            )}
            <div className="mt-6 flex justify-center gap-3">
              <Button onClick={subscribe} disabled={isStartingCheckout} className="flex-1 rounded-full bg-violet-600 hover:bg-violet-700">
                {isStartingCheckout ? 'Opening checkout...' : 'Subscribe'}
              </Button>
              <Button variant="secondary" onClick={() => setModalFeature(null)} className="rounded-full bg-white/70">
                Not now
              </Button>
            </div>
          </section>
        </div>
      )}
    </PaywallContext.Provider>
  );
}

export function usePaywall() {
  const context = useContext(PaywallContext);
  return context ?? {
    requireSubscription: () => true,
    openSubscribeModal: () => undefined,
  };
}
