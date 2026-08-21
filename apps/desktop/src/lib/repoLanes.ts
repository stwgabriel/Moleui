import { isAtRisk } from '@/hooks/useRepos';
import type { RepoEntry, RepoGate } from '@/types';

// One classifier, one place.
//
// The Repos page draws the same repositories three ways (safety bands, folder
// tree, layout plan) and offers two destructive-adjacent actions on them. Every
// one of those readings has to agree, so nothing here is re-derived in a
// component: a view asks `laneOf` where a repository sits and `canPush` /
// `canArchive` what may be done to it, and that is the whole contract.
//
// Two rules this module exists to enforce:
//
//  1. Lane membership is decided from `needs_push`, `push_blocked`, `archivable`,
//     `gates`, `kind`, `dirty` and `isAtRisk` only. Never from `branches[]`.
//     `cmd/repos/gate.go` already resolved the cases that look alike and are not:
//     a `behind` branch is backed up, a `needs_fetch` branch is not, and only the
//     gate layer knows which. Reading `branches[]` here would re-open that.
//
//  2. The cascade is total. Its last rule has no predicate, so every entry lands
//     in exactly one lane. On the default offline scan almost nothing can be
//     confirmed, and a repository that matches no positive rule must be drawn as
//     unknown, never as safe and never dropped from the page.

export type RepoLaneId =
  | 'no-backup'
  | 'uncommitted'
  | 'unconfirmed'
  | 'unknown'
  | 'on-remote'
  | 'archivable';

export interface RepoLaneMeta {
  id: RepoLaneId;
  title: string;
  blurb: string;
  /** Only `no-backup` is tinted. Everything else is neutral glass. */
  tone: 'danger' | 'neutral';
  /** What a checkbox in this lane would do, if anything. */
  selectableFor: 'push' | 'archive' | null;
  /** Copy shown when the lane is rendered with nothing in it. */
  emptyText: string;
}

// Reading order, top to bottom. `unknown` deliberately precedes `on-remote`:
// "we could not tell" must never read as further along than "confirmed".
export const LANE_ORDER: RepoLaneId[] = [
  'no-backup',
  'uncommitted',
  'unconfirmed',
  'unknown',
  'on-remote',
  'archivable',
];

// `no-backup` and `archivable` keep the wording the page already shipped.
export const LANE_META: Record<RepoLaneId, RepoLaneMeta> = {
  'no-backup': {
    id: 'no-backup',
    title: 'No backup anywhere',
    blurb: 'These exist only on this machine. Nothing here can be safely cleaned up.',
    tone: 'danger',
    selectableFor: null,
    emptyText: 'Nothing here is unbacked up.',
  },
  uncommitted: {
    id: 'uncommitted',
    title: 'Uncommitted work here',
    blurb: 'Changes that are not in any commit yet. Committing is yours to do; Mole never commits.',
    tone: 'neutral',
    selectableFor: null,
    emptyText: 'Every working tree is clean.',
  },
  unconfirmed: {
    id: 'unconfirmed',
    title: 'Committed, not confirmed on the remote',
    blurb: 'Commits exist here that no remote has been shown to hold. Pushing sends them; it never creates commits for you.',
    tone: 'neutral',
    selectableFor: 'push',
    emptyText: 'Nothing is waiting to be pushed.',
  },
  unknown: {
    id: 'unknown',
    title: 'Not confirmed either way',
    blurb: 'Nothing here has been confirmed as stored elsewhere, and nothing has been ruled out.',
    tone: 'neutral',
    selectableFor: null,
    emptyText: 'Everything was accounted for.',
  },
  'on-remote': {
    id: 'on-remote',
    title: 'Branches and tags confirmed on the remote',
    blurb: 'Every ref was matched against the remote. Stashes, uncommitted work and gitignored files are not refs, so they are not covered by this.',
    tone: 'neutral',
    selectableFor: null,
    emptyText: 'Nothing has been confirmed on a remote yet.',
  },
  archivable: {
    id: 'archivable',
    title: 'Safe to archive',
    blurb: 'Every branch and tag is confirmed on the remote, and nothing has changed recently.',
    tone: 'neutral',
    selectableFor: 'archive',
    emptyText: 'Nothing is idle enough to archive.',
  },
};

