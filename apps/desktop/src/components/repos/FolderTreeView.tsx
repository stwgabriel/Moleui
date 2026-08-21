import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronRight, CloudOff, Folder, GitBranch } from 'lucide-react';
import { cn } from '@/utils/cn';
import { formatIdle, formatKB } from '@/hooks/useRepos';
import {
  LANE_STATE_WORD,
  describeLaneCounts,
  isSelectable,
  visibleTreeRows,
  type RepoLaneId,
  type RepoTreeNode,
} from '@/lib/repoLanes';
import { BODY_TEXT, FOCUS_RING, META_TEXT, SOFT_CARD } from './chrome';

// Where the repositories actually live.
//
// Depth is indentation plus one hairline per nesting run, which is how the rest of
// the app draws hierarchy. There are no numbered level headers: `aria-level` is the
// correct carrier for depth, and on a real machine most repositories sit one or two
// folders down, so a ribbon of "Level 2" labels would name a distinction nobody has.
//
// Each folder carries the state of what is inside it as text first, so a folder
// containing something unbacked is legible while collapsed and without relying on
// a colour anyone can see.

interface FolderTreeViewProps {
  nodes: RepoTreeNode[];
  /** Changes only when a new report arrives, so expansion is re-seeded per scan. */
  reportStamp: string;
  laneByPath: Map<string, RepoLaneId>;
  verified: boolean;
  selected: Set<string>;
  currentPath: string | null;
  onToggle: (path: string) => void;
  onInspect: (path: string) => void;
}

