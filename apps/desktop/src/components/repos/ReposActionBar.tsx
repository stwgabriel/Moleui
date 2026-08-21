import { useEffect, useRef, useState } from 'react';
import { Archive, Check, Loader2, RefreshCw, Trash2, Upload, X } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Button } from '@/components/ui/Button';
import { formatKB } from '@/hooks/useRepos';
import { displayName } from '@/lib/repoLanes';
import type { RepoEntry } from '@/types';
import { BODY_TEXT, FOCUS_RING, GLASS_BAR, META_TEXT, SECTION_LABEL } from './chrome';

// The footer, and the last thing between a selection and the Trash.
//
// Two behaviours here are load-bearing rather than decorative:
//
//   * The armed state disarms whenever the selected set changes *identity*, not
//     just its size. Keying it on a count let a user arm "Archive 2", swap one
//     repository for another, and have a set they never confirmed be the one that
//     moved.
//
//   * Arming expands a review list of exactly what will move. A batch archive is
//     the normal case, and with a single-select inspector the armed moment was the
//     only place the whole set could be audited. It is capped and scrolls inside
//     itself, with the buttons pinned outside, so the safety feature can never
//     push the safety control off screen.

interface ReposActionBarProps {
  busy: null | 'push' | 'archive';
  verified: boolean;
  pushable: RepoEntry[];
  archivable: RepoEntry[];
  totalSelected: number;
  syncable: RepoEntry[];
  syncing: boolean;
  onSync: (paths: string[]) => void;
  onPush: (dryRun: boolean) => void;
  onArchive: (dryRun: boolean, vault: boolean) => void;
  onClear: () => void;
}

const REVIEW_LIMIT = 6;

