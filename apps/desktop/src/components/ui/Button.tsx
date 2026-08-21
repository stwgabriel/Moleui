import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/utils/cn';
import { LucideIcon } from 'lucide-react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  // `glass` and `glass-danger` are the page-accent variants used by the surfaces
  // built on the frosted system (repos, automations, the uninstall confirmation).
  // They are additive on purpose: `primary` / `secondary` / `danger` / `ghost`
  // still carry the older token names that Clean, Optimize and Analyze rely on,
  // and restyling those would silently move five other pages.
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'glass' | 'glass-danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: LucideIcon;
  iconPosition?: 'left' | 'right';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      icon: Icon,
      iconPosition = 'left',
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    // ring-offset needs an explicit colour: without one the offset ring draws in
    // the default white, which reads as a halo on dark glass.
    const baseStyles =
      'inline-flex items-center justify-center gap-2 font-semibold rounded-md transition-all duration-fast ease-smooth focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none';

    const glassSurface =
      'rounded-full border border-white/60 bg-white/55 text-slate-600 shadow-[0_10px_30px_rgba(83,76,148,0.08)] backdrop-blur-xl hover:bg-white/80 hover:text-slate-900 dark:border-white/10 dark:bg-slate-900/55 dark:text-slate-300 dark:hover:bg-slate-800/80 dark:hover:text-slate-100 focus-visible:ring-[var(--page-accent)]';

    const variants = {
      primary:
        'bg-accent-primary text-white shadow-md hover:bg-accent-primary-hover hover:-translate-y-0.5 hover:shadow-accent active:translate-y-0',
      secondary:
        'bg-surface text-text-primary shadow-md hover:bg-surface-hover hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0',
      danger:
        'bg-accent-danger text-white shadow-md hover:bg-red-600 hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0',
      ghost:
        'bg-transparent text-text-secondary hover:bg-surface-hover hover:text-text-primary',
      glass: glassSurface,
      'glass-danger':
        'rounded-full bg-[var(--page-accent)] text-white shadow-[0_18px_40px_var(--page-accent-glow)] hover:bg-[var(--page-accent-hover)] focus-visible:ring-[var(--page-accent)] disabled:bg-slate-300 disabled:text-white/80 disabled:shadow-none dark:disabled:bg-slate-700',
    };

    const sizes = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-6 py-3 text-base',
      lg: 'px-8 py-4 text-lg',
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        disabled={disabled}
        {...props}
      >
        {Icon && iconPosition === 'left' && <Icon className="w-5 h-5" />}
        {children}
        {Icon && iconPosition === 'right' && <Icon className="w-5 h-5" />}
      </button>
    );
  }
);

Button.displayName = 'Button';