/** Gate ids, mirroring the constants in cmd/repos/gate.go. */
export const GATE_REFS_ON_REMOTE = 'refs_on_remote';
export const GATE_TAGS_ON_REMOTE = 'tags_on_remote';
export const GATE_REFS_VERIFIED = 'refs_verified';

export function gateOf(entry: RepoEntry, id: string): RepoGate | undefined {
  return entry.gates?.find((gate) => gate.id === id);
}

/** A by-path index, so containment can be resolved without a nested scan. */
export function indexByPath(entries: RepoEntry[]): Map<string, RepoEntry> {
  return new Map(entries.map((entry) => [entry.path, entry]));
}

// Everything a lane decision needs, assembled once per report.
//
// `verified` is part of the context rather than a per-entry field because it is a
// property of the scan: an offline pass cannot confirm anything, and several rules
// have to know that before they read a gate.
export interface RepoLaneContext {
  byPath: Map<string, RepoEntry>;
  /** Direct children, inverted from `entry.parent`. */
  byParent: Map<string, RepoEntry[]>;
  verified: boolean;
  /** Memoised recursive containment answers. */
  atRiskDescendants: Map<string, RepoEntry[]>;
}

export function buildLaneContext(entries: RepoEntry[], verified: boolean): RepoLaneContext {
  const byParent = new Map<string, RepoEntry[]>();
  for (const entry of entries) {
    if (!entry.parent) continue;
    const siblings = byParent.get(entry.parent);
    if (siblings) siblings.push(entry);
    else byParent.set(entry.parent, [entry]);
  }

  return {
    byPath: indexByPath(entries),
    byParent,
    verified,
    atRiskDescendants: new Map(),
  };
}

// A repository that would take an unbacked-up folder down with it is itself a
// finding, however clean its own history is. gate.go refuses to archive such a
// parent (`no_nested_repos`); the page has to say why in the one band the user
// cannot miss.
//
// This walks `parent` edges rather than `entry.children`, for two reasons.
// `children` holds every descendant rather than the direct ones, and the scanner
// omits plain folders from it entirely (`linkNesting` in cmd/repos/scan.go skips
// `KindPlain` on both sides).
//
// Worth knowing before "simplifying" this: a plain folder can never actually be a
// descendant of a repository in a report, because `prunePlain` in
// cmd/repos/discover.go drops any non-repo candidate that has a kept ancestor. So
// a monorepo's package folders are never emitted as separate unbacked entries, and
// the only descendants this can find are real nested git repositories. The walk is
// written recursively anyway so a grandchild is not missed.
export function atRiskDescendants(entry: RepoEntry, context: RepoLaneContext): RepoEntry[] {
  const cached = context.atRiskDescendants.get(entry.path);
  if (cached) return cached;

  const found: RepoEntry[] = [];
  const seen = new Set<string>([entry.path]);
  const queue = [...(context.byParent.get(entry.path) ?? [])];

  while (queue.length > 0) {
    const child = queue.shift()!;
    if (seen.has(child.path)) continue;
    seen.add(child.path);
    if (isAtRisk(child)) found.push(child);
    queue.push(...(context.byParent.get(child.path) ?? []));
  }

  context.atRiskDescendants.set(entry.path, found);
  return found;
}