export function ReposActionBar({
  busy,
  verified,
  pushable,
  archivable,
  totalSelected,
  syncable,
  syncing,
  onSync,
  onPush,
  onArchive,
  onClear,
}: ReposActionBarProps) {
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [vault, setVault] = useState(true);

  const pushKey = pushable.map((entry) => entry.path).join('\0');
  const archiveKey = archivable.map((entry) => entry.path).join('\0');

  // Identity, not count. Swapping one repository for another at the same count has
  // to disarm, or the confirmed set and the moved set are different sets.
  useEffect(() => {
    setConfirmArchive(false);
  }, [pushKey, archiveKey]);

  // Arming replaces the button that was clicked, so focus would land on <body> and
  // the bar's Escape handler would never see a keystroke. Put focus on the armed
  // control: Escape then disarms, and the confirmed action is already under the
  // keyboard.
  const armedRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (confirmArchive) armedRef.current?.focus();
  }, [confirmArchive]);

  if (totalSelected === 0) return null;

  const archiveSizeKB = archivable.reduce((sum, entry) => sum + entry.size.exclusive_kb, 0);
  const shown = archivable.slice(0, REVIEW_LIMIT);
  const hidden = archivable.length - shown.length;

  return (
    <div
      className={cn('mx-2 mb-2 shrink-0 px-4 py-3', GLASS_BAR)}
      onKeyDown={(event) => {
        // Escape disarms. It never moves anything.
        if (event.key === 'Escape' && confirmArchive) {
          event.stopPropagation();
          setConfirmArchive(false);
        }
      }}
    >
      {confirmArchive && archivable.length > 0 && (
        <div
          role="group"
          aria-labelledby="repos-archive-review-h"
          tabIndex={0}
          className={cn('mb-3 max-h-[32vh] overflow-y-auto rounded-[1.25rem] bg-white/45 p-3 custom-scrollbar dark:bg-slate-950/40', FOCUS_RING)}
        >
          <h3 id="repos-archive-review-h" className={SECTION_LABEL}>
            Review {archivable.length} {archivable.length === 1 ? 'repository' : 'repositories'}
          </h3>
          <p className={cn('mt-1 text-[0.76rem] leading-snug', BODY_TEXT)}>
            These move to the Trash, not deleted, and every branch and tag is re-checked against its remote immediately
            before each move. Anything that fails that re-check is skipped. Space is freed when you empty the Trash.
          </p>
          <ul className="mt-2 space-y-1">
            {shown.map((entry) => (
              <li key={entry.path} className="flex items-center gap-2 text-[0.76rem]">
                <Check className="h-3 w-3 shrink-0 text-emerald-500" aria-hidden="true" />
                <span className="min-w-0 flex-1 select-text truncate font-mono text-slate-600 dark:text-slate-300" title={entry.path}>
                  {displayName(entry)}
                </span>
                <span className="shrink-0 font-bold text-slate-500 dark:text-slate-400">
                  {formatKB(entry.size.exclusive_kb)}
                </span>
              </li>
            ))}
          </ul>
          {hidden > 0 && (
            <p className={cn('mt-1.5 text-[0.74rem]', META_TEXT)}>and {hidden} more selected</p>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className={cn('text-[0.85rem]', META_TEXT)}>
          <span className="font-bold text-slate-950 dark:text-slate-100">{totalSelected} selected</span>
          {archivable.length > 0 && ` · ${archivable.length} archivable (${formatKB(archiveSizeKB)})`}
          {pushable.length > 0 && ` · ${pushable.length} to push`}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="glass" size="sm" onClick={onClear} disabled={busy !== null}>
            Clear
          </Button>

          {syncable.length > 0 && (
            <Button
              variant="glass"
              size="sm"
              icon={syncing ? Loader2 : RefreshCw}
              onClick={() => onSync(syncable.map((entry) => entry.path))}
              disabled={busy !== null || syncing}
              className={syncing ? '[&_svg]:animate-spin' : undefined}
            >
              {syncing ? 'Syncing…' : `Sync ${syncable.length}`}
            </Button>
          )}

          {pushable.length > 0 && (
            <>
              <Button variant="glass" size="sm" onClick={() => onPush(true)} disabled={busy !== null}>
                Preview push
              </Button>
              <Button
                variant="glass-danger"
                size="sm"
                icon={busy === 'push' ? Loader2 : Upload}
                onClick={() => onPush(false)}
                disabled={busy !== null}
                className={busy === 'push' ? '[&_svg]:animate-spin' : undefined}
              >
                {busy === 'push' ? 'Pushing…' : `Push ${pushable.length}`}
              </Button>
            </>
          )}

          {archivable.length > 0 && (
            <>
              <label className={cn('flex cursor-pointer items-center gap-2 text-xs font-semibold', BODY_TEXT)}>
                <input
                  type="checkbox"
                  checked={vault}
                  onChange={(event) => setVault(event.target.checked)}
                  className="sr-only"
                />
                <span
                  aria-hidden="true"
                  className={cn(
                    'flex h-4 w-4 items-center justify-center rounded-md border transition-colors',
                    vault
                      ? 'border-[var(--page-accent)] bg-[var(--page-accent)] text-white'
                      : 'border-slate-300 bg-white/70 text-transparent dark:border-slate-600 dark:bg-slate-900/70'
                  )}
                >
                  <Check className="h-2.5 w-2.5" />
                </span>
                Copy secrets out first
              </label>
              <Button variant="glass" size="sm" onClick={() => onArchive(true, vault)} disabled={busy !== null}>
                Preview archive
              </Button>
              {confirmArchive ? (
                <>
                  <Button variant="glass" size="sm" icon={X} onClick={() => setConfirmArchive(false)} disabled={busy !== null}>
                    Cancel
                  </Button>
                  <Button
                    ref={armedRef}
                    variant="glass-danger"
                    size="sm"
                    icon={busy === 'archive' ? Loader2 : Trash2}
                    onClick={() => {
                      setConfirmArchive(false);
                      onArchive(false, vault);
                    }}
                    disabled={busy !== null || !verified}
                    aria-describedby="repos-archive-review-h"
                    className={busy === 'archive' ? '[&_svg]:animate-spin' : undefined}
                  >
                    {busy === 'archive' ? 'Archiving…' : `Move ${archivable.length} to Trash`}
                  </Button>
                </>
              ) : (
                <Button
                  variant="glass"
                  size="sm"
                  icon={Archive}
                  onClick={() => setConfirmArchive(true)}
                  disabled={busy !== null || !verified}
                  title={verified ? undefined : 'Run Check remotes first'}
                >
                  Archive {archivable.length}
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
