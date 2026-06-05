import {
  Activity,
  BarChart3,
  Gauge,
  PackageX,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import type { CSSProperties } from 'react';
import { cn } from '@/utils/cn';
import { UserAvatar } from '@/components/account/UserAvatar';
import { FEATURE_ACCENTS } from '@/lib/featureAccents';
import type { PageId } from '@/types';

interface SidebarProps {
  currentPage: PageId;
  onPageChange: (page: PageId) => void;
}

const NAV_ITEMS: Array<{
  page: PageId;
  icon: LucideIcon;
  label: string;
}> = [
  { page: 'mymac', icon: Activity, label: 'My Mac' },
  { page: 'clean', icon: Sparkles, label: 'Cleanup' },
  { page: 'optimize', icon: Gauge, label: 'Optimize' },
  { page: 'uninstall', icon: PackageX, label: 'Uninstall' },
  { page: 'analyze', icon: BarChart3, label: 'Storage' },
];

export function Sidebar({ currentPage, onPageChange }: SidebarProps) {
  const handleSettingsClick = () => {
    if (window.moleDesktop?.openSettingsWindow) {
      void window.moleDesktop.openSettingsWindow();
      return;
    }

    window.open('?window=settings', 'moleui-settings', 'width=520,height=620');
  };

  return (
    <aside
      className="relative z-20 flex h-full w-[180px] shrink-0 flex-col overflow-hidden border-r border-white/55 bg-white/[0.26] px-3 pb-5 pt-7 backdrop-blur-[32px]"
      aria-label="Main navigation"
    >
      <div className="mt-[clamp(3.35rem,5.8vh,4.25rem)] flex justify-center">
        <div className="flex h-[80px] w-[80px] items-center justify-center overflow-visible shadow-sm rounded-full">
          <img src="./assets/images/rounded-logo.png" alt="Moleui" className="h-full w-full  object-contain object-center" draggable={false} />
        </div>
      </div>

      <nav className="mt-[clamp(1.65rem,4.3vh,3.4rem)] flex flex-1 flex-col items-center gap-[clamp(0.75rem,2.4vh,1.8rem)]">
        {NAV_ITEMS.map(({ page, icon, label }) => {
          const Icon = icon;
          const isActive = currentPage === page;
          const accent = FEATURE_ACCENTS[page as keyof typeof FEATURE_ACCENTS];
          const accentStyle = {
            '--nav-accent': accent.accent,
            '--nav-accent-rgb': accent.rgb,
          } as CSSProperties;

          return (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              style={accentStyle}
              className={cn(
                'group flex w-[116px] flex-col items-center justify-center gap-2.5 rounded-[1.35rem] py-[clamp(0.6rem,1.25vh,0.8rem)] text-center transition-all duration-300 active:scale-[0.98]',
                isActive
                  ? 'bg-[rgba(var(--nav-accent-rgb),0.13)] text-[var(--nav-accent)] shadow-[0_16px_45px_rgba(var(--nav-accent-rgb),0.18)] ring-1 ring-[rgba(var(--nav-accent-rgb),0.35)]'
                  : 'text-slate-500 hover:bg-[rgba(var(--nav-accent-rgb),0.08)] hover:text-slate-700'
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
          onClick={handleSettingsClick}
          className="group mt-auto flex w-[116px] flex-col items-center justify-center gap-2.5 rounded-[1.35rem] py-[clamp(0.6rem,1.25vh,0.8rem)] text-center text-slate-500 transition-all duration-300 hover:bg-[#f0edff]/80 hover:text-slate-700 active:scale-[0.98]"
          aria-label="Open account settings"
        >
          <UserAvatar className="h-10 w-10 transition-transform duration-300 group-hover:scale-105" />
          <span className="text-[0.95rem] font-semibold leading-none tracking-[-0.02em]">Account</span>
        </button>
      </nav>
    </aside>
  );
}
