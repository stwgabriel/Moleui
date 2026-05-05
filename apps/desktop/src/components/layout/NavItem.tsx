import * as Icons from 'lucide-react';
import { cn } from '@/utils/cn';
import type { PageId } from '@/types';

interface NavItemProps {
  page: PageId;
  icon: keyof typeof Icons;
  label: string;
  isActive: boolean;
  isExpanded: boolean;
  onClick: () => void;
}

export function NavItem({ icon, label, isActive, isExpanded, onClick }: NavItemProps) {
  // Dynamically get the icon component
  const IconComponent = Icons[icon] as Icons.LucideIcon;

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center rounded-lg transition-all duration-200 ease-smooth relative group',
        isExpanded ? 'gap-3 px-3 py-2.5' : 'justify-center px-3 py-2.5',
        'hover:bg-accent-primary/8',
        isActive && 'bg-accent-primary/12 text-accent-primary',
        !isActive && 'text-text-secondary hover:text-text-primary'
      )}
      title={!isExpanded ? label : undefined}
    >
      {/* Active indicator - left side */}
      {isActive && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-accent-primary rounded-r-full" />
      )}
      
      {IconComponent && (
        <IconComponent 
          className={cn(
            'w-5 h-5 flex-shrink-0 transition-transform duration-200',
            'group-hover:scale-110'
          )} 
        />
      )}
      
      {isExpanded && (
        <span
          className={cn(
            'font-medium text-sm transition-all duration-300 whitespace-nowrap',
            isExpanded ? 'opacity-100' : 'opacity-0 w-0'
          )}
        >
          {label}
        </span>
      )}
    </button>
  );
}