export function laneOf(entry: RepoEntry, context: RepoLaneContext): RepoLaneId {
  const { verified } = context;

  // 1. The only copy is here. Wins over every other signal, exactly as
  //    `categorize()` does, because it is the one thing that must be seen first.
  if (isAtRisk(entry)) return 'no-backup';

  // 2. Clean itself, but archiving or deleting the folder would take an
  //    unbacked-up repository or folder with it.
  if (atRiskDescendants(entry, context).length > 0) return 'no-backup';

  // 3. The scan itself failed, so nothing read off this entry is reliable.
  if (entry.scan_error) return 'unknown';

  // 4. The remote was contacted and the answer settled nothing: credentials
  //    refused, a not-found that could equally be a private repository, or an
  //    unreachable host. `missing` is excluded because rule 1 already claimed it.
  if (entry.remote?.verify_attempted && !entry.remote.verify_ok && !entry.remote.missing) {
    return 'unknown';
  }

  // 5. An orphaned linked worktree: its git directory is gone, so its state
  //    cannot be read either way.
  if (entry.kind === 'worktree' && entry.worktree?.broken) return 'unknown';

  // 6. Commits that no remote has been shown to hold. Computable offline, so this
  //    rule works on the default scan.
  if (entry.needs_push) return 'unconfirmed';

  const refs = gateOf(entry, GATE_REFS_ON_REMOTE);
  const tags = gateOf(entry, GATE_TAGS_ON_REMOTE);

  // 7. Refs the scanner could not place on the remote even though there is
  //    nothing to push: every `needs_fetch` branch lands here, and no push
  //    resolves it.
  //
  //    The `verified` guard is essential. gate.go computes both of these as
  //    `verified && …`, so on an offline report they are present and failing for
  //    every entry, and an unguarded rule here would label the whole machine
  //    "not confirmed on the remote" on first paint.
  if (verified && ((refs && !refs.ok) || (tags && !tags.ok))) return 'unconfirmed';

  // 8. After 6 and 7 on purpose: unpushed commits are what a push can save, and
  //    uncommitted files never were pushable. Dirtiness sits here rather than
  //    below the `verified` rule because it is a purely local fact that needs no
  //    network, so it stays true and useful on an offline scan.
  if (entry.dirty.total > 0) return 'uncommitted';

  // 9. Nothing was contacted, so nothing can be claimed.
  if (!verified) return 'unknown';

  // 10. Every gate passed, including the two above.
  if (entry.archivable) return 'archivable';

  // 11. Refs and tags both confirmed present on the remote.
  if (refs?.ok && tags?.ok) return 'on-remote';

  // 12. No predicate, so the function is total.
  return 'unknown';
}

/** The one-line reason a repository sits where it does, for the chip and inspector. */
export function laneReason(entry: RepoEntry, context: RepoLaneContext): string | null {
  if (entry.scan_error) return `Could not be read: ${entry.scan_error}`;
  if (entry.remote?.verify_attempted && !entry.remote.verify_ok && !entry.remote.missing) {
    // gate.go already writes a user-ready sentence for every verify outcome.
    return gateOf(entry, GATE_REFS_VERIFIED)?.detail ?? 'The remote could not be checked.';
  }
  if (entry.kind === 'worktree' && entry.worktree?.broken) {
    return 'Orphaned linked worktree: its git directory no longer exists.';
  }
  const refs = gateOf(entry, GATE_REFS_ON_REMOTE);
  const tags = gateOf(entry, GATE_TAGS_ON_REMOTE);
  if (context.verified && !entry.needs_push) {
    const failed = refs && !refs.ok ? refs : tags && !tags.ok ? tags : null;
    if (failed) {
      return `${failed.detail ?? 'A ref could not be placed on the remote.'} Fetch first. A push will not fix this.`;
    }
  }
  // Only claim "not checked" for entries whose state genuinely depends on the
  // network. Unpushed commits and uncommitted files are local facts, and an offline
  // scan knows them.
  if (!context.verified && !isAtRisk(entry) && !entry.needs_push && entry.dirty.total === 0) {
    return 'Not checked yet. Run Check remotes.';
  }
  return null;
}

export type RepoLaneGroups = Record<RepoLaneId, RepoEntry[]>;

export function assignLanes(
  entries: RepoEntry[],
  verified: boolean
): {
  groups: RepoLaneGroups;
  laneByPath: Map<string, RepoLaneId>;
  context: RepoLaneContext;
} {
  const context = buildLaneContext(entries, verified);
  const groups = {
    'no-backup': [],
    uncommitted: [],
    unconfirmed: [],
    unknown: [],
    'on-remote': [],
    archivable: [],
  } as RepoLaneGroups;
  const laneByPath = new Map<string, RepoLaneId>();

  for (const entry of entries) {
    const lane = laneOf(entry, context);
    groups[lane].push(entry);
    laneByPath.set(entry.path, lane);
  }

  const bySize = (a: RepoEntry, b: RepoEntry) => b.size.exclusive_kb - a.size.exclusive_kb;
  for (const lane of LANE_ORDER) groups[lane].sort(bySize);

  return { groups, laneByPath, context };
}

