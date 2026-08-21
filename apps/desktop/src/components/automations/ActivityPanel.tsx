import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import type { AutomationRun } from '@/types';

// What actually happened. The pause switch used to live up here; it is the page's
// kill switch, so it belongs in the header beside the page title rather than inside
// the history of past runs.
interface ActivityPanelProps {
  runs: AutomationRun[];
  schedulerActive: boolean;
  onCancel: () => void;
}

const VISIBLE_RUNS = 40;

function formatDuration(durationMs: number): string {
  if (durationMs < 1000) return '<1s';
  const seconds = Math.round(durationMs / 1000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

export function ActivityPanel({ runs, schedulerActive, onCancel }: ActivityPanelProps) {
  return (
    <section
      className="flex h-full min-h-0 flex-col rounded-[1.75rem] border border-white/55 bg-white/40 p-4 backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/35"
      aria-labelledby="automations-activity-heading"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2
          id="automations-activity-heading"
          className="text-[1.05rem] font-black tracking-[-0.03em] text-slate-950 dark:text-slate-100"
        >
          Activity
        </h2>
        {schedulerActive && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full bg-red-500/12 px-3 py-1.5 text-[0.78rem] font-bold text-red-600 transition-colors duration-200 hover:bg-red-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:text-red-400 dark:focus-visible:ring-offset-slate-900"
          >
            Stop current run
          </button>
        )}
      </div>

      {schedulerActive && (
        <p className="mt-2 flex items-center gap-2 text-[0.78rem] font-semibold text-slate-600 dark:text-slate-300">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--page-accent)]" aria-hidden="true" />
          A run is in progress.
        </p>
      )}

      {runs.length === 0 ? (
        <p className="mt-4 rounded-[1.25rem] bg-white/50 px-3 py-6 text-center text-[0.82rem] font-medium text-slate-500 dark:bg-slate-950/40 dark:text-slate-400">
          No automation runs yet.
        </p>
      ) : (
        <ul aria-live="off" className="mt-3 min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1 custom-scrollbar">
          {runs.slice(0, VISIBLE_RUNS).map((run) => (
            <li
              key={run.id}
              className="flex items-start gap-2.5 rounded-[1.25rem] border border-white/60 bg-white/50 px-3 py-2 dark:border-white/10 dark:bg-slate-950/40"
            >
              {run.ok ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-hidden="true" />
              ) : (
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" aria-hidden="true" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="text-[0.8rem] font-bold text-slate-800 dark:text-slate-100">{run.recipeName}</span>
                  <span className="rounded-full bg-slate-500/10 px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {run.dryRun ? 'Dry run' : run.trigger}
                  </span>
                </div>
                <p className="truncate text-[0.72rem] text-slate-500 dark:text-slate-400">{run.message}</p>
              </div>
              <span className="shrink-0 text-[0.7rem] text-slate-400 dark:text-slate-500">
                {new Date(run.startedAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })} ·{' '}
                {formatDuration(run.durationMs)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {runs.length > VISIBLE_RUNS && (
        <p className="mt-2 text-[0.72rem] font-semibold text-slate-400 dark:text-slate-500">
          Showing {VISIBLE_RUNS} of {runs.length}.
        </p>
      )}
    </section>
  );
}
