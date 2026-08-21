import { CalendarClock, LibraryBig, PackageOpen, Plus, ShieldAlert, Sparkles } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Button } from '@/components/ui/Button';
import { describeAction } from '@/lib/automationCatalog';
import type { AutomationRecipe, PermissionStatus } from '@/types';

// What runs next, and nothing more.
//
// This began as a seven-day calendar ribbon and had to be abandoned, because the
// renderer cannot honestly draw one. `nextRunAt` is the one fire time the main
// process publishes; every later occurrence would mean reimplementing the
// scheduler's own maths, including the random offset it adds, the six-hour minimum
// gap it enforces, and the window it rolls a missed slot forward through. A grid of
// exact future times would have been a promise the product cannot keep.
//
// So this shows the times the main process actually computed, says out loud that
// they are projections, and names the conditions that cause a run to be skipped.
// Full Disk Access is called out separately: battery and idle are transient, but
// FDA denied means nothing will ever run, and a confident list of times would be
// the wrong thing to show in that state.

interface NextRunsPanelProps {
  recipes: AutomationRecipe[];
  paused: boolean;
  schedulerRunning: boolean;
  fullDiskAccess: PermissionStatus;
  onOpenLibrary: () => void;
  onNewRecipe: () => void;
  onOpenPermissions: () => void;
}

const PANEL =
  'relative overflow-hidden rounded-[1.75rem] border border-white/55 bg-white/40 backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/35';

export function NextRunsPanel({
  recipes,
  paused,
  schedulerRunning,
  fullDiskAccess,
  onOpenLibrary,
  onNewRecipe,
  onOpenPermissions,
}: NextRunsPanelProps) {
  const scheduled = recipes
    .filter((recipe) => recipe.enabled && !recipe.invalid && recipe.nextRunAt)
    .sort((a, b) => {
      const byTime = Date.parse(a.nextRunAt!) - Date.parse(b.nextRunAt!);
      // Two recipes can legitimately fall on the same minute, and an unstable sort
      // would reorder them between renders.
      return byTime !== 0 ? byTime : a.name.localeCompare(b.name);
    });

  // An enabled recipe with no computed time is the state where the user believes
  // something is armed and nothing is scheduled, so it is listed rather than
  // filtered away.
  const armedWithoutTime = recipes.filter((recipe) => recipe.enabled && !recipe.invalid && !recipe.nextRunAt);

  if (recipes.length === 0) {
    return (
      <section className={cn('p-6 text-center', PANEL)} aria-labelledby="automations-next-h">
        <span
          className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgba(var(--page-accent-rgb),0.14)] text-[var(--page-accent)]"
          aria-hidden="true"
        >
          <CalendarClock className="h-6 w-6" />
        </span>
        <h2
          id="automations-next-h"
          className="mt-3 text-2xl font-black tracking-[-0.04em] text-slate-950 dark:text-slate-100"
        >
          Nothing runs on a schedule yet
        </h2>
        <p className="mx-auto mt-2 max-w-md text-[0.88rem] font-medium leading-relaxed text-slate-600 dark:text-slate-300">
          Add a recipe from the library, or build your own. Either way it stays off until a dry run passes.
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <Button
            variant="glass"
            size="sm"
            icon={LibraryBig}
            onClick={onOpenLibrary}
            className="text-[var(--page-accent)] ring-1 ring-[rgba(var(--page-accent-rgb),0.35)]"
          >
            Browse the library
          </Button>
          <Button variant="glass" size="sm" icon={Plus} onClick={onNewRecipe}>
            Build a custom recipe
          </Button>
        </div>
      </section>
    );
  }

  const blocked = fullDiskAccess === 'denied';

  return (
    <section className={cn('p-4', PANEL)} aria-labelledby="automations-next-h">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2
          id="automations-next-h"
          className="text-[1.05rem] font-black tracking-[-0.03em] text-slate-950 dark:text-slate-100"
        >
          Next run for each enabled recipe
          {paused && <span className="ml-2 text-[0.78rem] font-bold text-slate-400">Paused</span>}
        </h2>
        {!schedulerRunning && (
          <span className="text-[0.78rem] font-semibold text-slate-500 dark:text-slate-400">
            Scheduler is not running.
          </span>
        )}
      </div>

      {blocked && (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-[1.25rem] bg-red-500/10 px-3.5 py-2.5">
          <ShieldAlert className="h-4 w-4 shrink-0 text-red-500" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-[0.82rem] font-semibold leading-snug text-red-700 dark:text-red-300">
            Full Disk Access is off, so no automation can run. Turn it on in System Settings.
          </p>
          <Button variant="glass" size="sm" onClick={onOpenPermissions} className="shrink-0">
            Open System Settings
          </Button>
        </div>
      )}

      {scheduled.length === 0 && armedWithoutTime.length === 0 ? (
        <p className="mt-3 text-[0.85rem] font-medium text-slate-600 dark:text-slate-300">
          No recipe is enabled yet. Each one needs a passing dry run first.
        </p>
      ) : (
        <ol className={cn('mt-3 space-y-2', (paused || blocked) && 'opacity-55')} aria-live="off">
          {scheduled.map((recipe, index) => {
            const Icon = recipe.action.kind === 'installer' ? PackageOpen : Sparkles;
            const when = new Date(recipe.nextRunAt!);
            const overdue = when.getTime() < Date.now();
            return (
              <li
                key={recipe.id}
                className="flex items-center gap-3 rounded-[1.25rem] border border-white/60 bg-white/45 px-3.5 py-2.5 dark:border-white/10 dark:bg-slate-950/40"
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[rgba(var(--page-accent-rgb),0.12)] text-[var(--page-accent)]"
                  aria-hidden="true"
                >
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div
                    className={cn(
                      'font-black tracking-[-0.04em] text-slate-950 dark:text-slate-100',
                      index === 0 ? 'text-2xl leading-none' : 'text-lg leading-none'
                    )}
                  >
                    {when.toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div className="mt-1 truncate text-[0.82rem] font-bold text-slate-700 dark:text-slate-200">
                    {recipe.name}
                  </div>
                  <div className="truncate text-[0.72rem] font-semibold text-slate-400 dark:text-slate-500">
                    {describeAction(recipe.action)}
                  </div>
                </div>
                {overdue && (
                  <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[0.68rem] font-bold text-amber-700 dark:text-amber-300">
                    Overdue, will run at the next check
                  </span>
                )}
              </li>
            );
          })}

          {armedWithoutTime.map((recipe) => (
            <li
              key={recipe.id}
              className="flex items-center gap-3 rounded-[1.25rem] border border-white/60 bg-white/35 px-3.5 py-2.5 dark:border-white/10 dark:bg-slate-950/30"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-[0.82rem] font-bold text-slate-700 dark:text-slate-200">{recipe.name}</div>
                <div className="text-[0.72rem] font-semibold text-slate-400 dark:text-slate-500">
                  No next run computed yet.
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}

      <p className="mt-3 text-[0.72rem] font-medium leading-snug text-slate-400 dark:text-slate-500">
        Projected times. A run can be skipped if the Mac is on battery, in use, if another cleanup is running, or if
        Moleui is closed.
      </p>
    </section>
  );
}
