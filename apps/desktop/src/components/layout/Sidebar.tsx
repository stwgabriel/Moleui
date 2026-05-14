import { useEffect, useRef, useState, type CSSProperties } from 'react';
import * as Icons from 'lucide-react';
import { cn } from '@/utils/cn';
import type { PageId } from '@/types';

interface SidebarProps {
  currentPage: PageId;
  onPageChange: (page: PageId) => void;
}

const NAV_ITEMS: Array<{
  page: PageId;
  icon: keyof typeof Icons;
  label: string;
  activeClassName: string;
}> = [
    { page: 'mymac', icon: 'Computer', label: 'Mac', activeClassName: 'text-cyan-500 dark:text-cyan-300' },
    { page: 'clean', icon: 'Trash2', label: 'Clean', activeClassName: 'text-blue-500 dark:text-blue-300' },
    { page: 'uninstall', icon: 'PackageX', label: 'Uninstall', activeClassName: 'text-rose-500 dark:text-rose-300' },
    { page: 'optimize', icon: 'Zap', label: 'Optimize', activeClassName: 'text-violet-500 dark:text-violet-300' },
    { page: 'analyze', icon: 'PieChart', label: 'Analyze', activeClassName: 'text-pink-500 dark:text-pink-300' },
  ];

const GITHUB_REPO_URL = 'https://github.com/stwgabriel/moleui';
const GITHUB_FUNDING_URL = 'https://github.com/sponsors/stwgabriel';

const LIQUID_GLASS = cn(
  'border border-white/55 bg-white/[0.34] backdrop-blur-[34px] saturate-[1.9]',
  'shadow-[0_24px_80px_rgba(20,30,41,0.18),inset_0_1px_1px_rgba(255,255,255,0.92),inset_0_-18px_36px_rgba(255,255,255,0.16)]',
  'before:pointer-events-none before:absolute before:inset-x-5 before:top-1 before:h-1/2 before:rounded-full before:bg-white/36 before:blur-xl before:content-[""]',
  'after:pointer-events-none after:absolute after:-left-12 after:-top-16 after:h-28 after:w-44 after:rounded-full after:bg-white/34 after:blur-3xl after:content-[""]',
  'dark:border-white/14 dark:bg-white/[0.11] dark:shadow-[0_24px_80px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.18),inset_0_-18px_36px_rgba(255,255,255,0.06)]'
);

