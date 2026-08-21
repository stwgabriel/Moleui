import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Archive, ChevronDown, CloudOff, FileWarning, HelpCircle, Lock, ShieldCheck, Upload } from 'lucide-react';
import { cn } from '@/utils/cn';
import { formatKB } from '@/hooks/useRepos';
import { Button } from '@/components/ui/Button';
import {
  LANE_META,
  LANE_ORDER,
  isSelectable,
  selectionReason,
  splitNoBackup,
  type RepoLaneGroups,
  type RepoLaneContext,
  type RepoLaneId,
} from '@/lib/repoLanes';
import { RepoChip } from './RepoChip';
import { BODY_TEXT, EASE, FOCUS_RING, META_TEXT, SOFT_CARD, stagger } from './chrome';

// How far each repository has got from "the only copy is here" to "provably
// stored somewhere else", read top to bottom.
//
// This started as five side-by-side columns and did not survive contact with the
// window: 1240px minus the sidebar and the inspector leaves about 128px per
// column, which cannot hold a path, a size and an idle time. Full-width bands with
// wrapping chips get about 680px instead, and the vertical order carries the same
// progression the columns were drawing.
//
// The vertical budget is the constraint that shapes the rest. At the 900px default
// there is room for roughly two open bands, so the bands beyond the opened pair
// render as header-only rows and expanding one closes the other. `no-backup` is
// always open and always first, because a repository whose only copy is here is
// the finding that must not be below the fold.
//
// Bands are a classification, not a queue: nothing flows from one to the next, so
// there is no directional rail and no count between them. Only `no-backup` is
// tinted, and only when it has something in it.

const LANE_ICON: Record<RepoLaneId, typeof CloudOff> = {
  'no-backup': CloudOff,
  uncommitted: FileWarning,
  unconfirmed: Upload,
  unknown: HelpCircle,
  'on-remote': ShieldCheck,
  archivable: Archive,
};

interface SafetyBandsProps {
  groups: RepoLaneGroups;
  context: RepoLaneContext;
  verified: boolean;
  selected: Set<string>;
  currentPath: string | null;
  onToggle: (path: string) => void;
  onInspect: (path: string) => void;
  onSelectMany: (paths: string[]) => void;
  onCheckRemotes: () => void;
}

// Bands hidden while the remotes have not been contacted. Both of them assert
// something about a remote, and an offline scan asserted nothing.
const GATED_LANES: RepoLaneId[] = ['on-remote', 'archivable'];

