import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Toaster } from 'sonner';
import { cn } from '@/utils/cn';
import { Sidebar } from '@/components/layout/Sidebar';
import { LoginWindow } from '@/components/auth/LoginWindow';
import { CliMonitorWindow } from '@/components/developer/CliMonitorWindow';
import { SettingsWindow } from '@/components/settings/SettingsWindow';
import { MyMacPage } from '@/pages/MyMacPage';
import { PaywallProvider } from '@/hooks/usePaywall';
import { SubscriptionProvider } from '@/hooks/useSubscription';
import { usePermissions } from '@/hooks/usePermissions';
import { OnboardingModal } from '@/components/permissions/OnboardingModal';
import { PermissionsBanner } from '@/components/permissions/PermissionsBanner';
import type { PageId } from '@/types';

// Order feature pages appear in (sidebar order + the order kept-alive pages mount)
const PAGE_ORDER: PageId[] = ['mymac', 'clean', 'optimize', 'uninstall', 'analyze'];

const CleanPage = lazy(() => import('@/pages/CleanPage').then((module) => ({ default: module.CleanPage })));
const OptimizePage = lazy(() => import('@/pages/OptimizePage').then((module) => ({ default: module.OptimizePage })));
const UninstallPage = lazy(() => import('@/pages/UninstallPage').then((module) => ({ default: module.UninstallPage })));
const AnalyzePage = lazy(() => import('@/pages/AnalyzePage').then((module) => ({ default: module.AnalyzePage })));

function PageLoadingFallback() {
  return (
    <div className="flex h-full items-center justify-center" role="status" aria-label="Loading page">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-300/30 border-t-violet-600" />
    </div>
  );
}

function App() {
  // Prefer the launch-arg window mode (set in preload) so the login window keeps
  // its identity even after Clerk's post-sign-in redirect strips the URL query.
  // Fall back to the URL for other windows and for non-Electron contexts (tests).
  const windowMode = window.moleDesktop?.windowMode || new URLSearchParams(window.location.search).get('window');

  if (windowMode === 'login') {
    return <LoginWindow />;
  }

  if (windowMode === 'settings') {
    return (
      <SubscriptionProvider>
        <SettingsWindow />
      </SubscriptionProvider>
    );
  }

  if (windowMode === 'developer') {
    return <CliMonitorWindow />;
  }

  return <MainApp />;
}

function MainApp() {
  const [currentPage, setCurrentPage] = useState<PageId>('mymac');
  // Keep visited feature pages mounted so an in-flight run (clean, optimize, etc.)
  // survives navigation and keeps running in the background, and so multiple
  // features can run in parallel. Pages mount lazily on first visit and stay
  // mounted; only their visibility toggles.
  const [visitedPages, setVisitedPages] = useState<Set<PageId>>(() => new Set<PageId>(['mymac']));
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const onboardingShownRef = useRef(false);
  const permissions = usePermissions();

  useEffect(() => {
    document.documentElement.classList.toggle('my-mac-effects', currentPage === 'mymac' || currentPage === 'analyze');

    return () => {
      document.documentElement.classList.remove('my-mac-effects');
    };
  }, [currentPage]);

  const hasVisitedFeature = [...visitedPages].some((id) => id !== 'mymac');

  // Show the first-run permissions onboarding the first time a feature is opened,
  // once prefs have loaded and the user hasn't been onboarded yet.
  useEffect(() => {
    if (!permissions.loading && !permissions.onboarded && hasVisitedFeature && !onboardingShownRef.current) {
      onboardingShownRef.current = true;
      setShowOnboarding(true);
    }
  }, [permissions.loading, permissions.onboarded, hasVisitedFeature]);

  const handlePageChange = (newPage: PageId) => {
    if (newPage === currentPage) return;
    setVisitedPages((prev) => (prev.has(newPage) ? prev : new Set(prev).add(newPage)));
    setCurrentPage(newPage);
  };

  const renderPage = (id: PageId, isActive: boolean) => {
    switch (id) {
      case 'mymac':
        return <MyMacPage onNavigate={handlePageChange} active={isActive} />;
      case 'clean':
        return <CleanPage />;
      case 'optimize':
        return <OptimizePage />;
      case 'uninstall':
        return <UninstallPage />;
      case 'analyze':
        return <AnalyzePage />;
      default:
        return null;
    }
  };

  const finishOnboarding = () => {
    setShowOnboarding(false);
    void permissions.setPrefs({ onboarded: true });
  };

  const showBanner = !bannerDismissed && permissions.fullDiskAccess === 'denied' && permissions.systemCleanupEnabled;

  return (
    <SubscriptionProvider>
      <PaywallProvider>
      <Toaster
        position="bottom-center"
        toastOptions={{
          classNames: {
            toast: 'glass-surface border border-surface-hover text-text-primary',
            description: 'text-text-secondary',
          },
        }}
      />
      <div className="window-drag-region" aria-hidden="true" />
      <div className="relative h-screen overflow-hidden">
        <div
          className="flex h-full w-full overflow-hidden rounded-[1rem] border border-white/55 bg-white/[0.22] shadow-[0_30px_90px_rgba(109,93,252,0.16),inset_0_1px_1px_rgba(255,255,255,0.78)] backdrop-blur-[28px] transition-opacity duration-300"
        >
          <Sidebar
            currentPage={currentPage}
            onPageChange={handlePageChange}
          />
          <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden" aria-live="polite">
            {showBanner && (
              <div className="shrink-0 px-3 pt-3">
                <PermissionsBanner
                  onOpen={() => permissions.openSettings('fullDiskAccess')}
                  onDismiss={() => setBannerDismissed(true)}
                />
              </div>
            )}
            <div className="relative min-h-0 flex-1">
              {PAGE_ORDER.filter((id) => visitedPages.has(id)).map((id) => {
                const isActive = id === currentPage;
                return (
                  <div
                    key={id}
                    aria-hidden={!isActive}
                    className={cn(
                      'absolute inset-0 transition duration-300 ease-out',
                      isActive ? 'opacity-100 translate-y-0' : 'pointer-events-none translate-y-2 opacity-0'
                    )}
                  >
                    <Suspense fallback={<PageLoadingFallback />}>
                      {renderPage(id, isActive)}
                    </Suspense>
                  </div>
                );
              })}
            </div>
          </main>
        </div>
      </div>
      {showOnboarding && (
        <OnboardingModal
          fullDiskAccess={permissions.fullDiskAccess}
          loading={permissions.loading}
          onOpenFda={() => permissions.openSettings('fullDiskAccess')}
          onRequestFiles={() => void permissions.requestFiles()}
          onRecheck={() => void permissions.refresh()}
          onDone={finishOnboarding}
        />
      )}
      </PaywallProvider>
    </SubscriptionProvider>
  );
}

export default App;
