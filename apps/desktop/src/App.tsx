import { useState, useEffect } from 'react';
import { PanelLeftOpen } from 'lucide-react';
import { Sidebar } from '@/components/layout/Sidebar';
import { SmartCarePage } from '@/pages/SmartCarePage';
import { CleanPage } from '@/pages/CleanPage';
import { UninstallPage } from '@/pages/UninstallPage';
import { OptimizePage } from '@/pages/OptimizePage';
import { AnalyzePage } from '@/pages/AnalyzePage';
import { StatusPage } from '@/pages/StatusPage';
import type { PageId } from '@/types';

// Page order for determining animation direction
const PAGE_ORDER: PageId[] = ['smartcare', 'clean', 'uninstall', 'optimize', 'analyze', 'status'];

function App() {
  const [currentPage, setCurrentPage] = useState<PageId>('smartcare');
  const [previousPage, setPreviousPage] = useState<PageId>('smartcare');
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const [animationDirection, setAnimationDirection] = useState<'up' | 'down'>('down');
  const [isAnimating, setIsAnimating] = useState(false);

  const handlePageChange = (newPage: PageId) => {
    if (newPage === currentPage) return;

    const currentIndex = PAGE_ORDER.indexOf(currentPage);
    const newIndex = PAGE_ORDER.indexOf(newPage);
    
    // Determine animation direction based on page order
    setAnimationDirection(newIndex > currentIndex ? 'down' : 'up');
    setPreviousPage(currentPage);
    setIsAnimating(true);
    setCurrentPage(newPage);
  };

  useEffect(() => {
    if (isAnimating) {
      // Reset animation state after animation completes
      const timer = setTimeout(() => {
        setIsAnimating(false);
      }, 400); // Match animation duration
      return () => clearTimeout(timer);
    }
  }, [isAnimating]);

  const renderPage = (pageId: PageId, isExiting: boolean = false) => {
    const animationClass = isExiting
      ? animationDirection === 'down'
        ? 'slide-out-up'
        : 'slide-out-down'
      : animationDirection === 'down'
      ? 'slide-in-up'
      : 'slide-in-down';

    const pageContent = (() => {
      switch (pageId) {
        case 'smartcare':
          return <SmartCarePage />;
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
          return <SmartCarePage />;
      }
    })();

    return (
      <div
        key={pageId}
        className={`absolute inset-0 ${animationClass}`}
      >
        {pageContent}
      </div>
    );
  };

  return (
    <>
      <div className="window-drag-region" aria-hidden="true" />
      <div className="min-h-screen h-full p-2 overflow-hidden flex">
        <div className="w-full grid grid-cols-[auto_minmax(0,1fr)] gap-3 items-stretch">
          <Sidebar 
            currentPage={currentPage} 
            onPageChange={handlePageChange}
            onCollapseChange={setIsSidebarExpanded}
            isExpanded={isSidebarExpanded}
          />
          <main className="overflow-hidden relative" aria-live="polite">
            {/* Floating expand button when sidebar is collapsed */}
            {!isSidebarExpanded && (
              <button
                onClick={() => setIsSidebarExpanded(true)}
                className="absolute top-4 left-4 z-10 p-2 rounded-lg glass-surface hover:bg-surface-hover transition-all duration-200 hover:scale-105 active:scale-95"
                aria-label="Expand sidebar"
              >
                <PanelLeftOpen className="w-5 h-5 text-text-secondary" />
              </button>
            )}
            {/* Render both pages during transition */}
            {isAnimating && renderPage(previousPage, true)}
            {renderPage(currentPage, false)}
          </main>
        </div>
      </div>
    </>
  );
}

export default App;
