import { AlertTriangle, Check, CircleDot, Pencil, Play, ShieldCheck, Trash2 } from 'lucide-react';
import { cn } from '@/utils/cn';
import { ACTION_KIND_LABELS, describeSchedule } from '@/lib/automationCatalog';
import type { AutomationRecipe } from '@/types';
import { EnableSwitch } from './switches';

// One recipe, as a full-width row.
//
// The previous card packed the schedule, the next run, the last run and the dry-run
// state into a 2x2 definition list at 0.75rem, which made the one thing the user
// wants to know (can this run, and when) the same size as everything else.
//
// The blocked reason is always rendered, never left in a `title` on the switch: a
// natively disabled control is out of the tab order, so a tooltip on it is a reason
// nobody can reach.

interface RecipeRowProps {
  recipe: AutomationRecipe;
  busy: boolean;
  paused: boolean;
  onToggleEnabled: (recipe: AutomationRecipe, enabled: boolean) => void;
  onDryRun: (recipe: AutomationRecipe) => void;
  onRunNow: (recipe: AutomationRecipe) => void;
  onEdit: (recipe: AutomationRecipe) => void;
  onDelete: (recipe: AutomationRecipe) => void;
}

function formatTimestamp(value: string | null): string {
  if (!value) return 'Never';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Never';
  return parsed.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

const ACTION_BUTTON =
  'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.78rem] font-bold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-50';

export function RecipeRow({
  recipe,
  busy,
  paused,
  onToggleEnabled,
  onDryRun,
  onRunNow,
  onEdit,
  onDelete,
}: RecipeRowProps) {
  const gateCleared = Boolean(recipe.dryRunPassedAt) && !recipe.invalid;
  const enableBlockedReason = recipe.invalid
    ? 'This recipe references actions that are no longer automatable. Edit or delete it.'
    : 'Run a dry run before enabling this recipe.';
  const headingId = `recipe-${recipe.id}-h`;
  const blockedId = `recipe-${recipe.id}-blocked`;

  const state = recipe.invalid
    ? { word: 'Not runnable', tone: 'text-red-500', Icon: AlertTriangle }
    : recipe.enabled
      ? paused
        ? { word: 'Enabled, paused', tone: 'text-slate-400', Icon: CircleDot }
        : { word: 'Enabled', tone: 'text-emerald-500', Icon: Check }
      : gateCleared
        ? { word: 'Off', tone: 'text-slate-400', Icon: CircleDot }
        : { word: 'Needs a dry run', tone: 'text-amber-500', Icon: ShieldCheck };

  return (
    <li
      aria-labelledby={headingId}
      className="relative overflow-hidden rounded-[1.5rem] border border-white/55 bg-white/40 p-4 backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/35"
    >
      {busy && (
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-0.5 animate-pulse bg-[var(--page-accent)]"
        />
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className={cn('mt-0.5 shrink-0', state.tone)} aria-hidden="true">
            <state.Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 id={headingId} className="text-[1rem] font-black tracking-[-0.03em] text-slate-950 dark:text-slate-100">
                {recipe.name}
              </h3>
              <span className="sr-only">{state.word}.</span>
              <span className="rounded-full bg-slate-500/10 px-2 py-0.5 text-[0.68rem] font-bold text-slate-600 dark:text-slate-300">
                {ACTION_KIND_LABELS[recipe.action.kind]}
              </span>
              {recipe.invalid && (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-500/12 px-2 py-0.5 text-[0.68rem] font-bold text-red-600 dark:text-red-400">
                  <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                  Not runnable
                </span>
              )}
            </div>

            {recipe.action.kind === 'clean' && recipe.action.sections.length > 0 && (
              <ul className="mt-1.5 flex flex-wrap gap-1">
                {recipe.action.sections.map((section) => (
                  <li
                    key={section}
                    className="rounded-full bg-[rgba(var(--page-accent-rgb),0.12)] px-2 py-0.5 text-[0.68rem] font-bold text-[var(--page-accent)]"
                  >
                    {section}
                  </li>
                ))}
              </ul>
            )}
            {recipe.action.kind === 'installer' && (
              <p className="mt-1.5 text-[0.78rem] font-semibold text-slate-500 dark:text-slate-400">
                Installer files already run
              </p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <dl className="hidden text-right sm:block">
            <dt className="text-[0.66rem] font-bold uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500">
              {paused ? 'Paused' : 'Next run'}
            </dt>
            <dd className="text-[0.78rem] font-bold text-slate-700 dark:text-slate-200">
              {paused ? 'Nothing is scheduled' : formatTimestamp(recipe.nextRunAt)}
            </dd>
          </dl>
          <EnableSwitch
            checked={recipe.enabled}
            disabled={busy || !gateCleared}
            label={`Enable ${recipe.name}`}
            describedBy={gateCleared ? undefined : blockedId}
            onChange={(next) => onToggleEnabled(recipe, next)}
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-[0.74rem]">
        <Fact label="Schedule" value={describeSchedule(recipe.schedule)} />
        <Fact label="Last run" value={formatTimestamp(recipe.lastRunAt)} />
        <Fact
          label="Dry run"
          value={gateCleared ? formatTimestamp(recipe.dryRunPassedAt) : 'Required'}
          tone={gateCleared ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}
        />
      </div>

      {!gateCleared && (
        <p
          id={blockedId}
          className="mt-2.5 rounded-[1rem] bg-amber-500/10 px-3 py-2 text-[0.76rem] font-semibold text-amber-700 dark:text-amber-300"
        >
          {enableBlockedReason}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => onDryRun(recipe)}
          disabled={busy || recipe.invalid}
          className={cn(
            ACTION_BUTTON,
            'bg-[rgba(var(--page-accent-rgb),0.14)] text-[var(--page-accent)] hover:bg-[rgba(var(--page-accent-rgb),0.22)]'
          )}
        >
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          Dry run
        </button>
        <button
          type="button"
          onClick={() => onRunNow(recipe)}
          disabled={busy || !gateCleared}
          className={cn(
            ACTION_BUTTON,
            'border border-white/60 bg-white/60 text-slate-700 hover:bg-white dark:border-white/10 dark:bg-slate-800/60 dark:text-slate-200 dark:hover:bg-slate-800'
          )}
        >
          <Play className="h-3.5 w-3.5" aria-hidden="true" />
          Run now
        </button>
        <button
          type="button"
          onClick={() => onEdit(recipe)}
          disabled={busy}
          className={cn(ACTION_BUTTON, 'text-slate-500 hover:bg-slate-500/10 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100')}
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
          Edit
        </button>
        <button
          type="button"
          onClick={() => onDelete(recipe)}
          disabled={busy}
          aria-label={`Delete ${recipe.name}`}
          className={cn(ACTION_BUTTON, 'ml-auto text-red-500 hover:bg-red-500/10')}
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          Delete
        </button>
      </div>
    </li>
  );
}

function Fact({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[0.66rem] font-bold uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500">
        {label}
      </dt>
      <dd className={cn('truncate font-semibold', tone ?? 'text-slate-600 dark:text-slate-300')}>{value}</dd>
    </div>
  );
}
