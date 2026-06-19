import { useUser } from '@clerk/clerk-react';
import { useAction, useConvex, useMutation } from 'convex/react';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from '../../../../convex/_generated/api';

interface SubscriptionContextValue {
  isSubscribed: boolean;
  isDeveloperUnlocked: boolean;
  isSignedIn: boolean;
  isLoading: boolean;
  status: string;
  country: string;
  startCheckout: () => Promise<void>;
  openBillingPortal: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);
const DEVELOPER_UNLOCK_KEY = 'moleui:developer-unlocked';

function subscriptionStatus(entitlement: any) {
  return typeof entitlement?.status === 'string' ? entitlement.status : 'loading';
}

function billingApi() {
  if (!window.moleDesktop.billing) {
    throw new Error('Billing is not available in this window');
  }

  return window.moleDesktop.billing;
}

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user, isSignedIn, isLoaded } = useUser();
  const convex = useConvex();
  const syncCurrentUser = useMutation(api.users.syncCurrentUser);
  const createCheckoutSession = useAction(api.billing.createCheckoutSession);
  const createBillingPortalSession = useAction(api.billing.createBillingPortalSession);
  const [entitlement, setEntitlement] = useState<any>();
  const [entitlementError, setEntitlementError] = useState<string | null>(null);
  const [country, setCountry] = useState('US');
  const [billingRefreshKey, setBillingRefreshKey] = useState(0);
  const [isDeveloperUnlocked, setIsDeveloperUnlocked] = useState(() => localStorage.getItem(DEVELOPER_UNLOCK_KEY) === 'true');

  useEffect(() => {
    const unlock = () => {
      localStorage.setItem(DEVELOPER_UNLOCK_KEY, 'true');
      setIsDeveloperUnlocked(true);
    };

    window.moleDesktop.developer?.onUnlockApp(unlock);
    return () => window.moleDesktop.developer?.removeListeners();
  }, []);

  useEffect(() => {
    if (!isSignedIn) {
      setEntitlement(undefined);
      setEntitlementError(null);
      return;
    }

    let cancelled = false;
    setEntitlement(undefined);
    setEntitlementError(null);

    async function loadEntitlement() {
      try {
        const nextEntitlement = await convex.query(api.subscriptions.entitlement, {});
        if (!cancelled) setEntitlement(nextEntitlement);
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : 'Failed to load subscription';
          setEntitlementError(message);
          console.error('Failed to load subscription:', error);
        }
      }
    }

    void loadEntitlement();

    return () => {
      cancelled = true;
    };
  }, [billingRefreshKey, convex, isSignedIn]);

  useEffect(() => {
    if (!isSignedIn || !user) return;

    let cancelled = false;
    const currentUser = user;

    async function sync() {
      const detectedCountry = await window.moleDesktop.billing?.detectCountry().catch(() => ({ country: 'US' }));
      if (cancelled) return;

      const nextCountry = detectedCountry?.country || 'US';
      setCountry(nextCountry);
      try {
        await syncCurrentUser({
          email: currentUser.primaryEmailAddress?.emailAddress ?? '',
          name: currentUser.fullName ?? currentUser.primaryEmailAddress?.emailAddress ?? 'Moleui user',
          imageUrl: currentUser.imageUrl,
          country: nextCountry,
        });
        setBillingRefreshKey((key) => key + 1);
      } catch (error) {
        console.error('Failed to sync user profile:', error);
      }
    }

    void sync();

    return () => {
      cancelled = true;
    };
  }, [isSignedIn, user, syncCurrentUser]);

  useEffect(() => {
    const onClosed = () => setBillingRefreshKey((key) => key + 1);
    window.moleDesktop.billing?.onClosed(onClosed);
    return () => window.moleDesktop.billing?.removeListeners();
  }, []);

  const value = useMemo<SubscriptionContextValue>(() => ({
    isSubscribed: isDeveloperUnlocked || Boolean(entitlement?.isSubscribed),
    isDeveloperUnlocked,
    isSignedIn: Boolean(isSignedIn),
    isLoading: !isDeveloperUnlocked && (!isLoaded || (Boolean(isSignedIn) && entitlement === undefined && !entitlementError)),
    status: isDeveloperUnlocked ? 'developer-unlocked' : entitlementError ? 'error' : subscriptionStatus(entitlement),
    country,
    startCheckout: async () => {
      if (!user) throw new Error('Sign in to start checkout');

      const billing = billingApi();
      const detectedCountry = await billing.detectCountry().catch(() => ({ country }));
      const checkoutCountry = detectedCountry.country || country;
      await syncCurrentUser({
        email: user.primaryEmailAddress?.emailAddress ?? '',
        name: user.fullName ?? user.primaryEmailAddress?.emailAddress ?? 'Moleui user',
        imageUrl: user.imageUrl,
        country: checkoutCountry,
      });
      setCountry(checkoutCountry);

      const session = await createCheckoutSession({ country: checkoutCountry });
      const result = await billing.openCheckout(session.url);
      if (!result.ok) throw new Error(result.message || 'Failed to open checkout');
    },
    openBillingPortal: async () => {
      if (!user) throw new Error('Sign in to manage billing');

      const billing = billingApi();
      await syncCurrentUser({
        email: user.primaryEmailAddress?.emailAddress ?? '',
        name: user.fullName ?? user.primaryEmailAddress?.emailAddress ?? 'Moleui user',
        imageUrl: user.imageUrl,
        country,
      });

      const session = await createBillingPortalSession({});
      const result = await billing.openPortal(session.url);
      if (!result.ok) throw new Error(result.message || 'Failed to open billing portal');
    },
  }), [country, createBillingPortalSession, createCheckoutSession, entitlement, entitlementError, isDeveloperUnlocked, isLoaded, isSignedIn, user, syncCurrentUser, billingRefreshKey]);

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  return context ?? {
    isSubscribed: true,
    isDeveloperUnlocked: false,
    isSignedIn: true,
    isLoading: false,
    status: 'unavailable',
    country: 'US',
    startCheckout: async () => {
      throw new Error('Subscription data is not available');
    },
    openBillingPortal: async () => {
      throw new Error('Subscription data is not available');
    },
  };
}
