import { useState, useEffect } from 'react';
import { Toaster } from 'sonner';
import { cn } from '@/utils/cn';
import { Sidebar } from '@/components/layout/Sidebar';
import { HomePage } from '@/pages/HomePage';
import { MyMacPage } from '@/pages/MyMacPage';
import { CleanPage } from '@/pages/CleanPage';
import { UninstallPage } from '@/pages/UninstallPage';
import { OptimizePage } from '@/pages/OptimizePage';
import { AnalyzePage } from '@/pages/AnalyzePage';
import { hasSeenHomePage, markHomePageSeen } from '@/utils/storage';
import type { PageId } from '@/types';

// Page order for determining animation direction
const PAGE_ORDER: PageId[] = ['home', 'mymac', 'clean', 'uninstall', 'optimize', 'analyze'];

function App() {
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

  const renderPage = (pageId: PageId) => {
    const isActive = pageId === currentPage;
    const animationClass = isActive
      ? animationDirection === 'left'
        ? 'slide-in-right'
        : 'slide-in-left'
      : 'opacity-0 pointer-events-none';

    const pageContent = (() => {
      switch (pageId) {
        case 'home':
          return <HomePage onNavigate={handlePageChange} onSkipToHome={() => handlePageChange('mymac')} />;
        case 'mymac':
          return <MyMacPage onNavigate={handlePageChange} />;
        case 'clean':
          return <CleanPage />;
        case 'uninstall':
          return <UninstallPage />;
        case 'optimize':
          return <OptimizePage />;
        case 'analyze':
          return <AnalyzePage />;
        default:
          return <HomePage onNavigate={handlePageChange} onSkipToHome={() => handlePageChange('mymac')} />;
      }
    })();

    return (
      <div
        key={pageId}
        aria-hidden={!isActive}
        className={`absolute inset-0 ${animationClass}`}
      >
        {pageContent}
      </div>
    );
  };

  if (!isInitialized) {
    return (
      <div className="min-h-screen h-full flex items-center justify-center bg-bg-primary">
        <div className="w-8 h-8 border-4 border-accent-primary/30 border-t-accent-primary rounded-full animate-spin" />
      </div>
    );
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
      <div className="h-screen overflow-hidden p-2">
        <div className="flex h-full w-full flex-col overflow-hidden">
          <main className={cn('relative min-h-0 flex-1 overflow-hidden', currentPage === 'home' && 'h-full')} aria-live="polite">
            {PAGE_ORDER.map((pageId) => renderPage(pageId))}
          </main>
          {currentPage !== 'home' && (
            <Sidebar
              currentPage={currentPage}
              onPageChange={handlePageChange}
            />
          )}
        </div>
      </div>
    </>
  );
}

export default App;
