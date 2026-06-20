import { lazy, Suspense, useEffect, useState } from 'react';
import { Toaster } from 'sonner';
import { cn } from '@/utils/cn';
import { Sidebar } from '@/components/layout/Sidebar';
import { LoginWindow } from '@/components/auth/LoginWindow';
import { CliMonitorWindow } from '@/components/developer/CliMonitorWindow';
import { SettingsWindow } from '@/components/settings/SettingsWindow';
import { MyMacPage } from '@/pages/MyMacPage';
import { PaywallProvider } from '@/hooks/usePaywall';
import { SubscriptionProvider } from '@/hooks/useSubscription';
import type { PageId } from '@/types';

// Page order for determining animation direction
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
  const isLoginWindow = windowMode === 'login';
  const isSettingsWindow = windowMode === 'settings';
  const isDeveloperWindow = windowMode === 'developer';
  const [currentPage, setCurrentPage] = useState<PageId>('mymac');
  // Keep visited feature pages mounted so an in-flight run (clean, optimize, etc.)
  // survives navigation and keeps running in the background, and so multiple
  // features can run in parallel. Pages mount lazily on first visit and stay
  // mounted; only their visibility toggles.
  const [visitedPages, setVisitedPages] = useState<Set<PageId>>(() => new Set<PageId>(['mymac']));

  useEffect(() => {
    document.documentElement.classList.toggle('my-mac-effects', currentPage === 'mymac' || currentPage === 'analyze');

    return () => {
      document.documentElement.classList.remove('my-mac-effects');
    };
  }, [currentPage]);

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

  if (isLoginWindow) {
    return <LoginWindow />;
  }

  if (isSettingsWindow) {
    return (
      <SubscriptionProvider>
        <SettingsWindow />
      </SubscriptionProvider>
    );
  }

  if (isDeveloperWindow) {
    return <CliMonitorWindow />;
  }

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
          <main className="relative min-h-0 flex-1 overflow-hidden" aria-live="polite">
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
          </main>
        </div>
      </div>
      </PaywallProvider>
    </SubscriptionProvider>
  );
}

export default App;
