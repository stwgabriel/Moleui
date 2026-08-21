import { motion, useReducedMotion } from 'motion/react';
import { FolderPlus, GitBranch, Loader2, RefreshCw, ShieldCheck, X } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Button } from '@/components/ui/Button';
import { BODY_TEXT, FOCUS_RING, PAGE_TITLE, SECTION_LABEL } from './chrome';

export type ReposView = 'safety' | 'plan';

const VIEWS: Array<{ id: ReposView; label: string }> = [
  { id: 'safety', label: 'Repositories' },
  { id: 'plan', label: 'Layout plan' },
];

interface ReposHeaderProps {
  roots: string[];
  loading: boolean;
  verifying: boolean;
  onAddRoot: () => void;
  onRemoveRoot: (root: string) => void;
  onRescan: () => void;
  onCheckRemotes: () => void;
  onStop: () => void;
}

export function ReposHeader({
  roots,
  loading,
  verifying,
  onAddRoot,
  onRemoveRoot,
  onRescan,
  onCheckRemotes,
  onStop,
}: ReposHeaderProps) {
  return (
    <header className="shrink-0 px-5 pt-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className={cn('flex items-center gap-2.5', PAGE_TITLE)}>
            <span
              className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[rgba(var(--page-accent-rgb),0.14)] text-[var(--page-accent)]"
              aria-hidden="true"
            >
              <GitBranch className="h-5 w-5" />
            </span>
            Repos
          </h1>
          <p className={cn('mt-1.5 max-w-2xl text-[0.9rem]', BODY_TEXT)}>
            Every repository on this machine, and whether its work exists anywhere else.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {loading ? (
            <Button variant="glass" size="sm" icon={X} onClick={onStop}>
              Stop
            </Button>
          ) : (
            <>
              <Button variant="glass" size="sm" icon={RefreshCw} onClick={onRescan}>
                Rescan
              </Button>
              <Button
                variant="glass"
                size="sm"
                icon={ShieldCheck}
                onClick={onCheckRemotes}
                className="text-[var(--page-accent)] ring-1 ring-[rgba(var(--page-accent-rgb),0.35)]"
              >
                Check remotes
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className={SECTION_LABEL}>Scanning</span>
        {roots.map((root) => (
          <span
            key={root}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/60 bg-white/45 py-1 pl-3 pr-1.5 text-xs font-semibold text-slate-600 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/40 dark:text-slate-300"
          >
            <span className="max-w-[22rem] truncate" title={root}>
              {root}
            </span>
            {roots.length > 1 && (
              <button
                type="button"
                onClick={() => onRemoveRoot(root)}
                aria-label={`Stop scanning ${root}`}
                className={cn('rounded-full p-0.5 hover:bg-white/80 hover:text-slate-900 dark:hover:bg-slate-800', FOCUS_RING)}
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            )}
          </span>
        ))}
        <button
          type="button"
          onClick={onAddRoot}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border border-dashed border-white/70 px-3 py-1 text-xs font-semibold text-slate-500 transition-colors hover:border-[var(--page-accent)] hover:text-slate-900 dark:border-white/15 dark:text-slate-400 dark:hover:text-slate-100',
            FOCUS_RING
          )}
        >
          <FolderPlus className="h-3 w-3" aria-hidden="true" />
          Add folder
        </button>
      </div>

      {loading && (
        <p className={cn('mt-3 flex items-center gap-2 text-[0.85rem]', BODY_TEXT)}>
          <Loader2 className="h-4 w-4 animate-spin text-[var(--page-accent)]" aria-hidden="true" />
          {verifying
            ? 'Contacting every remote and matching each branch and tag against it. This can take a few minutes.'
            : 'Scanning for repositories.'}
        </p>
      )}
    </header>
  );
}

/** Panel id a tab controls, so the pair can point at each other. */
export function viewPanelId(view: ReposView) {
  return `repos-view-panel-${view}`;
}

export function ViewSwitcher({
  view,
  onChange,
  planCount,
}: {
  view: ReposView;
  onChange: (view: ReposView) => void;
  planCount: number;
}) {
  const reduce = useReducedMotion() ?? false;
  const enabled = VIEWS.filter((entry) => !(entry.id === 'plan' && planCount === 0));

  // A tablist is one tab stop, with the arrows moving between tabs. Separate
  // stops would be a segmented control wearing tablist semantics.
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const index = enabled.findIndex((entry) => entry.id === view);
    if (index === -1) return;
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      const next = event.key === 'ArrowRight' ? index + 1 : index - 1;
      const target = enabled[(next + enabled.length) % enabled.length];
      onChange(target.id);
    }
    if (event.key === 'Home') {
      event.preventDefault();
      onChange(enabled[0].id);
    }
    if (event.key === 'End') {
      event.preventDefault();
      onChange(enabled[enabled.length - 1].id);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <div
        role="tablist"
        aria-label="Repository view"
        onKeyDown={onKeyDown}
        className="inline-flex items-center gap-1 rounded-full border border-white/60 bg-white/40 p-1 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/40"
      >
      {VIEWS.map((entry) => {
        const selected = view === entry.id;
        const disabled = entry.id === 'plan' && planCount === 0;
        return (
          <button
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={viewPanelId(entry.id)}
            tabIndex={selected ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(entry.id)}
            className={cn(
              'relative rounded-full px-3.5 py-1.5 text-[0.8rem] font-bold transition-colors disabled:opacity-40',
              FOCUS_RING,
              selected ? 'text-[var(--page-accent)]' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'
            )}
          >
            {selected &&
              // The shared highlight carries no backdrop-filter and no glass
              // descendant: animating a layer that does re-rasterizes every
              // frosted surface under it. Dropped entirely when motion is reduced.
              (reduce ? (
                <span
                  aria-hidden="true"
                  className="absolute inset-0 rounded-full bg-[rgba(var(--page-accent-rgb),0.14)] ring-1 ring-[rgba(var(--page-accent-rgb),0.35)]"
                />
              ) : (
                <motion.span
                  layoutId="repos-view-tab"
                  aria-hidden="true"
                  className="absolute inset-0 rounded-full bg-[rgba(var(--page-accent-rgb),0.14)] ring-1 ring-[rgba(var(--page-accent-rgb),0.35)]"
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                />
              ))}
            <span className="relative">{entry.label}</span>
          </button>
        );
      })}
      </div>

      {/* The reason a tab is unavailable has to be readable. On a disabled button a
          tooltip is a reason nobody can reach. */}
      {planCount === 0 && (
        <span className="text-[0.72rem] font-semibold text-slate-400 dark:text-slate-500">
          No layout suggestions from the last scan.
        </span>
      )}
    </div>
  );
}