/**
 * `no-backup` holds two populations: repositories with no copy anywhere, and clean
 * repositories that merely enclose one. The health tile counts only the first, so
 * the band has to name both rather than print their sum.
 */
export function splitNoBackup(entries: RepoEntry[]) {
  const own = entries.filter((entry) => isAtRisk(entry));
  const containing = entries.filter((entry) => !isAtRisk(entry));
  return { own, containing };
}

// ─── What may be done to a repository ────────────────────────────────────────

// `needs_push` alone includes third-party clones and repositories that share a
// remote with another local copy. gate.go marks both `push_blocked` while leaving
// `needs_push` true, so a checkbox keyed on `needs_push` would offer a push the
// shell refuses.
export function canPush(entry: RepoEntry): boolean {
  return Boolean(entry.needs_push) && !entry.push_blocked;
}

// Archiving is gated on the report having actually contacted the remotes. The
// shell re-checks everything again immediately before each move, so a stale
// snapshot here can only ever produce a refusal, but the UI must not offer the
// action in the first place.
export function canArchive(entry: RepoEntry, verified: boolean): boolean {
  return Boolean(entry.archivable) && verified;
}

/**
 * Whether this repository, in this lane, may join the push or archive set. Both
 * views call this rather than re-encoding the lane-to-predicate mapping, so adding
 * a selectable lane is a change in one place.
 */
export function isSelectable(entry: RepoEntry, lane: RepoLaneId, verified: boolean): boolean {
  switch (LANE_META[lane].selectableFor) {
    case 'push':
      return canPush(entry);
    case 'archive':
      return canArchive(entry, verified);
    default:
      return false;
  }
}

export function selectionReason(entry: RepoEntry, lane: RepoLaneId, verified: boolean): string | null {
  if (lane === 'unconfirmed' && entry.push_blocked) {
    return `Cannot push: ${entry.push_blocked_by ?? 'the remote refused'}`;
  }
  if (lane === 'archivable' && !verified) return 'Run Check remotes first';
  return null;
}

// ─── Chip markers ────────────────────────────────────────────────────────────

export interface RepoMarker {
  id: string;
  label: string;
  tone: 'warn' | 'muted';
}

// Always rendered, never hover-revealed, never collapsed into a bare count.
// Stashes, gitignored files and dirty submodules are invisible to every ref
// check, so a repository can be genuinely "confirmed on the remote" and still
// hold the only copy of something.
export function markersOf(entry: RepoEntry, context: RepoLaneContext): RepoMarker[] {
  const markers: RepoMarker[] = [];

  if (entry.dirty.total > 0) {
    markers.push({ id: 'dirty', label: `${entry.dirty.total} uncommitted`, tone: 'warn' });
  }
  if (entry.stashes > 0) {
    markers.push({ id: 'stashes', label: `${entry.stashes} stashed`, tone: 'warn' });
  }
  if (entry.local_only_files?.length) {
    markers.push({
      id: 'local-only',
      label: `${entry.local_only_files.length} local-only files`,
      tone: 'warn',
    });
  }
  // A submodule holding local commits is work the parent's own status does not
  // fully report, so no ref check on the parent covers it.
  if (entry.submodules.dirty > 0) {
    markers.push({
      id: 'submodules',
      label: `${entry.submodules.dirty} ${entry.submodules.dirty === 1 ? 'submodule' : 'submodules'} with local state`,
      tone: 'warn',
    });
  }
  if (entry.shared_with?.length) {
    markers.push({ id: 'shared', label: 'shares its remote', tone: 'warn' });
  }
  // A linked worktree looks exactly like a standalone repository otherwise, and
  // deleting its folder is the wrong move: git keeps tracking it.
  if (entry.kind === 'worktree') {
    const main = entry.worktree?.main_repo;
    markers.push({
      id: 'worktree',
      label: main ? `worktree of ${main.split('/').pop()}` : 'linked worktree',
      tone: 'muted',
    });
  }

  const risky = atRiskDescendants(entry, context);
  if (risky.length > 0) {
    markers.push({
      id: 'children-at-risk',
      label: `contains ${risky.length} ${risky.length === 1 ? 'repository' : 'repositories'} with no backup`,
      tone: 'warn',
    });
  } else if (entry.children?.length) {
    markers.push({
      id: 'children',
      label: `contains ${entry.children.length} ${entry.children.length === 1 ? 'repository' : 'repositories'}`,
      tone: 'muted',
    });
  }

  if (entry.push_blocked && entry.push_blocked_by) {
    markers.push({ id: 'push-blocked', label: 'cannot push', tone: 'warn' });
  }

  return markers;
}

