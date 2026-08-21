import { forwardRef } from 'react';
import { Archive, Check, CloudOff, FileWarning, HelpCircle, Upload } from 'lucide-react';
import { cn } from '@/utils/cn';
import { formatIdle, formatKB } from '@/hooks/useRepos';
import {
  LANE_STATE_WORD,
  displayName,
  markersOf,
  type RepoLaneContext,
  type RepoLaneId,
} from '@/lib/repoLanes';
import type { RepoEntry } from '@/types';
import { CHIP_CARD, FOCUS_RING } from './chrome';

// A repository as it appears in a band or a tree.
//
// The awkward part of this component is that a chip carries two independent
// states, and conflating them is how a user ends up acting on a set they did not
// confirm. `checked` is membership of the push or archive set; `current` is which
// repository the inspector is showing. So there are two controls in one row: a
// visually-quiet checkbox, and a button covering the rest of the chip.
//
// The checkbox input is always rendered and always `sr-only`, never hidden with
// `display:none` or `invisible`: only its glyph fades in on hover and focus. A
// control that appears on hover and does not exist otherwise is a control a
// keyboard cannot reach.
//
// Only the button takes part in the roving tabindex. The whole bands composite is
// one tab stop and the arrow keys do the moving, because one stop per chip would
// put dozens of them between the header and the action bar.

const LANE_GLYPH: Record<RepoLaneId, typeof CloudOff> = {
  'no-backup': CloudOff,
  uncommitted: FileWarning,
  unconfirmed: Upload,
  unknown: HelpCircle,
  'on-remote': Check,
  archivable: Archive,
};

const LANE_GLYPH_TONE: Record<RepoLaneId, string> = {
  'no-backup': 'text-red-500',
  uncommitted: 'text-amber-500',
  unconfirmed: 'text-amber-500',
  unknown: 'text-slate-400 dark:text-slate-500',
  'on-remote': 'text-emerald-500',
  archivable: 'text-[var(--page-accent)]',
};

export interface RepoChipProps {
  entry: RepoEntry;
  lane: RepoLaneId;
  context: RepoLaneContext;
  /** Whether this repository may join the push or archive set at all. */
  selectable: boolean;
  checked: boolean;
  current: boolean;
  /** True when this chip owns the composite's single tab stop. */
  active: boolean;
  /** Why selection is unavailable, stated literally. */
  blockedReason?: string | null;
  onToggle: () => void;
  onInspect: () => void;
}

export const RepoChip = forwardRef<HTMLButtonElement, RepoChipProps>(function RepoChip(
  { entry, lane, context, selectable, checked, current, active, blockedReason, onToggle, onInspect },
  ref
) {
  const name = displayName(entry);
  const markers = markersOf(entry, context);
  const Glyph = LANE_GLYPH[lane];
  const checkboxId = `chip-select-${entry.path}`;
  const detailId = `chip-detail-${entry.path}`;

  return (
    <li className="min-w-0">
      <div
        className={cn(
          'group relative flex min-w-0 items-center gap-2 p-2 pr-3 transition-colors duration-200',
          CHIP_CARD,
          current
            ? 'ring-2 ring-[var(--page-accent)] ring-offset-1 ring-offset-white/60 dark:ring-offset-slate-950/60'
            : 'hover:bg-white/65 dark:hover:bg-slate-900/55',
          checked && 'border-[rgba(var(--page-accent-rgb),0.55)]'
        )}
      >
        {selectable ? (
          <>
            <input
              id={checkboxId}
              type="checkbox"
              className="peer sr-only"
              checked={checked}
              onChange={onToggle}
              aria-label={`Select ${name}`}
              tabIndex={-1}
            />
            <label
              htmlFor={checkboxId}
              aria-hidden="true"
              className={cn(
                'flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-lg border transition-all duration-200',
                'opacity-0 group-hover:opacity-100 peer-focus-visible:opacity-100 peer-checked:opacity-100',
                checked
                  ? 'border-[var(--page-accent)] bg-[var(--page-accent)] text-white'
                  : 'border-slate-300/80 bg-white/70 text-transparent dark:border-slate-600 dark:bg-slate-900/70'
              )}
            >
              <Check className="h-3.5 w-3.5" />
            </label>
          </>
        ) : (
          // No placeholder control: an empty box that cannot be ticked reads as a
          // bug. The chip keeps its indent so rows still line up.
          <span className="h-6 w-6 shrink-0" aria-hidden="true" />
        )}

        <button
          ref={ref}
          type="button"
          tabIndex={active ? 0 : -1}
          onClick={onInspect}
          aria-current={current ? 'true' : undefined}
          aria-describedby={detailId}
          aria-keyshortcuts={selectable ? 'Space Enter' : 'Enter'}
          className={cn('flex min-w-0 flex-1 items-center gap-2 rounded-[1rem] text-left', FOCUS_RING)}
        >
          <Glyph className={cn('h-4 w-4 shrink-0', LANE_GLYPH_TONE[lane])} aria-hidden="true" />
          <span className="sr-only">{LANE_STATE_WORD[lane]}. </span>
          <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-950 dark:text-slate-100">
            {name}
          </span>
          <span className="shrink-0 text-xs font-bold text-slate-600 dark:text-slate-300">
            {formatKB(entry.size.exclusive_kb)}
          </span>
          <span className="shrink-0 text-[0.7rem] font-semibold text-slate-400 dark:text-slate-500">
            {formatIdle(entry.activity.days_idle)}
          </span>
        </button>
      </div>

      {(markers.length > 0 || blockedReason) && (
        <p id={detailId} className="mt-1 flex flex-wrap items-center gap-1 pl-10 pr-2">
          {/* The checkbox is not a focus stop, so selection has to be announced
              through the description the button points at. */}
          <span className="sr-only">{checked ? 'Selected. ' : ''}</span>
          {markers.map((marker) => (
            <span
              key={marker.id}
              className={cn(
                'rounded-full px-2 py-0.5 text-[0.68rem] font-semibold',
                marker.tone === 'warn'
                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                  : 'bg-slate-500/10 text-slate-500 dark:text-slate-400'
              )}
            >
              {marker.label}
            </span>
          ))}
          {blockedReason && (
            <span className="text-[0.68rem] font-semibold text-slate-500 dark:text-slate-400">
              {blockedReason}
            </span>
          )}
        </p>
      )}
      {markers.length === 0 && !blockedReason && (
        <span id={detailId} className="sr-only">
          {checked ? 'Selected.' : ''}
        </span>
      )}
    </li>
  );
});
