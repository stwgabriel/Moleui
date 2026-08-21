import { Archive, Check, CloudOff, FileWarning, Folder, Github, GitBranch, Gitlab, HelpCircle, Upload } from 'lucide-react';
import { formatKB } from '@/hooks/useRepos';
import {
  displayName,
  LANE_STATE_WORD,
  markersOf,
  type RepoLaneContext,
  type RepoLaneId,
} from '@/lib/repoLanes';
import type { RepoEntry } from '@/types';
import type { PresentedRepo } from '@/lib/repoPresentation';
import { cn } from '@/utils/cn';
import { FOCUS_RING, META_TEXT } from './chrome';

const LANE_ICON: Record<RepoLaneId, typeof CloudOff> = {
  'no-backup': CloudOff,
  uncommitted: FileWarning,
  unconfirmed: Upload,
  unknown: HelpCircle,
  'on-remote': Check,
  archivable: Archive,
};

const LANE_TONE: Record<RepoLaneId, string> = {
  'no-backup': 'border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300',
  uncommitted: 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  unconfirmed: 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  unknown: 'border-slate-300/70 bg-slate-500/10 text-slate-600 dark:border-white/10 dark:text-slate-300',
  'on-remote': 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  archivable: 'border-[rgba(var(--page-accent-rgb),0.25)] bg-[rgba(var(--page-accent-rgb),0.10)] text-[var(--page-accent)]',
};

interface RepoGridProps {
  repositories: PresentedRepo[];
  laneByPath: Map<string, RepoLaneId>;
  context: RepoLaneContext;
  selected: Set<string>;
  currentPath: string | null;
  onToggle: (path: string) => void;
  onInspect: (path: string) => void;
}

export function RepoGrid({
  repositories,
  laneByPath,
  context,
  selected,
  currentPath,
  onToggle,
  onInspect,
}: RepoGridProps) {
  return (
    <div className="space-y-4">
      <ul aria-label="Repositories" className="grid auto-rows-fr gap-4 pb-2 sm:grid-cols-2 xl:grid-cols-3">
        {repositories.map(({ entry, worktrees }) => {
          const lane = laneByPath.get(entry.path) ?? 'unknown';
          return (
            <RepoFolderCard
              key={entry.path}
              entry={entry}
              worktreeCount={worktrees.length}
              lane={lane}
              context={context}
              checked={selected.has(entry.path)}
              current={currentPath === entry.path}
              onToggle={() => onToggle(entry.path)}
              onInspect={() => onInspect(entry.path)}
            />
          );
        })}
      </ul>
    </div>
  );
}

function RepoFolderCard({
  entry,
  worktreeCount,
  lane,
  context,
  checked,
  current,
  onToggle,
  onInspect,
}: {
  entry: RepoEntry;
  worktreeCount: number;
  lane: RepoLaneId;
  context: RepoLaneContext;
  checked: boolean;
  current: boolean;
  onToggle: () => void;
  onInspect: () => void;
}) {
  const name = displayName(entry);
  const accessibleName = `${name}, ${entry.path}`;
  const Icon = LANE_ICON[lane];
  // Selection is for syncing as well as pushing or archiving. Worktrees are
  // folded into their primary card and therefore never become independent jobs.
  const selectable = entry.kind !== 'worktree';
  const markers = markersOf(entry, context);
  const provider = entry.remote?.host === 'github.com' ? Github : entry.remote?.host?.includes('gitlab') ? Gitlab : Folder;
  const ProviderIcon = provider;

  return (
    <li className="min-w-0">
      <div className="relative pt-5">
        <span
          aria-hidden="true"
          className="absolute left-4 top-0 h-5 w-24 rounded-t-[0.9rem] border border-b-0 border-white/70 bg-white/70 dark:border-white/10 dark:bg-slate-900/65"
        />
        <article
          className={cn(
            'group relative flex h-[12rem] min-w-0 flex-col overflow-hidden rounded-[1.35rem] border border-white/70 bg-white/60 p-4 shadow-[0_12px_30px_rgba(15,23,42,0.06)] backdrop-blur-xl transition duration-200 dark:border-white/10 dark:bg-slate-950/45',
            'hover:-translate-y-0.5 hover:bg-white/75 hover:shadow-[0_16px_34px_rgba(15,23,42,0.10)] dark:hover:bg-slate-900/60',
            current && 'ring-2 ring-[var(--page-accent)] ring-offset-2 ring-offset-white/40 dark:ring-offset-slate-950/40',
            checked && 'border-[rgba(var(--page-accent-rgb),0.55)]'
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <button
              type="button"
              onClick={onInspect}
              aria-current={current ? 'true' : undefined}
              aria-label={`Inspect ${accessibleName}`}
              className={cn('flex min-w-0 items-center gap-2 text-left', FOCUS_RING)}
            >
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[rgba(var(--page-accent-rgb),0.13)] text-[var(--page-accent)]"
                aria-hidden="true"
              >
                <ProviderIcon className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[0.98rem] font-black tracking-[-0.025em] text-slate-950 dark:text-slate-100" title={name}>
                  {name}
                </span>
                <span className="mt-0.5 block truncate font-mono text-[0.68rem] text-slate-400 dark:text-slate-500" title={entry.remote?.url ?? entry.path}>
                  {entry.remote ? `${entry.remote.owner}/${entry.remote.repo}` : 'Local repository'}
                </span>
              </span>
            </button>

            {selectable && (
              <label className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-slate-300/80 bg-white/70 text-transparent transition group-hover:text-slate-300 dark:border-slate-600 dark:bg-slate-900/70 dark:group-hover:text-slate-500">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={onToggle}
                  aria-label={`Select ${accessibleName}`}
                  className="sr-only"
                />
                <Check className={cn('h-4 w-4', checked && 'text-[var(--page-accent)]')} aria-hidden="true" />
              </label>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.68rem] font-bold', LANE_TONE[lane])}>
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {lane === 'no-backup' ? 'No backup anywhere' : LANE_STATE_WORD[lane]}
            </span>
            <span className={cn('inline-flex items-center gap-1 text-[0.7rem]', META_TEXT)}>
              <GitBranch className="h-3 w-3" aria-hidden="true" />
              {entry.head_branch || 'No branch'}
            </span>
            <span className={cn('text-[0.7rem]', META_TEXT)}>{formatKB(entry.size.total_kb)}</span>
            {worktreeCount > 0 && <span className={cn('text-[0.7rem]', META_TEXT)}>{worktreeCount} worktree{worktreeCount === 1 ? '' : 's'}</span>}
          </div>

          <div className="mt-auto pt-3">
            {markers.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {markers.slice(0, 3).map((marker) => (
                  <span
                    key={marker.id}
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[0.65rem] font-semibold',
                      marker.tone === 'warn'
                        ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                        : 'bg-slate-500/10 text-slate-500 dark:text-slate-400'
                    )}
                  >
                    {marker.label}
                  </span>
                ))}
                {markers.length > 3 && <span className={cn('text-[0.65rem] font-semibold', META_TEXT)}>+{markers.length - 3} more</span>}
              </div>
            )}
          </div>
        </article>
      </div>
    </li>
  );
}