// ─── Naming ──────────────────────────────────────────────────────────────────

// `rel_path` is relative to the entry's own root, so it collides across roots and
// degenerates to "." when a scanned root is itself a repository. Identity is
// always `entry.path`; this is display only.
export function displayName(entry: RepoEntry): string {
  if (!entry.rel_path || entry.rel_path === '.') return entry.name;
  return entry.rel_path;
}

// ─── Folder tree ─────────────────────────────────────────────────────────────

export interface RepoTreeNode {
  /** Absolute path for a repository, `root:<path>` for a scanned root. */
  id: string;
  kind: 'root' | 'repo';
  name: string;
  path: string;
  entry?: RepoEntry;
  depth: number;
  children: RepoTreeNode[];
  /** Repositories in this subtree, including this node when it is one. */
  repoCount: number;
  /** Sum of `exclusive_kb` in this subtree. Never `total_kb`, which double counts. */
  sizeKB: number;
  laneCounts: Partial<Record<RepoLaneId, number>>;
}

// Structure comes from `parent` alone.
//
// `children` cannot be used for this: the scanner fills it with every descendant
// rather than the direct ones, and skips plain folders entirely, so a walk over
// it renders grandchildren twice and drops exactly the folders `isAtRisk` flags.
// `parent` is the single true edge, so the tree is built by inverting it.
export function buildRepoTree(
  entries: RepoEntry[],
  roots: string[],
  verified: boolean
): RepoTreeNode[] {
  const byPath = indexByPath(entries);
  const { laneByPath } = assignLanes(entries, verified);

  const repoNodes = new Map<string, RepoTreeNode>();
  for (const entry of entries) {
    repoNodes.set(entry.path, {
      id: entry.path,
      kind: 'repo',
      name: entry.name,
      path: entry.path,
      entry,
      depth: 0,
      children: [],
      repoCount: 0,
      sizeKB: 0,
      laneCounts: {},
    });
  }

  // Roots come from the report so an empty root still renders, and so an entry
  // whose root was dropped between scans still has somewhere to attach.
  const rootNames = new Set<string>([...roots, ...entries.map((entry) => entry.root)]);
  const rootNodes = new Map<string, RepoTreeNode>();
  for (const root of rootNames) {
    rootNodes.set(root, {
      id: `root:${root}`,
      kind: 'root',
      name: root,
      path: root,
      depth: 0,
      children: [],
      repoCount: 0,
      sizeKB: 0,
      laneCounts: {},
    });
  }

  // Intermediate directories are not entries: the scanner reports repositories and
  // unversioned project folders, not the plain directories between them. Without
  // synthesizing those, ~/Dev/work/api renders as a single row named "work/api" and
  // the levels the view exists to show are not there. These nodes carry no entry,
  // so they are pure structure and cannot be selected or acted on.
  const folderNodes = new Map<string, RepoTreeNode>();
  const folderFor = (basePath: string, baseNode: RepoTreeNode, segments: string[]): RepoTreeNode => {
    let parent = baseNode;
    let current = basePath;
    for (const segment of segments) {
      current = `${current}/${segment}`;
      let node = folderNodes.get(current);
      if (!node) {
        node = {
          id: `dir:${current}`,
          kind: 'root',
          name: segment,
          path: current,
          depth: 0,
          children: [],
          repoCount: 0,
          sizeKB: 0,
          laneCounts: {},
        };
        folderNodes.set(current, node);
        parent.children.push(node);
      }
      parent = node;
    }
    return parent;
  };

  const segmentsBetween = (ancestor: string, descendant: string): string[] => {
    if (!descendant.startsWith(`${ancestor}/`)) return [];
    return descendant.slice(ancestor.length + 1).split('/').filter(Boolean);
  };

  for (const entry of entries) {
    const node = repoNodes.get(entry.path)!;
    // `parent` is the deepest enclosing repository, and the single true nesting
    // edge. `children` cannot be used: it holds every descendant rather than the
    // direct ones, and the scanner omits plain folders from it entirely.
    const parentEntry = entry.parent ? byPath.get(entry.parent) : undefined;
    const parentNode = parentEntry ? repoNodes.get(parentEntry.path) : undefined;

    const base = parentNode && parentNode !== node ? parentEntry!.path : entry.root;
    const baseNode =
      parentNode && parentNode !== node
        ? parentNode
        : rootNodes.get(entry.root) ?? rootNodes.values().next().value!;

    // Everything above the entry's own folder becomes structure; the last segment
    // is the entry itself.
    const segments = segmentsBetween(base, entry.path);
    const attachTo = folderFor(base, baseNode, segments.slice(0, -1));
    attachTo.children.push(node);
  }

  const roll = (node: RepoTreeNode, depth: number) => {
    node.depth = depth;
    node.children.sort((a, b) => {
      // Folders first, then repositories, each alphabetical: a level reads as its
      // shape before its contents.
      if (!a.entry !== !b.entry) return a.entry ? 1 : -1;
      return a.name.localeCompare(b.name);
    });

    let repoCount = 0;
    let sizeKB = 0;
    const laneCounts: Partial<Record<RepoLaneId, number>> = {};

    if (node.entry) {
      repoCount += 1;
      sizeKB += node.entry.size.exclusive_kb;
      const lane = laneByPath.get(node.entry.path);
      if (lane) laneCounts[lane] = (laneCounts[lane] ?? 0) + 1;
    }

    for (const child of node.children) {
      roll(child, depth + 1);
      repoCount += child.repoCount;
      // A nested repository's bytes are already outside its parent's
      // `exclusive_kb`, so summing exclusive sizes down the tree is correct and
      // never double counts.
      sizeKB += child.sizeKB;
      for (const [lane, count] of Object.entries(child.laneCounts)) {
        const id = lane as RepoLaneId;
        laneCounts[id] = (laneCounts[id] ?? 0) + (count ?? 0);
      }
    }

    node.repoCount = repoCount;
    node.sizeKB = sizeKB;
    node.laneCounts = laneCounts;
  };

  const tree = [...rootNodes.values()].filter((node) => node.children.length > 0);
  for (const node of tree) roll(node, 0);
  tree.sort((a, b) => a.name.localeCompare(b.name));

  // A single scanned root is not worth a level of its own.
  if (tree.length === 1) {
    const only = tree[0];
    for (const child of only.children) roll(child, 0);
    return only.children;
  }
  return tree;
}

