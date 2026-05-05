import { useEffect, useState } from 'react';
import { PanelLeftClose } from 'lucide-react';
import { NavItem } from './NavItem';
import { cn } from '@/utils/cn';
import type { PageId } from '@/types';

interface SidebarProps {
  currentPage: PageId;
  onPageChange: (page: PageId) => void;
  onCollapseChange?: (isExpanded: boolean) => void;
  isExpanded?: boolean;
}

export function Sidebar({ currentPage, onPageChange, onCollapseChange, isExpanded: controlledExpanded }: SidebarProps) {
  const [internalExpanded, setInternalExpanded] = useState(true);
  const isExpanded = controlledExpanded ?? internalExpanded;

  useEffect(() => {
    if (controlledExpanded !== undefined) {
      setInternalExpanded(controlledExpanded);
    }
  }, [controlledExpanded]);

  const toggleSidebar = () => {
    const newState = !isExpanded;
    setInternalExpanded(newState);
    onCollapseChange?.(newState);
  };

  return (
    <aside
      className={cn(
        'glass-surface rounded-[20px] transition-all duration-300 ease-smooth flex flex-col relative',
        isExpanded ? 'w-[240px] p-4' : 'w-[72px] p-3'
      )}
      aria-label="Sidebar"
    >
      {/* Collapse Button - Top Right (only visible when expanded) */}
      {isExpanded && (
        <div className="flex justify-end mb-3">
          <button
            onClick={toggleSidebar}
            className={cn(
              'p-2 rounded-lg hover:bg-surface-hover transition-all duration-fast',
              'hover:scale-105 active:scale-95'
            )}
            aria-expanded={isExpanded}
            aria-label="Collapse sidebar"
          >
            <PanelLeftClose className="w-5 h-5 text-text-secondary" />
          </button>
        </div>
      )}

      {/* Navigation - Centered Vertically */}
      <nav className="flex-1 flex flex-col justify-center space-y-2" aria-label="Main navigation">
        <NavItem
          page="smartcare"
          icon="Sparkles"
          label="Smart Care"
          isActive={currentPage === 'smartcare'}
          isExpanded={isExpanded}
          onClick={() => onPageChange('smartcare')}
        />
        <NavItem
          page="clean"
          icon="Trash2"
          label="Clean"
          isActive={currentPage === 'clean'}
          isExpanded={isExpanded}
          onClick={() => onPageChange('clean')}
        />
        <NavItem
          page="uninstall"
          icon="PackageX"
          label="Uninstall"
          isActive={currentPage === 'uninstall'}
          isExpanded={isExpanded}
          onClick={() => onPageChange('uninstall')}
        />
        <NavItem
          page="optimize"
          icon="Zap"
          label="Optimize"
          isActive={currentPage === 'optimize'}
          isExpanded={isExpanded}
          onClick={() => onPageChange('optimize')}
        />
        <NavItem
          page="analyze"
          icon="PieChart"
          label="Analyze"
          isActive={currentPage === 'analyze'}
          isExpanded={isExpanded}
          onClick={() => onPageChange('analyze')}
        />
        <NavItem
          page="status"
          icon="Activity"
          label="Status"
          isActive={currentPage === 'status'}
          isExpanded={isExpanded}
          onClick={() => onPageChange('status')}
        />
      </nav>

      {/* Footer */}
      <footer className="mt-3 pt-3 border-t border-white/10">
        <div
          className={cn(
            'text-xs text-text-tertiary transition-all duration-300 text-center',
            isExpanded ? 'opacity-100' : 'opacity-0'
          )}
        >
          Moleui
        </div>
      </footer>
    </aside>
  );
}
