import { useState } from 'react';
import {
  Activity,
  BarChart3,
  Gauge,
  PackageX,
  Settings,
  Sparkles,
  X,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import type { PageId } from '@/types';

interface SidebarProps {
  currentPage: PageId;
  onPageChange: (page: PageId) => void;
}

const NAV_ITEMS: Array<{
  page: PageId;
  icon: LucideIcon;
  label: string;
  activeClassName: string;
}> = [
  { page: 'mymac', icon: Activity, label: 'My Mac', activeClassName: 'text-violet-600' },
  { page: 'clean', icon: Sparkles, label: 'Clean', activeClassName: 'text-violet-600' },
  { page: 'optimize', icon: Gauge, label: 'Performance', activeClassName: 'text-violet-600' },
  { page: 'uninstall', icon: PackageX, label: 'Uninstall', activeClassName: 'text-violet-600' },
  { page: 'analyze', icon: BarChart3, label: 'Analyze', activeClassName: 'text-violet-600' },
];

export function Sidebar({ currentPage, onPageChange }: SidebarProps) {
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  return (
    <aside
      className="relative z-20 flex h-full w-[180px] shrink-0 flex-col overflow-hidden border-r border-white/55 bg-white/[0.26] px-3 pb-5 pt-7 backdrop-blur-[32px]"
      aria-label="Main navigation"
    >
      <div className="mt-[clamp(3.35rem,5.8vh,4.25rem)] flex justify-center">
        <div className="flex h-[100px] w-[100px] items-center justify-center overflow-visible">
          <img src="./assets/images/rounded-logo.png" alt="Moleui" className="h-full w-full object-contain object-center" draggable={false} />
        </div>
      </div>

      <nav className="mt-[clamp(1.65rem,4.3vh,3.4rem)] flex flex-1 flex-col items-center gap-[clamp(0.75rem,2.4vh,1.8rem)]">
        {NAV_ITEMS.map(({ page, icon, label, activeClassName }) => {
          const Icon = icon;
          const isActive = currentPage === page;

          return (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              className={cn(
                'group flex w-[116px] flex-col items-center justify-center gap-2.5 rounded-[1.35rem] py-[clamp(0.6rem,1.25vh,0.8rem)] text-center transition-all duration-300 active:scale-[0.98]',
                isActive
                  ? `bg-[#e2dcff]/95 ${activeClassName} shadow-[0_16px_45px_rgba(117,90,255,0.18)] ring-1 ring-violet-300/40`
                  : 'text-slate-500 hover:bg-[#f0edff]/80 hover:text-slate-700'
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon
                className="h-6 w-6 transition-transform duration-300 group-hover:scale-105"
                strokeWidth={isActive ? 2.2 : 1.9}
                aria-hidden="true"
              />
              <span className="text-[0.95rem] font-semibold leading-none tracking-[-0.02em]">{label}</span>
            </button>
          );
        })}

        <button
          onClick={() => setIsSettingsModalOpen(true)}
          className="group mt-auto flex w-[116px] flex-col items-center justify-center gap-2.5 rounded-[1.35rem] py-[clamp(0.6rem,1.25vh,0.8rem)] text-center text-slate-500 transition-all duration-300 hover:bg-[#f0edff]/80 hover:text-slate-700 active:scale-[0.98]"
        >
          <Settings className="h-6 w-6 transition-transform duration-300 group-hover:scale-105" strokeWidth={1.9} aria-hidden="true" />
          <span className="text-[0.95rem] font-semibold leading-none tracking-[-0.02em]">Settings</span>
        </button>
      </nav>

      {isSettingsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/24 p-6 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[2rem] border border-white/60 bg-white/70 p-6 shadow-[0_30px_90px_rgba(20,30,41,0.24),inset_0_1px_1px_rgba(255,255,255,0.85)] backdrop-blur-[30px] dark:border-white/14 dark:bg-slate-950/70">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-950 dark:text-white">Settings</h2>
              <button
                className="rounded-full p-2 text-slate-500 transition-colors hover:bg-white/50 hover:text-slate-900 dark:text-white/58 dark:hover:bg-white/10 dark:hover:text-white"
                aria-label="Close settings"
                onClick={() => setIsSettingsModalOpen(false)}
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div className="mt-8 min-h-32 rounded-2xl border border-dashed border-slate-300/80 bg-white/20 dark:border-white/14 dark:bg-white/5" />
          </div>
        </div>
      )}
    </aside>
  );
}