export function Sidebar({ currentPage, onPageChange }: SidebarProps) {
  const activeIndex = Math.max(NAV_ITEMS.findIndex((item) => item.page === currentPage), 0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isMenuOpen) return;

    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [isMenuOpen]);

  const openExternal = async (url: string) => {
    setIsMenuOpen(false);
    const result = await window.moleDesktop?.openExternal(url);
    if (!result?.ok) {
      console.error(result?.message || 'Failed to open external link');
    }
  };

  return (
    <aside
      className="relative z-20 shrink-0 px-3 pb-3 pt-2 bg-transparent"
      aria-label="Main navigation"
    >
      <div className="mx-auto flex w-full max-w-[438px] items-end justify-center gap-2">
        <nav
          className={cn(
            'relative isolate grid h-[58px] min-w-0 flex-1 overflow-hidden rounded-full p-1.5',
            LIQUID_GLASS
          )}
          style={{
            gridTemplateColumns: `repeat(${NAV_ITEMS.length}, minmax(0, 1fr))`,
            '--active-index': activeIndex,
            '--item-count': NAV_ITEMS.length,
          } as CSSProperties}
        >
          <div
            className={cn(
              'absolute left-1.5 top-1.5 h-[calc(100%-0.75rem)] rounded-full border border-white/65 bg-white/58',
              'shadow-[0_10px_28px_rgba(20,30,41,0.14),inset_0_1px_1px_rgba(255,255,255,0.95),inset_0_-10px_22px_rgba(20,30,41,0.06)]',
              'transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]',
              'dark:border-white/14 dark:bg-white/18 dark:shadow-[0_10px_28px_rgba(0,0,0,0.38),inset_0_1px_1px_rgba(255,255,255,0.2)]'
            )}
            style={{
              width: `calc((100% - 0.75rem) / var(--item-count))`,
              transform: `translateX(calc(var(--active-index) * 100%))`,
            }}
            aria-hidden="true"
          />

          {NAV_ITEMS.map(({ page, icon, label, activeClassName }) => {
            const Icon = Icons[icon] as Icons.LucideIcon;
            const isActive = currentPage === page;

            return (
              <button
                key={page}
                onClick={() => {
                  setIsMenuOpen(false);
                  onPageChange(page);
                }}
                className={cn(
                  'relative z-10 flex min-w-0 items-center justify-center rounded-full',
                  'transition-colors duration-300 ease-smooth active:scale-[0.98]',
                  isActive ? activeClassName : 'text-text-secondary hover:text-text-primary dark:text-white/58 dark:hover:text-white/88'
                )}
                aria-current={isActive ? 'page' : undefined}
                aria-label={label}
                title={label}
              >
                <Icon
                  className={cn(
                    'h-5 w-5 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]',
                    isActive ? 'scale-110 drop-shadow-[0_4px_10px_rgba(255,255,255,0.38)]' : 'scale-100'
                  )}
                  strokeWidth={isActive ? 2.4 : 2}
                />
              </button>
            );
          })}
        </nav>

        <div className="relative shrink-0" ref={menuRef}>
          <button
            className={cn(
              'relative isolate flex h-[58px] w-[58px] items-center justify-center overflow-hidden rounded-full',
              LIQUID_GLASS,
              'transition-transform duration-300 hover:scale-[1.03] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/70'
            )}
            aria-label="Open menu"
            aria-expanded={isMenuOpen}
            onClick={() => setIsMenuOpen(open => !open)}
          >
            <Icons.UserCircle className="relative z-10 h-6 w-6 text-slate-800 dark:text-white/88" aria-hidden="true" />
          </button>

          {isMenuOpen && (
            <div className="absolute bottom-full right-0 z-30 mb-3 w-52 overflow-hidden rounded-[1.65rem] border border-white/55 bg-white/48 p-2 shadow-[0_24px_80px_rgba(20,30,41,0.22),inset_0_1px_1px_rgba(255,255,255,0.8)] backdrop-blur-[34px] saturate-[1.8] dark:border-white/14 dark:bg-slate-950/42">
              <button
                className="flex w-full items-center gap-3 rounded-[1.15rem] px-3 py-2.5 text-left text-sm font-semibold text-slate-800 transition-colors hover:bg-white/48 dark:text-white/88 dark:hover:bg-white/10"
                onClick={() => {
                  setIsMenuOpen(false);
                  setIsSettingsModalOpen(true);
                }}
              >
                <Icons.Settings className="h-4 w-4 text-slate-500 dark:text-white/58" aria-hidden="true" />
                Settings
              </button>
              <button
                className="flex w-full items-center gap-3 rounded-[1.15rem] px-3 py-2.5 text-left text-sm font-semibold text-slate-800 transition-colors hover:bg-white/48 dark:text-white/88 dark:hover:bg-white/10"
                onClick={() => openExternal(GITHUB_REPO_URL)}
              >
                <Icons.Github className="h-4 w-4 text-slate-500 dark:text-white/58" aria-hidden="true" />
                GitHub
              </button>
              <button
                className="flex w-full items-center gap-3 rounded-[1.15rem] px-3 py-2.5 text-left text-sm font-semibold text-slate-800 transition-colors hover:bg-white/48 dark:text-white/88 dark:hover:bg-white/10"
                onClick={() => openExternal(GITHUB_FUNDING_URL)}
              >
                <Icons.Heart className="h-4 w-4 text-slate-500 dark:text-white/58" aria-hidden="true" />
                Donate
              </button>
            </div>
          )}
        </div>
      </div>

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
                <Icons.X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div className="mt-8 min-h-32 rounded-2xl border border-dashed border-slate-300/80 bg-white/20 dark:border-white/14 dark:bg-white/5" />
          </div>
        </div>
      )}
    </aside>
  );
}