export function SafetyBands({
  groups,
  context,
  verified,
  selected,
  currentPath,
  onToggle,
  onInspect,
  onSelectMany,
  onCheckRemotes,
}: SafetyBandsProps) {
  const reduce = useReducedMotion() ?? false;

  const visibleLanes = useMemo(
    () =>
      LANE_ORDER.filter((lane) => {
        if (!verified && GATED_LANES.includes(lane)) return false;
        // `no-backup` always renders, so a healthy machine is told so rather than
        // left to infer it from an absence.
        return lane === 'no-backup' || groups[lane].length > 0;
      }),
    [groups, verified]
  );

  // One band beyond `no-backup` is open at a time. Default to the one that can be
  // acted on, since that is what the page is for.
  const defaultOpen = useMemo(() => {
    if (verified && groups.archivable.length > 0) return 'archivable' as RepoLaneId;
    return visibleLanes.find((lane) => lane !== 'no-backup' && groups[lane].length > 0) ?? null;
  }, [groups, verified, visibleLanes]);

  const [openLane, setOpenLane] = useState<RepoLaneId | null>(defaultOpen);
  useEffect(() => setOpenLane(defaultOpen), [defaultOpen]);

  // With `no-backup` pinned open at the top and the collapsed headers between, the
  // second open band's chips can sit right at the fold. Bring it into view when the
  // user opens it, so expanding something always shows what was expanded.
  const bandRefs = useRef(new Map<RepoLaneId, HTMLElement>());
  const openedByUser = useRef(false);
  useEffect(() => {
    if (!openLane || !openedByUser.current) return;
    openedByUser.current = false;
    bandRefs.current.get(openLane)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [openLane]);

  const openLanes = useMemo(
    () => visibleLanes.filter((lane) => lane === 'no-backup' || lane === openLane),
    [visibleLanes, openLane]
  );

  // The composite is a single tab stop: arrows move, Tab leaves.
  const [active, setActive] = useState<{ lane: RepoLaneId; index: number } | null>(null);
  const chipRefs = useRef(new Map<string, HTMLButtonElement>());

  const registerChip = useCallback((path: string, element: HTMLButtonElement | null) => {
    if (element) chipRefs.current.set(path, element);
    else chipRefs.current.delete(path);
  }, []);

  const focusChip = useCallback(
    (lane: RepoLaneId, index: number) => {
      const entries = groups[lane];
      if (entries.length === 0) return;
      const bounded = Math.max(0, Math.min(index, entries.length - 1));
      setActive({ lane, index: bounded });
      chipRefs.current.get(entries[bounded].path)?.focus();
    },
    [groups]
  );

  // Derived, never trusted: closing a band would otherwise leave `active` pointing
  // at a lane with no rendered chips, so nothing would hold the composite's single
  // tab stop and the whole thing would drop out of the tab order.
  const fallbackLane = openLanes.find((lane) => groups[lane].length > 0) ?? null;
  const activeIsLive = active && openLanes.includes(active.lane) && groups[active.lane].length > 0;
  const activeLane = activeIsLive ? active!.lane : fallbackLane;
  const activeIndex = activeIsLive ? Math.min(active!.index, groups[active!.lane].length - 1) : 0;

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!activeLane) return;
    const laneEntries = groups[activeLane];
    const openWithChips = openLanes.filter((lane) => groups[lane].length > 0);
    const lanePosition = openWithChips.indexOf(activeLane);

    switch (event.key) {
      // Left and right move within a band, wrapping across the visual rows the
      // chips wrap into. Up and down move between bands. Bands stack, so this is
      // the only mapping where the keys agree with the pixels.
      case 'ArrowRight':
        event.preventDefault();
        focusChip(activeLane, Math.min(activeIndex + 1, laneEntries.length - 1));
        break;
      case 'ArrowLeft':
        event.preventDefault();
        focusChip(activeLane, Math.max(activeIndex - 1, 0));
        break;
      case 'ArrowDown':
        event.preventDefault();
        if (lanePosition < openWithChips.length - 1) focusChip(openWithChips[lanePosition + 1], 0);
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (lanePosition > 0) focusChip(openWithChips[lanePosition - 1], 0);
        break;
      case 'Home':
        event.preventDefault();
        focusChip(event.ctrlKey || event.metaKey ? openWithChips[0] : activeLane, 0);
        break;
      case 'End':
        event.preventDefault();
        if (event.ctrlKey || event.metaKey) {
          const last = openWithChips[openWithChips.length - 1];
          focusChip(last, groups[last].length - 1);
        } else {
          focusChip(activeLane, laneEntries.length - 1);
        }
        break;
      case ' ': {
        const entry = laneEntries[activeIndex];
        if (!entry || !isSelectable(entry, activeLane, verified)) return;
        event.preventDefault();
        onToggle(entry.path);
        break;
      }
      default:
        break;
    }
  };

  return (
    <div className="space-y-3" onKeyDown={onKeyDown}>
      {visibleLanes.map((lane, bandIndex) => {
        const entries = groups[lane];
        const isOpen = openLanes.includes(lane);
        const Icon = LANE_ICON[lane];
        const meta = LANE_META[lane];
        const totalKB = entries.reduce((sum, entry) => sum + entry.size.exclusive_kb, 0);
        const selectableEntries = entries.filter((entry) => isSelectable(entry, lane, verified));
        const headingId = `band-${lane}-h`;
        const countId = `band-${lane}-count`;
        const blurbId = `band-${lane}-blurb`;

        // `no-backup` mixes repositories with no copy anywhere and clean ones that
        // merely enclose such a folder. The health tile counts only the first, so
        // the band names both rather than printing their sum.
        const split = lane === 'no-backup' ? splitNoBackup(entries) : null;
        const countText =
          split && split.containing.length > 0
            ? `${split.own.length} with no backup, ${split.containing.length} that contain one, ${formatKB(totalKB)}`
            : `${entries.length} ${entries.length === 1 ? 'repository' : 'repositories'}, ${formatKB(totalKB)}`;

        return (
          <motion.section
            key={lane}
            role="group"
            aria-labelledby={`${headingId} ${countId}`}
            aria-describedby={blurbId}
            initial={reduce ? { opacity: 1 } : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: EASE, delay: stagger(bandIndex, reduce) }}
            ref={(element) => {
              if (element) bandRefs.current.set(lane, element);
              else bandRefs.current.delete(lane);
            }}
            className={cn(
              'relative overflow-hidden scroll-mt-2',
              isOpen ? SOFT_CARD : 'rounded-[1.5rem] border border-white/55 bg-white/25 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/25'
            )}
          >
            {/* Tinted only when the finding is real. A red panel announcing that
                nothing is wrong would make red mean two things at once. */}
            <span
              aria-hidden="true"
              className={cn(
                'absolute inset-y-0 left-0 w-[3px]',
                lane === 'no-backup' && entries.length > 0
                  ? 'bg-red-500/70'
                  : 'bg-[rgba(var(--page-accent-rgb),0.45)]'
              )}
            />

            <div className={cn('relative', isOpen ? 'p-4 pl-5' : 'py-2.5 pl-5 pr-3')}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (lane === 'no-backup') return;
                    openedByUser.current = true;
                    setOpenLane((previous) => (previous === lane ? null : lane));
                  }}
                  aria-expanded={lane === 'no-backup' ? undefined : isOpen}
                  disabled={lane === 'no-backup'}
                  className={cn(
                    'flex min-w-0 items-start gap-3 rounded-[1rem] text-left disabled:cursor-default',
                    FOCUS_RING
                  )}
                >
                  <span
                    className={cn(
                      'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl',
                      lane === 'no-backup' && entries.length > 0
                        ? 'bg-red-500/12 text-red-500'
                        : 'bg-[rgba(var(--page-accent-rgb),0.12)] text-[var(--page-accent)]'
                    )}
                    aria-hidden="true"
                  >
                    {lane === 'no-backup' && entries.length === 0 ? (
                      <ShieldCheck className="h-4 w-4" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-baseline gap-x-2">
                      <h2
                        id={headingId}
                        className="text-[1.05rem] font-black tracking-[-0.03em] text-slate-950 dark:text-slate-100"
                      >
                        {meta.title}
                      </h2>
                      <span id={countId} className={META_TEXT}>
                        {countText}
                      </span>
                      {lane !== 'no-backup' && (
                        <ChevronDown
                          className={cn(
                            'h-4 w-4 text-slate-400 transition-transform duration-200',
                            isOpen && 'rotate-180'
                          )}
                          aria-hidden="true"
                        />
                      )}
                    </span>
                    <p
                      id={blurbId}
                      className={cn('mt-1 max-w-3xl text-[0.82rem] leading-snug', BODY_TEXT, !isOpen && 'sr-only')}
                    >
                      {meta.blurb}
                    </p>
                    {split && split.containing.length > 0 && isOpen && (
                      <p className="mt-1 text-[0.78rem] font-semibold text-slate-500 dark:text-slate-400">
                        The No backup tile counts only the {split.own.length}. The other{' '}
                        {split.containing.length} contain a directory with no backup.
                      </p>
                    )}
                    {lane === 'archivable' && isOpen && entries.length > 0 && (
                      <p className="mt-1 text-[0.78rem] font-semibold text-slate-500 dark:text-slate-400">
                        Archiving moves these to the Trash. Space is freed when you empty the Trash.
                      </p>
                    )}
                  </span>
                </button>

                {isOpen && selectableEntries.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onSelectMany(selectableEntries.map((entry) => entry.path))}
                    className={cn(
                      'shrink-0 rounded-full px-3 py-1.5 text-xs font-bold text-[var(--page-accent)] transition-colors hover:bg-[rgba(var(--page-accent-rgb),0.10)]',
                      FOCUS_RING
                    )}
                  >
                    {selectableEntries.every((entry) => selected.has(entry.path)) ? 'Clear all in ' : 'Select all in '}
                    {meta.title}
                  </button>
                )}
              </div>

              {isOpen && (
                <div className="mt-3">
                  {entries.length === 0 ? (
                    <p className={cn('text-[0.85rem]', META_TEXT)}>{meta.emptyText}</p>
                  ) : (
                    <ul
                      role="list"
                      aria-labelledby={headingId}
                      aria-live="off"
                      className="grid max-h-[38vh] gap-2 overflow-y-auto pr-1 custom-scrollbar sm:grid-cols-2"
                    >
                      {entries.map((entry, index) => {
                        const selectable = isSelectable(entry, lane, verified);
                        return (
                          <RepoChip
                            key={entry.path}
                            ref={(element) => registerChip(entry.path, element)}
                            entry={entry}
                            lane={lane}
                            context={context}
                            selectable={selectable}
                            checked={selected.has(entry.path)}
                            current={currentPath === entry.path}
                            active={activeLane === lane && activeIndex === index}
                            blockedReason={selectable ? null : selectionReason(entry, lane, verified)}
                            onToggle={() => onToggle(entry.path)}
                            onInspect={() => {
                              setActive({ lane, index });
                              onInspect(entry.path);
                            }}
                          />
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </motion.section>
        );
      })}

      {!verified && <UncheckedPanel onCheckRemotes={onCheckRemotes} />}
    </div>
  );
}

// The two bands that assert something about a remote do not render at all until a
// remote has been contacted. One locked panel stands in for both, and it is the
// only place on the page that explains the gate, so the message is not repeated
// per region.
function UncheckedPanel({ onCheckRemotes }: { onCheckRemotes: () => void }) {
  return (
    <section
      role="group"
      aria-labelledby="repos-unchecked-h"
      aria-describedby="repos-unchecked-blurb"
      className={cn('relative overflow-hidden p-5', SOFT_CARD)}
    >
      <span aria-hidden="true" className="absolute inset-y-0 left-0 w-[3px] bg-slate-400/40" />
      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2
            id="repos-unchecked-h"
            className="flex items-center gap-2 text-[1.05rem] font-black tracking-[-0.03em] text-slate-950 dark:text-slate-100"
          >
            <Lock className="h-4 w-4 text-slate-400" aria-hidden="true" />
            Not checked yet
          </h2>
          <p id="repos-unchecked-blurb" className={cn('mt-1 max-w-2xl text-[0.85rem] leading-snug', BODY_TEXT)}>
            Remotes have not been contacted, so nothing can be confirmed as backed up yet. Run{' '}
            <strong>Check remotes</strong> before archiving anything.
          </p>
        </div>
        <Button variant="glass" size="sm" icon={ShieldCheck} onClick={onCheckRemotes} className="shrink-0">
          Check remotes
        </Button>
      </div>
    </section>
  );
}
