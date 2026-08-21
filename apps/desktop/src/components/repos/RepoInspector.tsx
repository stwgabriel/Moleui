import { useState } from 'react';
import { Check, ChevronDown, CloudOff, Copy, GitBranch, X } from 'lucide-react';
import { cn } from '@/utils/cn';
import { formatIdle, formatKB, isAtRisk, riskReason } from '@/hooks/useRepos';
import {
  LANE_META,
  displayName,
  laneReason,
  markersOf,
  type RepoLaneContext,
  type RepoLaneId,
} from '@/lib/repoLanes';
import type { RepoEntry } from '@/types';
import { BODY_TEXT, FOCUS_RING, META_TEXT, SECTION_LABEL, SOFT_CARD } from './chrome';

// One repository, in full.
//
// This replaces a per-row expander that could be open on many rows at once. The
// trade is deliberate: a persistent pane can hold a readable hierarchy (name, then
// the verdict, then the gates) where a row expander could only hold a grid of
// fourteen identical `text-xs` label/value pairs. Only six facts are shown by
// default; the rest sit behind one disclosure so the panel does not become the same
// wall of small text in a narrower box.
//
// Selecting a repository here is a separate state from ticking it for push or
// archive, so reading one never disturbs a set the user has assembled.

interface RepoInspectorProps {
  entry: RepoEntry | null;
  worktrees?: RepoEntry[];
  lane: RepoLaneId | null;
  context: RepoLaneContext;
  scannedAt?: string;
  onClose: () => void;
}

