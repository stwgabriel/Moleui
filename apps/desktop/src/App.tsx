import { lazy, Suspense, useEffect, useState } from 'react';
import { Toaster } from 'sonner';
import { cn } from '@/utils/cn';
import { Sidebar } from '@/components/layout/Sidebar';
import { SettingsWindow } from '@/components/settings/SettingsWindow';
import { HomePage } from '@/pages/HomePage';
import { MyMacPage } from '@/pages/MyMacPage';
import { hasSeenHomePage, markHomePageSeen } from '@/utils/storage';
import type { PageId } from '@/types';

// Page order for determining animation direction
const PAGE_ORDER: PageId[] = ['home', 'mymac', 'clean', 'optimize', 'uninstall', 'analyze'];

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
  const isSettingsWindow = new URLSearchParams(window.location.search).get('window') === 'settings';
  const [currentPage, setCurrentPage] = useState<PageId>('home');
  const [animationDirection, setAnimationDirection] = useState<'left' | 'right'>('left');
  const [isInitialized, setIsInitialized] = useState(false);

  // Check IndexedDB on startup to determine initial page
  useEffect(() => {
    async function initPage() {
      try {
        const hasSeen = await hasSeenHomePage();
        if (hasSeen) {
          setCurrentPage('mymac');
        }
      } catch (error) {
        console.error('Failed to check home page state:', error);
      } finally {
        setIsInitialized(true);
      }
    }
    initPage();
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('my-mac-effects', currentPage === 'mymac' || currentPage === 'analyze');

    return () => {
      document.documentElement.classList.remove('my-mac-effects');
    };
  }, [currentPage]);

  const handlePageChange = async (newPage: PageId) => {
    if (newPage === currentPage) return;

    const currentIndex = PAGE_ORDER.indexOf(currentPage);
    const newIndex = PAGE_ORDER.indexOf(newPage);

    // Determine animation direction based on page order
    setAnimationDirection(newIndex > currentIndex ? 'left' : 'right');
    setCurrentPage(newPage);

    // Mark home page as seen if navigating away from home
    if (currentPage === 'home') {
      try {
        await markHomePageSeen();
      } catch (error) {
        console.error('Failed to mark home page as seen:', error);
      }
    }
  };

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'home':
        return <HomePage onNavigate={handlePageChange} onSkipToHome={() => handlePageChange('mymac')} />;
      case 'mymac':
        return <MyMacPage onNavigate={handlePageChange} />;
      case 'clean':
        return <CleanPage />;
      case 'optimize':
        return <OptimizePage />;
      case 'uninstall':
        return <UninstallPage />;
      case 'analyze':
        return <AnalyzePage />;
      default:
        return <HomePage onNavigate={handlePageChange} onSkipToHome={() => handlePageChange('mymac')} />;
    }
  };

  const isLoading = !isInitialized;

  if (isSettingsWindow) {
    return <SettingsWindow />;
  }

  return (
    <>
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
      <div className="relative h-screen overflow-hidden" aria-busy={isLoading}>
        <div
          className={cn(
            'h-full w-full overflow-hidden rounded-[1rem] border border-white/55 bg-white/[0.22] shadow-[0_30px_90px_rgba(109,93,252,0.16),inset_0_1px_1px_rgba(255,255,255,0.78)] backdrop-blur-[28px] transition-opacity duration-300',
            isLoading && 'pointer-events-none opacity-0',
            currentPage !== 'home' && 'flex'
          )}
        >
          {currentPage !== 'home' && (
            <Sidebar
              currentPage={currentPage}
              onPageChange={handlePageChange}
            />
          )}
          <main className={cn('relative min-h-0 flex-1 overflow-hidden', currentPage === 'home' && 'h-full')} aria-live="polite">
            <div
              key={currentPage}
              className={cn(
                'absolute inset-0',
                animationDirection === 'left' ? 'slide-in-right' : 'slide-in-left'
              )}
            >
              <Suspense fallback={<PageLoadingFallback />}>
                {renderCurrentPage()}
              </Suspense>
            </div>
          </main>
        </div>
        {isLoading && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[linear-gradient(135deg,var(--color-bg-primary)_0%,var(--color-bg-secondary)_100%)]" role="status" aria-label="Loading Moleui">
            <div className="relative flex h-28 w-28 items-center justify-center">
              <div className="absolute inset-0 rounded-full border-[5px] border-violet-300/30 border-t-violet-600 shadow-[0_0_55px_rgba(109,93,252,0.28)] animate-spin" />
              <div className="flex h-24 w-24 items-center justify-center rounded-[2rem]">
                <img src="./assets/images/rounded-logo.png" alt="Moleui" className="h-24 w-24 object-contain" draggable={false} />
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default App;
