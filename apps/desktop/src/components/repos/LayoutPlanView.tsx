import { ArrowRight } from 'lucide-react';
import { cn } from '@/utils/cn';
import type { RepoMoveProposal } from '@/types';
import { BODY_TEXT, META_TEXT, ROW_CARD, SOFT_CARD } from './chrome';

// Where a tidier tree would put each repository.
//
// There is no apply button, and there is deliberately no way to copy a target path
// either. Moving a repository rewrites paths other things depend on, and the Go
// layer disambiguates colliding basenames precisely because a user following the
// plan by hand could otherwise move one repository over another. That is also why
// this renders one row per proposal rather than drawing the proposed tree: a tree
// re-merges the very names the disambiguation split apart.

interface LayoutPlanViewProps {
  proposals: RepoMoveProposal[];
}

export function LayoutPlanView({ proposals }: LayoutPlanViewProps) {
  if (proposals.length === 0) {
    return (
      <div className={cn('p-6 text-center', SOFT_CARD)}>
        <p className={META_TEXT}>No layout suggestions from the last scan.</p>
      </div>
    );
  }

  const needsReview = proposals.filter((proposal) => !proposal.safe).length;

  return (
    <div className="space-y-3">
      <div className={cn('p-4', SOFT_CARD)}>
        <h2 className="text-[1.05rem] font-black tracking-[-0.03em] text-slate-950 dark:text-slate-100">
          Proposed layout
        </h2>
        <p className={cn('mt-1 max-w-3xl text-[0.85rem] leading-relaxed', BODY_TEXT)}>
          Moving a repository rewrites paths other things depend on. A linked worktree stores an absolute path to its
          main repo, and editor workspaces, <code className="font-mono text-[0.75rem]">.env</code> files, and any tool
          that keys state by directory hold absolute paths too. Mole will not do it for you.
        </p>
        <p className={cn('mt-2 text-[0.8rem]', META_TEXT)}>
          {proposals.length} suggestion{proposals.length === 1 ? '' : 's'}
          {needsReview > 0 ? ` · ${needsReview} need review` : ''} · nothing moves automatically
        </p>
      </div>

      <ul className="space-y-2">
        {proposals.map((proposal) => (
          <li key={proposal.from} className={cn('p-3.5', ROW_CARD)}>
            <div className="flex flex-col gap-1.5 lg:flex-row lg:items-center lg:gap-3">
              <span
                className="min-w-0 flex-1 select-text truncate font-mono text-[0.75rem] font-semibold text-slate-700 dark:text-slate-200"
                title={proposal.from}
              >
                {proposal.from}
              </span>
              <ArrowRight className="hidden h-3.5 w-3.5 shrink-0 text-[var(--page-accent)] lg:block" aria-hidden="true" />
              {proposal.to ? (
                <span
                  className="flex min-w-0 flex-1 items-center gap-2 truncate font-mono text-[0.75rem] text-slate-500 dark:text-slate-400"
                  title={proposal.to}
                >
                  <span className="lg:hidden" aria-hidden="true">
                    →
                  </span>
                  {proposal.to}
                  {!proposal.safe && (
                    <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[0.65rem] font-bold text-amber-700 dark:text-amber-300">
                      review
                    </span>
                  )}
                </span>
              ) : (
                <span className={cn('flex-1 text-[0.78rem]', META_TEXT)}>No move suggested</span>
              )}
            </div>
            <p className={cn('mt-1.5 text-[0.78rem] leading-snug', BODY_TEXT)}>{proposal.reason}</p>
            {proposal.risk && (
              <p className="mt-1 text-[0.78rem] font-medium leading-snug text-amber-700 dark:text-amber-300">
                {proposal.risk}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
