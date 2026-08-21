import { Boxes, Cloud, LayoutGrid, PackageOpen, Plus, Sparkles, type LucideIcon } from 'lucide-react';
import { cn } from '@/utils/cn';
import { describeAction, describeSchedule, type AutomationTemplate } from '@/lib/automationCatalog';

const TEMPLATE_ICONS: Record<string, LucideIcon> = {
  Sparkles,
  Cloud,
  LayoutGrid,
  Boxes,
  PackageOpen,
};

interface MarketplaceCardProps {
  template: AutomationTemplate;
  added: boolean;
  /** True when a section this template names is not in the main process allowlist. */
  unavailable?: boolean;
  onAdd: (template: AutomationTemplate) => void;
}

export function MarketplaceCard({ template, added, unavailable = false, onAdd }: MarketplaceCardProps) {
  const Icon = TEMPLATE_ICONS[template.icon] ?? Sparkles;

  return (
    <article
      className="flex flex-col gap-3 rounded-[1.5rem] border border-white/60 bg-white/55 p-4 backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/40"
      aria-label={template.name}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[rgba(var(--page-accent-rgb),0.12)] text-[var(--page-accent)]">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[0.95rem] font-black tracking-[-0.02em] leading-tight text-slate-950 dark:text-slate-100">
            {template.name}
          </h3>
          <p className="mt-1 text-[0.8rem] leading-snug text-slate-500 dark:text-slate-400">{template.summary}</p>
        </div>
      </div>

      <dl className="grid grid-cols-1 gap-1 text-[0.75rem] text-slate-500 dark:text-slate-400">
        <div className="flex gap-1.5">
          <dt className="font-semibold text-slate-600 dark:text-slate-300">Targets</dt>
          <dd className="min-w-0 truncate">{describeAction(template.action)}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="font-semibold text-slate-600 dark:text-slate-300">Suggested</dt>
          <dd>{describeSchedule(template.schedule)}</dd>
        </div>
      </dl>

      <div className="mt-auto flex items-center justify-between gap-2 pt-1">
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-[0.7rem] font-semibold',
            template.risk === 'low'
              ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300'
              : 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
          )}
        >
          {template.risk === 'low' ? 'Low risk' : 'Review dry run'}
        </span>

        <button
          type="button"
          onClick={() => onAdd(template)}
          disabled={added || unavailable}
          className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(var(--page-accent-rgb),0.14)] px-3 py-1.5 text-[0.8rem] font-bold text-[var(--page-accent)] transition-colors duration-200 hover:bg-[rgba(var(--page-accent-rgb),0.22)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-50 dark:focus-visible:ring-offset-slate-900"
        >
          {!unavailable && <Plus className="h-3.5 w-3.5" aria-hidden="true" />}
          {unavailable ? 'Not available in this build' : added ? 'Added' : 'Add recipe'}
        </button>
      </div>
    </article>
  );
}