export function FolderTreeView({
  nodes,
  reportStamp,
  laneByPath,
  verified,
  selected,
  currentPath,
  onToggle,
  onInspect,
}: FolderTreeViewProps) {
  // Open the first two levels so the shape is visible without any clicking. This is
  // recomputed per report rather than persisted: a saved set both resurrects paths a
  // later scan does not contain and leaves genuinely new folders collapsed.
  const seedExpanded = useCallback((list: RepoTreeNode[]) => {
    const initial = new Set<string>();
    const walk = (nodesAtDepth: RepoTreeNode[], depth: number) => {
      for (const node of nodesAtDepth) {
        if (depth < 2 && node.children.length > 0) initial.add(node.id);
        walk(node.children, depth + 1);
      }
    };
    walk(list, 0);
    return initial;
  }, []);

  const [expanded, setExpanded] = useState<Set<string>>(() => seedExpanded(nodes));
  const seededFor = useRef(reportStamp);
  useEffect(() => {
    if (seededFor.current === reportStamp) return;
    seededFor.current = reportStamp;
    setExpanded(seedExpanded(nodes));
    // Intentionally keyed on the report, not on `nodes`: `nodes` is rebuilt every
    // render, and re-seeding on that would collapse the tree under the user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportStamp]);

  const rows = useMemo(() => visibleTreeRows(nodes, expanded), [nodes, expanded]);
  const [activeId, setActiveId] = useState<string | null>(null);
  // A rescan changes the row ids, so the remembered row can vanish. Falling back to
  // the first visible row keeps the tree's single tab stop alive.
  const activeRowId = rows.some((row) => row.id === activeId) ? activeId : rows[0]?.id ?? null;
  const rowRefs = useRef(new Map<string, HTMLLIElement>());

  const focusRow = useCallback((id: string) => {
    setActiveId(id);
    rowRefs.current.get(id)?.focus();
  }, []);

  const toggleExpanded = useCallback((id: string, open?: boolean) => {
    setExpanded((previous) => {
      const next = new Set(previous);
      const shouldOpen = open ?? !next.has(id);
      if (shouldOpen) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const onKeyDown = (event: React.KeyboardEvent<HTMLUListElement>) => {
    const index = rows.findIndex((row) => row.id === activeRowId);
    if (index === -1) return;
    const row = rows[index];
    const hasChildren = row.children.length > 0;
    const isOpen = expanded.has(row.id);

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (index < rows.length - 1) focusRow(rows[index + 1].id);
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (index > 0) focusRow(rows[index - 1].id);
        break;
      case 'ArrowRight':
        event.preventDefault();
        if (hasChildren && !isOpen) toggleExpanded(row.id, true);
        else if (hasChildren && isOpen) focusRow(row.children[0].id);
        break;
      case 'ArrowLeft': {
        event.preventDefault();
        if (hasChildren && isOpen) {
          toggleExpanded(row.id, false);
          break;
        }
        // Walk back to the nearest shallower row, which is this row's parent.
        for (let i = index - 1; i >= 0; i -= 1) {
          if (rows[i].depth < row.depth) {
            focusRow(rows[i].id);
            break;
          }
        }
        break;
      }
      case 'Home':
        event.preventDefault();
        focusRow(rows[0].id);
        break;
      case 'End':
        event.preventDefault();
        focusRow(rows[rows.length - 1].id);
        break;
      case 'Enter':
        event.preventDefault();
        if (row.entry) onInspect(row.entry.path);
        else toggleExpanded(row.id);
        break;
      case ' ': {
        if (!row.entry) return;
        const lane = laneByPath.get(row.entry.path);
        if (!lane || !isNodeSelectable(row, lane, verified)) return;
        event.preventDefault();
        onToggle(row.entry.path);
        break;
      }
      default:
        // Typeahead: jump to the next row whose name starts with the character.
        if (event.key.length === 1 && /\S/.test(event.key)) {
          const needle = event.key.toLowerCase();
          const order = [...rows.slice(index + 1), ...rows.slice(0, index)];
          const match = order.find((candidate) => candidate.name.toLowerCase().startsWith(needle));
          if (match) {
            event.preventDefault();
            focusRow(match.id);
          }
        }
        break;
    }
  };

  if (rows.length === 0) {
    return (
      <div className={cn('p-6 text-center', SOFT_CARD)}>
        <p className={META_TEXT}>No repositories found under the folders above.</p>
      </div>
    );
  }

  return (
    <div className={cn('overflow-hidden p-2', SOFT_CARD)}>
      <ul
        role="tree"
        aria-label="Repository folders"
        aria-multiselectable="true"
        aria-live="off"
        onKeyDown={onKeyDown}
        className="max-h-[calc(100vh-24rem)] space-y-0.5 overflow-y-auto p-1 custom-scrollbar"
      >
        {rows.map((row) => {
          const lane = row.entry ? laneByPath.get(row.entry.path) : undefined;
          const selectable = row.entry && lane ? isNodeSelectable(row, lane, verified) : false;
          const checked = row.entry ? selected.has(row.entry.path) : false;
          const hasChildren = row.children.length > 0;
          const isOpen = expanded.has(row.id);
          const labelId = `node-${row.id}-label`;
          const countId = `node-${row.id}-count`;
          const detailId = `node-${row.id}-detail`;
          const summary = describeLaneCounts(row.laneCounts);

          return (
            <li
              key={row.id}
              ref={(element) => {
                if (element) rowRefs.current.set(row.id, element);
                else rowRefs.current.delete(row.id);
              }}
              role="treeitem"
              aria-level={row.depth + 1}
              // Absent, not false, on a leaf: "collapsed" is a lie about
              // something with nothing to collapse.
              aria-expanded={hasChildren ? isOpen : undefined}
              aria-selected={row.entry ? checked : undefined}
              aria-current={row.entry && currentPath === row.entry.path ? 'true' : undefined}
              aria-labelledby={`${labelId} ${countId}`}
              aria-describedby={detailId}
              aria-keyshortcuts={selectable ? 'Space Enter' : 'Enter'}
              tabIndex={activeRowId === row.id ? 0 : -1}
              onClick={() => {
                setActiveId(row.id);
                if (row.entry) onInspect(row.entry.path);
                else toggleExpanded(row.id);
              }}
              className={cn(
                'cursor-pointer rounded-[1rem] px-2 py-1.5 transition-colors',
                FOCUS_RING,
                row.entry && currentPath === row.entry.path
                  ? 'bg-[rgba(var(--page-accent-rgb),0.12)]'
                  : 'hover:bg-white/50 dark:hover:bg-slate-900/45'
              )}
            >
              <div
                className="flex min-w-0 items-center gap-2"
                style={{ paddingLeft: `${row.depth * 1.25}rem` }}
              >
                {hasChildren ? (
                  <span
                    aria-hidden="true"
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleExpanded(row.id);
                    }}
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-white/70 dark:hover:bg-slate-800/70"
                  >
                    <ChevronRight
                      className={cn('h-3.5 w-3.5 transition-transform duration-200', isOpen && 'rotate-90')}
                    />
                  </span>
                ) : (
                  <span className="h-5 w-5 shrink-0" aria-hidden="true" />
                )}

                <span
                  aria-hidden="true"
                  className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-lg',
                    row.kind === 'root' || !row.entry
                      ? 'bg-slate-500/10 text-slate-500 dark:text-slate-400'
                      : 'bg-[rgba(var(--page-accent-rgb),0.12)] text-[var(--page-accent)]'
                  )}
                >
                  {row.entry ? <GitBranch className="h-3.5 w-3.5" /> : <Folder className="h-3.5 w-3.5" />}
                </span>

                <span className="min-w-0 flex-1 truncate">
                  <span id={labelId} className="text-sm font-bold text-slate-950 dark:text-slate-100">
                    {lane && <span className="sr-only">{LANE_STATE_WORD[lane]}. </span>}
                    {row.name}
                  </span>
                </span>

                {checked && (
                  <span
                    aria-hidden="true"
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[var(--page-accent)] text-white"
                  >
                    <Check className="h-3 w-3" />
                  </span>
                )}
                {lane === 'no-backup' && (
                  <CloudOff className="h-3.5 w-3.5 shrink-0 text-red-500" aria-hidden="true" />
                )}

                <span id={countId} className="shrink-0 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {row.entry
                    ? formatKB(row.entry.size.exclusive_kb)
                    : `${row.repoCount} ${row.repoCount === 1 ? 'repo' : 'repos'}, ${formatKB(row.sizeKB)}`}
                </span>
              </div>

              <p
                id={detailId}
                className={cn(
                  'mt-0.5 truncate text-[0.72rem]',
                  BODY_TEXT
                )}
                style={{ paddingLeft: `${row.depth * 1.25 + 3.25}rem` }}
              >
                {row.entry
                  ? [
                      formatIdle(row.entry.activity.days_idle),
                      row.entry.kind === 'worktree' && row.entry.worktree?.main_repo
                        ? `worktree of ${row.entry.worktree.main_repo}`
                        : null,
                      row.entry.kind === 'nested_child' && row.entry.parent
                        ? `nested inside ${row.entry.parent.split('/').pop()}`
                        : null,
                      checked ? 'Selected' : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')
                  : summary || 'Empty'}
              </p>

              {selectable && row.entry && (
                <input
                  type="checkbox"
                  className="sr-only"
                  tabIndex={-1}
                  checked={checked}
                  aria-label={`Select ${row.name}`}
                  onChange={() => onToggle(row.entry!.path)}
                  onClick={(event) => event.stopPropagation()}
                />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function isNodeSelectable(node: RepoTreeNode, lane: RepoLaneId, verified: boolean): boolean {
  if (!node.entry) return false;
  return isSelectable(node.entry, lane, verified);
}
