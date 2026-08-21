import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SubscriptionProvider, useSubscription } from './useSubscription';

const mocks = vi.hoisted(() => ({
  useUser: vi.fn(),
  useConvex: vi.fn(),
  useMutation: vi.fn(),
  useAction: vi.fn(),
}));

vi.mock('@clerk/clerk-react', () => ({ useUser: mocks.useUser }));
vi.mock('convex/react', () => ({
  useConvex: mocks.useConvex,
  useMutation: mocks.useMutation,
  useAction: mocks.useAction,
}));

function BillingHarness() {
  const subscription = useSubscription();
  return (
    <div>
      <button type="button" onClick={() => void subscription.startCheckout()}>
        Checkout
      </button>
      <button type="button" onClick={() => void subscription.openBillingPortal()}>
        Billing portal
      </button>
      <span>{subscription.country}</span>
      <span data-testid="subscription-status">{subscription.status}</span>
    </div>
  );
}

function setupBilling(action: 'checkout' | 'portal') {
  const syncCurrentUser = vi.fn().mockResolvedValue(undefined);
  const createCheckoutSession = vi.fn().mockResolvedValue({ url: 'https://checkout.stripe.com/test-session' });
  const createBillingPortalSession = vi.fn().mockResolvedValue({ url: 'https://billing.stripe.com/test-session' });
  const detectCountry = vi.fn().mockResolvedValue({ country: 'BR' });
  const openCheckout = vi.fn().mockResolvedValue({ ok: true, message: '' });
  const openPortal = vi.fn().mockResolvedValue({ ok: true, message: '' });
  const entitlementWatch = {
    localQueryResult: vi.fn().mockReturnValue({ isSubscribed: false, status: 'none' }),
    onUpdate: vi.fn(),
  };
  let notifyEntitlement = () => {};
  entitlementWatch.onUpdate.mockImplementation((callback: () => void) => {
    notifyEntitlement = callback;
    return vi.fn();
  });

  const storage = {
    getItem: vi.fn().mockReturnValue(null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  };
  Object.defineProperty(window, 'localStorage', { configurable: true, value: storage });
  window.moleDesktop = {
    getRuntimeInfo: vi.fn().mockResolvedValue({ packaged: false }),
    developer: { onUnlockApp: vi.fn(), removeListeners: vi.fn() },
    billing: {
      detectCountry,
      openCheckout,
      openPortal,
      onClosed: vi.fn(),
      removeListeners: vi.fn(),
    },
  } as unknown as typeof window.moleDesktop;

  mocks.useUser.mockReturnValue({
    isLoaded: true,
    isSignedIn: true,
    user: {
      primaryEmailAddress: { emailAddress: 'test@example.com' },
      fullName: 'Test User',
      imageUrl: 'https://example.com/avatar.png',
    },
  });
  mocks.useConvex.mockReturnValue({
    watchQuery: vi.fn().mockReturnValue(entitlementWatch),
  });
  mocks.useMutation.mockReturnValue(syncCurrentUser);
  mocks.useAction.mockReturnValue(action === 'checkout' ? createCheckoutSession : createBillingPortalSession);

  return {
    syncCurrentUser,
    createCheckoutSession,
    createBillingPortalSession,
    detectCountry,
    openCheckout,
    openPortal,
    updateEntitlement: () => {
      entitlementWatch.localQueryResult.mockReturnValue({ isSubscribed: true, status: 'active' });
      notifyEntitlement();
    },
  };
}

describe('SubscriptionProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('syncs the signed-in account and opens a server-created checkout session', async () => {
    const billing = setupBilling('checkout');
    render(
      <SubscriptionProvider>
        <BillingHarness />
      </SubscriptionProvider>
    );

    await waitFor(() => expect(billing.syncCurrentUser).toHaveBeenCalledWith(expect.objectContaining({ country: 'BR' })));
    billing.syncCurrentUser.mockClear();

    fireEvent.click(screen.getByRole('button', { name: 'Checkout' }));

    await waitFor(() => expect(billing.openCheckout).toHaveBeenCalledWith('https://checkout.stripe.com/test-session'));
    expect(billing.detectCountry).toHaveBeenCalled();
    expect(billing.syncCurrentUser).toHaveBeenCalledWith(expect.objectContaining({
      email: 'test@example.com',
      name: 'Test User',
      country: 'BR',
    }));
    expect(billing.createCheckoutSession).toHaveBeenCalledWith({});
  });

  it('opens the server-created billing portal session for the signed-in account', async () => {
    const billing = setupBilling('portal');
    render(
      <SubscriptionProvider>
        <BillingHarness />
      </SubscriptionProvider>
    );

    await waitFor(() => expect(billing.syncCurrentUser).toHaveBeenCalled());
    billing.syncCurrentUser.mockClear();

    fireEvent.click(screen.getByRole('button', { name: 'Billing portal' }));

    await waitFor(() => expect(billing.openPortal).toHaveBeenCalledWith('https://billing.stripe.com/test-session'));
    expect(billing.createBillingPortalSession).toHaveBeenCalledWith({});
    expect(billing.syncCurrentUser).toHaveBeenCalledWith(expect.objectContaining({ country: 'BR' }));
  });

  it('updates entitlement when Convex receives a subscription change', async () => {
    const billing = setupBilling('checkout');
    render(
      <SubscriptionProvider>
        <BillingHarness />
      </SubscriptionProvider>
    );

    expect(screen.getByTestId('subscription-status')).toHaveTextContent('none');
    billing.updateEntitlement();

    await waitFor(() => expect(screen.getByTestId('subscription-status')).toHaveTextContent('active'));
  });
});
