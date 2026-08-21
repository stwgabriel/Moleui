import { cn } from '@/utils/cn';
import { formatKB } from '@/hooks/useRepos';
import type { RepoSummary } from '@/types';
import { META_TEXT, SECTION_LABEL, SOFT_CARD } from './chrome';

// Four numbers, and one of them is the page's only large figure.
//
// The colour discipline on this page is strict: the bands are all neutral glass, so
// without one element carrying scale the whole surface reads as grey panels. The
// reclaimable figure is the right one to grow, because it is the number the page
// exists to produce.
//
// The fourth tile keeps the refusal the old page already had: until the remotes have
// actually been contacted it reads `Archivable (unchecked)` with no number, because
// "0 safe to archive" from a scan that checked nothing is a confident false
// statement.

interface RepoHealthStripProps {
  summary: RepoSummary;
  verified: boolean;
}

export function RepoHealthStrip({ summary, verified }: RepoHealthStripProps) {
  const notes: string[] = [];
  if (summary.remote_missing > 0) {
    notes.push(
      `${summary.remote_missing} remote${summary.remote_missing === 1 ? '' : 's'} unreachable while signed in`
    );
  }
  if (summary.auth_failed > 0) notes.push(`${summary.auth_failed} could not be checked: authentication failed`);
  if (summary.remote_conflict > 0) {
    notes.push(`${summary.remote_conflict} share a remote with another local copy`);
  }

  return (
    <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
      <Tile label="Repositories" value={String(summary.repos)} />
      <Tile
        label="No backup"
        value={String(summary.no_backup)}
        tone={summary.no_backup > 0 ? 'danger' : 'muted'}
      />
      <Tile label="Unpushed" value={String(summary.needs_push)} tone={summary.needs_push > 0 ? 'warn' : 'muted'} />
      <Tile
        label={verified ? 'Safe to archive' : 'Archivable (unchecked)'}
        value={verified ? formatKB(summary.reclaimable_kb) : '—'}
        sub={
          verified
            ? `${summary.archivable} ${summary.archivable === 1 ? 'repository' : 'repositories'}`
            : 'Run Check remotes'
        }
        hero
        tone={verified && summary.archivable > 0 ? 'accent' : 'muted'}
      />

      {notes.length > 0 && (
        <p className={cn('col-span-2 lg:col-span-4', META_TEXT)}>
          {notes.map((note, index) => (
            <span key={note} className={index === 0 && summary.remote_missing > 0 ? 'text-red-600 dark:text-red-400' : undefined}>
              {index > 0 && <span className="text-slate-300 dark:text-slate-600"> · </span>}
              {note}
            </span>
          ))}
        </p>
      )}
    </div>
  );
}

function Tile({
  label,
  value,
  sub,
  tone = 'muted',
  hero = false,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'danger' | 'warn' | 'accent' | 'muted';
  hero?: boolean;
}) {
  const toneText = {
    danger: 'text-red-600 dark:text-red-400',
    warn: 'text-amber-600 dark:text-amber-400',
    accent: 'text-[var(--page-accent)]',
    muted: 'text-slate-950 dark:text-slate-100',
  }[tone];

  return (
    <div role="group" aria-label={`${label}: ${value}${sub ? `, ${sub}` : ''}`} className={cn('px-4 py-3', SOFT_CARD)}>
      <div
        className={cn(
          'font-black tracking-[-0.045em]',
          hero ? 'text-[clamp(1.7rem,2.8vw,2.4rem)] leading-none' : 'text-2xl leading-none',
          toneText
        )}
      >
        {value}
      </div>
      <div className={cn('mt-1.5', SECTION_LABEL)}>{label}</div>
      {sub && <div className="mt-0.5 text-[0.72rem] font-semibold text-slate-400 dark:text-slate-500">{sub}</div>}
    </div>
  );
}