export function RepoInspector({ entry, worktrees = [], lane, context, scannedAt, onClose }: RepoInspectorProps) {
  const [showDetails, setShowDetails] = useState(false);

  if (!entry || !lane) {
    return (
      <aside className={cn('flex h-full flex-col items-center justify-center gap-3 p-6 text-center', SOFT_CARD)}>
        <span
          aria-hidden="true"
          className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[rgba(var(--page-accent-rgb),0.12)] text-[var(--page-accent)]"
        >
          <GitBranch className="h-5 w-5" />
        </span>
        <p className={cn('max-w-[18rem]', META_TEXT)}>
          Pick a repository to see what is and is not backed up.
        </p>
      </aside>
    );
  }

  const failing = entry.gates?.filter((gate) => !gate.ok) ?? [];
  const passing = entry.gates?.filter((gate) => gate.ok) ?? [];
  const reason = laneReason(entry, context);
  const markers = markersOf(entry, context);

  return (
    <aside className={cn('flex h-full min-h-0 flex-col overflow-hidden', SOFT_CARD)} aria-label="Repository details">
      <header className="flex items-start justify-between gap-3 px-4 pt-4">
        <div className="min-w-0">
          <h2 className="truncate text-xl font-black tracking-[-0.04em] text-slate-950 dark:text-slate-100">
            {displayName(entry)}
          </h2>
          <p className={cn('mt-0.5 text-[0.8rem]', META_TEXT)}>{LANE_META[lane].title}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close repository details"
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-white/70 hover:text-slate-700 dark:hover:bg-slate-800/70 dark:hover:text-slate-200',
            FOCUS_RING
          )}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </header>

      <div className="min-h-0 flex-1 select-text overflow-y-auto px-4 pb-4 pt-3 custom-scrollbar">
        {isAtRisk(entry) && (
          <p className="mb-3 flex items-start gap-2 rounded-[1rem] bg-red-500/10 px-3 py-2 text-[0.8rem] font-semibold leading-snug text-red-700 dark:text-red-300">
            <CloudOff className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {riskReason(entry)}
          </p>
        )}
        {!isAtRisk(entry) && reason && (
          <p className={cn('mb-3 rounded-[1rem] bg-slate-500/10 px-3 py-2 text-[0.8rem] leading-snug', BODY_TEXT)}>
            {reason}
          </p>
        )}

        <PathRow label="Path" value={entry.path} />

        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
          <Fact label="Total size" value={formatKB(entry.size.total_kb)} />
          <Fact label="Last activity" value={formatIdle(entry.activity.days_idle)} />
          {entry.remote && <Fact label="Remote" value={`${entry.remote.owner}/${entry.remote.repo}`} />}
          {entry.head_branch && <Fact label="Head" value={entry.head_branch} />}
        </dl>

        {worktrees.length > 0 && (
          <section className="mt-4">
            <h3 className={SECTION_LABEL}>Worktrees</h3>
            <ul className="mt-1.5 space-y-1.5">
              {worktrees.map((worktree) => (
                <li key={worktree.path} className="rounded-xl bg-white/45 px-3 py-2 dark:bg-slate-950/40">
                  <p className="truncate text-[0.8rem] font-semibold text-slate-800 dark:text-slate-100">{worktree.name}</p>
                  <p className={cn('mt-0.5 truncate font-mono text-[0.7rem]', META_TEXT)} title={worktree.path}>
                    {worktree.path}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {markers.length > 0 && (
          <div className="mt-3">
            <h3 className={SECTION_LABEL}>Local only</h3>
            <ul className="mt-1.5 space-y-1">
              {markers.map((marker) => (
                <li key={marker.id} className={cn('text-[0.8rem]', BODY_TEXT)}>
                  {marker.label}
                </li>
              ))}
            </ul>
          </div>
        )}

        {entry.kind === 'worktree' && (
          <p className={cn('mt-3 rounded-[1rem] bg-slate-500/10 px-3 py-2 text-[0.78rem] leading-snug', BODY_TEXT)}>
            {entry.worktree?.broken ? (
              <>
                This is an orphaned linked worktree: its git directory
                {entry.worktree.git_dir ? ` (${entry.worktree.git_dir})` : ''} no longer exists. Clean it up with{' '}
                <code className="select-text font-mono text-[0.72rem]">git worktree prune</code> in the main repository
                rather than deleting the folder, so git stops tracking it.
              </>
            ) : (
              <>
                A linked worktree. Remove it with{' '}
                <code className="select-text font-mono text-[0.72rem]">git worktree remove</code> from the main
                repository rather than deleting the folder, so git stops tracking it.
              </>
            )}
          </p>
        )}

        {entry.local_only_files && entry.local_only_files.length > 0 && (
          <p className="mt-3 text-[0.78rem] font-medium leading-snug text-amber-700 dark:text-amber-300">
            Files no remote holds: {entry.local_only_files.slice(0, 6).join(', ')}
            {entry.local_only_files.length > 6 ? ` and ${entry.local_only_files.length - 6} more` : ''}. Archiving
            with <strong>Copy secrets out first</strong> saves them to ~/.mole/repo-vault.
          </p>
        )}

        {entry.shared_with && entry.shared_with.length > 0 && (
          <p className="mt-3 text-[0.78rem] font-medium leading-snug text-amber-700 dark:text-amber-300">
            Shares its remote with {entry.shared_with.join(', ')}. While two copies push to one remote, neither can be
            confirmed as safely stored.
          </p>
        )}

        {entry.push_blocked && entry.push_blocked_by && (
          <p className={cn('mt-3 text-[0.78rem]', BODY_TEXT)}>Cannot push: {entry.push_blocked_by}</p>
        )}

        {(failing.length > 0 || passing.length > 0) && (
          <div className="mt-4">
            <h3 className={SECTION_LABEL}>Archive gates</h3>
            <p className="mt-1 text-[0.72rem] font-medium leading-snug text-slate-400 dark:text-slate-500">
              As of the last scan{scannedAt ? ` (${new Date(scannedAt).toLocaleString()})` : ''}. Every gate is
              re-checked against the remote immediately before each move.
            </p>
            <ul className="mt-2 space-y-1.5">
              {[...failing, ...passing].map((gate) => (
                <li key={gate.id} className="flex items-start gap-2">
                  <span
                    aria-hidden="true"
                    className={cn(
                      'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[0.6rem] font-black',
                      gate.ok ? 'bg-emerald-500/15 text-emerald-600' : 'bg-red-500/15 text-red-500'
                    )}
                  >
                    {gate.ok ? <Check className="h-2.5 w-2.5" /> : <X className="h-2.5 w-2.5" />}
                  </span>
                  <span className="min-w-0 text-[0.78rem] leading-snug">
                    <span className="sr-only">{gate.ok ? 'Passed. ' : 'Failed. '}</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-200">{gate.label}</span>
                    {gate.detail ? (
                      <span className="text-slate-500 dark:text-slate-400">: {gate.detail}</span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <button
          type="button"
          onClick={() => setShowDetails((previous) => !previous)}
          aria-expanded={showDetails}
          className={cn(
            'mt-4 flex items-center gap-1.5 rounded-full text-[0.78rem] font-bold text-[var(--page-accent)]',
            FOCUS_RING
          )}
        >
          Details
          <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', showDetails && 'rotate-180')} aria-hidden="true" />
        </button>

        {showDetails && (
          <dl className="mt-2 grid gap-x-4 gap-y-2 sm:grid-cols-2">
            <Fact label="Kind" value={entry.kind.replace(/_/g, ' ')} />
            <Fact label="Freshness source" value={entry.activity.source} />
            {entry.remote && <Fact label="Remote URL" value={entry.remote.url} mono />}
            {entry.remote?.verified_via?.startsWith('ssh:') && (
              <Fact label="Verified over" value="SSH (the stored HTTPS credentials were refused)" />
            )}
            {entry.dirty.total > 0 && (
              <Fact
                label="Uncommitted"
                value={`${entry.dirty.tracked} changed, ${entry.dirty.untracked} untracked`}
              />
            )}
            {entry.stashes > 0 && <Fact label="Stashes" value={`${entry.stashes} (local only)`} />}
            {entry.size.total_kb !== entry.size.exclusive_kb && (
              <Fact
                label="Size"
                value={`${formatKB(entry.size.exclusive_kb)} excluding nested repos (${formatKB(entry.size.total_kb)} total)`}
              />
            )}
            {entry.push_branches && entry.push_branches.length > 0 && (
              <Fact
                label="Unpushed branches"
                value={`${entry.push_branches.slice(0, 8).join(', ')}${
                  entry.push_branches.length > 8 ? ` and ${entry.push_branches.length - 8} more` : ''
                }`}
              />
            )}
          </dl>
        )}
      </div>
    </aside>
  );
}

function PathRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex items-center gap-2 rounded-[1rem] bg-white/45 px-3 py-2 dark:bg-slate-950/40">
      <div className="min-w-0 flex-1">
        <dt className={SECTION_LABEL}>{label}</dt>
        <dd className="select-text truncate font-mono text-[0.72rem] text-slate-600 dark:text-slate-300" title={value}>
          {value}
        </dd>
      </div>
      <button
        type="button"
        onClick={async () => {
          await window.moleDesktop?.copyText?.(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1400);
        }}
        aria-label={`Copy ${label.toLowerCase()} ${value}`}
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-white/80 hover:text-slate-700 dark:hover:bg-slate-800/80 dark:hover:text-slate-200',
          FOCUS_RING
        )}
      >
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
      </button>
    </div>
  );
}

function Fact({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className={SECTION_LABEL}>{label}</dt>
      <dd
        className={cn(
          'select-text truncate text-[0.8rem] font-semibold text-slate-600 dark:text-slate-300',
          mono && 'font-mono text-[0.72rem]'
        )}
        title={value}
      >
        {value}
      </dd>
    </div>
  );
}