/** Flattens a tree to the rows currently visible, for roving focus and arrow keys. */
export function visibleTreeRows(nodes: RepoTreeNode[], expanded: Set<string>): RepoTreeNode[] {
  const rows: RepoTreeNode[] = [];
  const walk = (list: RepoTreeNode[]) => {
    for (const node of list) {
      rows.push(node);
      if (node.children.length > 0 && expanded.has(node.id)) walk(node.children);
    }
  };
  walk(nodes);
  return rows;
}

/** Text first, so a folder's state is never carried by colour alone. */
export function describeLaneCounts(laneCounts: Partial<Record<RepoLaneId, number>>): string {
  const parts: string[] = [];
  for (const lane of LANE_ORDER) {
    const count = laneCounts[lane];
    if (!count) continue;
    parts.push(`${count} ${LANE_SHORT[lane]}`);
  }
  return parts.join(', ');
}

// Read aloud on a chip, in place of its colour. Deliberately not the band title:
// a chip repeating the heading verbatim makes the heading ambiguous to find, for a
// test and for anyone navigating by headings.
export const LANE_STATE_WORD: Record<RepoLaneId, string> = {
  'no-backup': 'No backup',
  uncommitted: 'Uncommitted work',
  unconfirmed: 'Not confirmed on the remote',
  unknown: 'Not checked',
  'on-remote': 'Confirmed on the remote',
  archivable: 'Safe to archive',
};

export const LANE_SHORT: Record<RepoLaneId, string> = {
  'no-backup': 'with no backup',
  uncommitted: 'with uncommitted work',
  unconfirmed: 'not confirmed',
  unknown: 'unchecked',
  'on-remote': 'confirmed on the remote',
  archivable: 'safe to archive',
};
