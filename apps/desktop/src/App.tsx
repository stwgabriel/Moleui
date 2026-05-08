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
import { StatusPage } from '@/pages/StatusPage';
import { hasSeenHomePage, markHomePageSeen } from '@/utils/storage';
import type { PageId } from '@/types';

// Page order for determining animation direction
const PAGE_ORDER: PageId[] = ['home', 'mymac', 'clean', 'uninstall', 'optimize', 'analyze', 'status'];

function App() {
  const [currentPage, setCurrentPage] = useState<PageId>('home');
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const [animationDirection, setAnimationDirection] = useState<'up' | 'down'>('down');
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

  const handlePageChange = async (newPage: PageId) => {
    if (newPage === currentPage) return;
    
    const currentIndex = PAGE_ORDER.indexOf(currentPage);
    const newIndex = PAGE_ORDER.indexOf(newPage);
    
    // Determine animation direction based on page order
    setAnimationDirection(newIndex > currentIndex ? 'down' : 'up');
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
      ? animationDirection === 'down'
        ? 'slide-in-up'
        : 'slide-in-down'
      : 'opacity-0 pointer-events-none';

    const pageContent = (() => {
      switch (pageId) {
        case 'home':
          return <HomePage onNavigate={handlePageChange} onSkipToHome={() => handlePageChange('mymac')} />;
        case 'mymac':
          return (
            <MyMacPage
              onNavigate={handlePageChange}
              isSidebarExpanded={isSidebarExpanded}
              onExpandSidebar={() => setIsSidebarExpanded(true)}
            />
          );
        case 'clean':
          return <CleanPage />;
        case 'uninstall':
          return <UninstallPage />;
        case 'optimize':
          return <OptimizePage />;
        case 'analyze':
          return <AnalyzePage />;
        case 'status':
          return <StatusPage />;
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
      <div className="min-h-screen h-full p-2 overflow-hidden flex">
      <div className={cn(
        'w-full items-stretch',
        currentPage === 'home'
          ? 'flex'
          : 'grid grid-cols-[auto_minmax(0,1fr)] gap-3'
      )}>
          {currentPage !== 'home' && (
            <Sidebar 
              currentPage={currentPage} 
              onPageChange={handlePageChange}
              onCollapseChange={setIsSidebarExpanded}
              isExpanded={isSidebarExpanded}
            />
          )}
          <main className={cn('overflow-hidden relative', currentPage === 'home' && 'flex-1')} aria-live="polite">
            {PAGE_ORDER.map((pageId) => renderPage(pageId))}
          </main>
        </div>
      </div>
    </>
  );
}

export default App;
