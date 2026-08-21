import {
  LANE_ORDER,
  assignLanes,
  buildLaneContext,
  buildRepoTree,
  canArchive,
  canPush,
  displayName,
  laneOf,
  markersOf,
} from './repoLanes';
import type { RepoEntry } from '@/types';

// The assertions here are about a classifier that decides what the Repos page is
// allowed to offer. Anything it draws as further along than it is becomes a
// directory the user deletes by hand, so the properties that matter are totality
// (no repository silently vanishes) and exclusivity (no repository is described
// two ways at once).

function makeEntry(overrides: Partial<RepoEntry> = {}): RepoEntry {
  return {
    path: '/Users/x/Dev/example',
    rel_path: 'example',
    name: 'example',
    root: '/Users/x/Dev',
    kind: 'standalone',
    git_is_dir: true,
    remote: {
      name: 'origin',
      url: 'git@github.com:me/example.git',
      host: 'github.com',
      owner: 'me',
      repo: 'example',
      normalized: 'github.com/me/example',
      scheme: 'ssh',
      verify_ok: true,
      verify_attempted: true,
      missing: false,
      auth_failed: false,
      ambiguous: false,
    },
    ownership: 'own',
    has_commits: true,
    detached: false,
    bare_or_empty: false,
    stashes: 0,
    dirty: { tracked: 0, untracked: 0, total: 0 },
    submodules: { count: 0, dirty: 0 },
    activity: { last: '2026-01-01T00:00:00Z', source: 'branch main', days_idle: 200, cold: true },
    size: { total_kb: 2048, exclusive_kb: 2048 },
    gates: [],
    archivable: false,
    needs_push: false,
    push_blocked: false,
    ...overrides,
  };
}

const confirmedGates = [
  { id: 'refs_on_remote', label: 'Every branch is on the remote', ok: true },
  { id: 'tags_on_remote', label: 'Every tag is on the remote', ok: true },
];

describe('laneOf', () => {
  // Default to a verified report: the unverified path is asserted on its own,
  // because gate.go computes the ref gates as `verified && ...` and an unguarded
  // rule reading them would swallow an entire offline scan.
  const lane = (entry: RepoEntry, others: RepoEntry[] = [], verified = true) =>
    laneOf(entry, buildLaneContext([entry, ...others], verified));

  it('puts a folder with no git history in no-backup', () => {
    expect(lane(makeEntry({ kind: 'plain', remote: null, has_commits: false }))).toBe('no-backup');
  });

  it('puts an unreachable remote in no-backup even when it is otherwise clean', () => {
    const entry = makeEntry({
      gates: confirmedGates,
      remote: { ...makeEntry().remote!, missing: true, verify_ok: false },
    });
    expect(lane(entry)).toBe('no-backup');
  });

  it('keeps a repo with no commits out of on-remote however well the remote verified', () => {
    // The remote answering says nothing about a repository that has never
    // pushed anything to it.
    const entry = makeEntry({ has_commits: false, gates: confirmedGates });
    expect(lane(entry)).toBe('no-backup');
  });

  it('flags a clean parent whose nested child has no backup', () => {
    const child = makeEntry({
      path: '/Users/x/Dev/example/vendor',
      rel_path: 'example/vendor',
      name: 'vendor',
      kind: 'plain',
      remote: null,
      has_commits: false,
      parent: '/Users/x/Dev/example',
    });
    const parent = makeEntry({
      kind: 'nested_parent',
      children: [child.path],
      gates: confirmedGates,
    });

    expect(lane(parent, [child])).toBe('no-backup');
    expect(markersOf(parent, buildLaneContext([parent, child], true)).map((m) => m.id)).toContain(
      'children-at-risk'
    );
  });

  it('finds an unbacked descendant through parent edges, not the descendant list', () => {
    // `children` holds every descendant, so a direct-only check would miss this.
    const grandchild = makeEntry({
      path: '/r/a/b/c',
      rel_path: 'a/b/c',
      name: 'c',
      remote: null,
      parent: '/r/a/b',
    });
    const middle = makeEntry({ path: '/r/a/b', rel_path: 'a/b', name: 'b', parent: '/r/a', gates: confirmedGates });
    const top = makeEntry({ path: '/r/a', rel_path: 'a', name: 'a', kind: 'nested_parent', gates: confirmedGates });

    expect(lane(top, [middle, grandchild])).toBe('no-backup');
  });

  it('claims nothing for a remote that could not be told apart from a private one', () => {
    expect(lane(makeEntry({ remote: { ...makeEntry().remote!, ambiguous: true } }))).toBe('unknown');
    expect(lane(makeEntry({ remote: { ...makeEntry().remote!, auth_failed: true } }))).toBe('unknown');
  });

  it('claims nothing when the scan itself failed', () => {
    expect(lane(makeEntry({ scan_error: 'permission denied', gates: confirmedGates }))).toBe('unknown');
  });

  it('puts a clean repo from an unverified scan in unknown, never in on-remote', () => {
    // The default first scan is offline, so this is the commonest entry of all.
    expect(lane(makeEntry({ gates: [] }))).toBe('unknown');
  });

  it('does not call an offline scan unconfirmed just because the ref gates report unverified', () => {
    // gate.go writes refs_on_remote.ok = verified && ..., so on an offline report
    // both gates are present and failing for every repository on the machine.
    // Reading them without a verified guard would label the whole machine
    // "Committed, not confirmed on the remote" on first paint.
    const offlineGates = [
      { id: 'refs_on_remote', label: 'Every branch is on the remote', ok: false, detail: 'unverified' },
      { id: 'tags_on_remote', label: 'Every tag is on the remote', ok: false, detail: 'unverified' },
    ];
    expect(lane(makeEntry({ gates: offlineGates }), [], false)).toBe('unknown');
    expect(lane(makeEntry({ gates: offlineGates }))).toBe('unconfirmed');
  });

  it('claims nothing when the remote was contacted and simply could not be reached', () => {
    // Neither missing, nor ambiguous, nor an auth failure: a DNS or proxy error.
    const entry = makeEntry({
      gates: confirmedGates,
      remote: { ...makeEntry().remote!, verify_ok: false, verify_error: 'could not resolve host' },
    });
    expect(lane(entry)).toBe('unknown');
  });

  it('ranks unpushed commits above uncommitted files', () => {
    // A push can still save the commits. The uncommitted files were never
    // pushable, so they must not take the repo out of the pushable lane.
    const entry = makeEntry({ needs_push: true, dirty: { tracked: 2, untracked: 1, total: 3 } });
    expect(lane(entry)).toBe('unconfirmed');
    expect(canPush(entry)).toBe(true);
  });

  it('treats a branch that cannot be placed on the remote as unconfirmed even with nothing to push', () => {
    // needs_fetch: containment cannot be proven without fetching, and no push
    // resolves it.
    const entry = makeEntry({
      needs_push: false,
      gates: [
        { id: 'refs_on_remote', label: 'Every branch is on the remote', ok: false, detail: '1 branch could not be verified' },
        { id: 'tags_on_remote', label: 'Every tag is on the remote', ok: true },
      ],
    });
    expect(lane(entry)).toBe('unconfirmed');
  });

  it('positions dirt only when nothing more urgent applies', () => {
    const entry = makeEntry({ dirty: { tracked: 1, untracked: 0, total: 1 }, gates: confirmedGates });
    expect(lane(entry)).toBe('uncommitted');
  });

  it('reaches on-remote when both ref gates pass', () => {
    expect(lane(makeEntry({ gates: confirmedGates }))).toBe('on-remote');
  });

  it('reaches archivable, which outranks on-remote', () => {
    expect(lane(makeEntry({ archivable: true, gates: confirmedGates }))).toBe('archivable');
  });

  it('keeps a shared remote out of archivable but still reports it', () => {
    const entry = makeEntry({
      gates: [...confirmedGates, { id: 'remote_unique', label: 'Remote not shared', ok: false }],
      shared_with: ['/Users/x/Other/example'],
    });
    expect(lane(entry)).toBe('on-remote');
    expect(markersOf(entry, buildLaneContext([entry], true)).map((m) => m.id)).toContain('shared');
  });

  it('marks local-only files and stashes on a repo that is otherwise confirmed', () => {
    // Neither is a ref, so no ref check covers them.
    const entry = makeEntry({
      gates: confirmedGates,
      stashes: 3,
      local_only_files: ['.env', 'db.sqlite'],
    });
    expect(lane(entry)).toBe('on-remote');
    const ids = markersOf(entry, buildLaneContext([entry], true)).map((m) => m.id);
    expect(ids).toContain('stashes');
    expect(ids).toContain('local-only');
  });

  it('does not treat a linked worktree as unbacked, but refuses to claim a broken one', () => {
    expect(lane(makeEntry({ kind: 'worktree', git_is_dir: false, gates: confirmedGates }))).toBe('on-remote');
    expect(
      lane(
        makeEntry({
          kind: 'worktree',
          git_is_dir: false,
          gates: confirmedGates,
          worktree: { git_dir: '/gone/.git/worktrees/f', prunable: true, broken: true },
        })
      )
    ).toBe('unknown');
  });
});

describe('assignLanes', () => {
  // Every shape the scanner can emit, in one array.
  const entries: RepoEntry[] = [
    makeEntry({ path: '/r/plain', rel_path: 'plain', kind: 'plain', remote: null, has_commits: false }),
    makeEntry({ path: '/r/clean-unverified', rel_path: 'clean-unverified', gates: [] }),
    makeEntry({
      path: '/r/third-party',
      rel_path: 'third-party',
      ownership: 'third_party',
      needs_push: true,
      push_blocked: true,
      push_blocked_by: 'remote belongs to someone else',
    }),
    makeEntry({
      path: '/r/dirty-unpushed',
      rel_path: 'dirty-unpushed',
      needs_push: true,
      dirty: { tracked: 3, untracked: 2, total: 5 },
    }),
    makeEntry({
      path: '/r/broken-worktree',
      rel_path: 'broken-worktree',
      kind: 'worktree',
      git_is_dir: false,
      worktree: { main_repo: '/elsewhere/main', git_dir: '/gone', prunable: true, broken: true },
    }),
    makeEntry({ path: '/r/auth', rel_path: 'auth', remote: { ...makeEntry().remote!, auth_failed: true } }),
    makeEntry({ path: '/r/ambiguous', rel_path: 'ambiguous', remote: { ...makeEntry().remote!, ambiguous: true } }),
    makeEntry({ path: '/r/needs-fetch', rel_path: 'needs-fetch', gates: [{ id: 'refs_on_remote', label: 'refs', ok: false }] }),
    makeEntry({ path: '/r/confirmed', rel_path: 'confirmed', gates: confirmedGates }),
    makeEntry({ path: '/r/archivable', rel_path: 'archivable', archivable: true, gates: confirmedGates }),
    makeEntry({ path: '/r/dirty', rel_path: 'dirty', dirty: { tracked: 1, untracked: 0, total: 1 }, gates: confirmedGates }),
  ];

  it('places every entry in exactly one lane', () => {
    const { groups, laneByPath } = assignLanes(entries, true);
    const total = LANE_ORDER.reduce((sum, lane) => sum + groups[lane].length, 0);
    expect(total).toBe(entries.length);
    expect(laneByPath.size).toBe(entries.length);

    const seen = new Set<string>();
    for (const lane of LANE_ORDER) {
      for (const entry of groups[lane]) {
        expect(seen.has(entry.path)).toBe(false);
        seen.add(entry.path);
      }
    }
  });

  it('never offers push for a repository the shell would refuse', () => {
    const blocked = entries.find((entry) => entry.path === '/r/third-party')!;
    expect(blocked.needs_push).toBe(true);
    expect(canPush(blocked)).toBe(false);
  });

  it('never offers archive from an unverified report', () => {
    const archivable = entries.find((entry) => entry.path === '/r/archivable')!;
    expect(canArchive(archivable, false)).toBe(false);
    expect(canArchive(archivable, true)).toBe(true);
  });
});

describe('displayName', () => {
  it('falls back to the folder name when the root is itself a repository', () => {
    expect(displayName(makeEntry({ rel_path: '.', name: 'Dev' }))).toBe('Dev');
  });

  it('keeps the relative path when there is one', () => {
    expect(displayName(makeEntry({ rel_path: 'work/api' }))).toBe('work/api');
  });
});

describe('buildRepoTree', () => {
  it('renders a grandchild once, from parent edges rather than the descendant list', () => {
    // `children` holds every descendant, not the direct ones, so a walk over it
    // would draw the grandchild under both ancestors.
    const grandparent = makeEntry({
      path: '/r/a',
      rel_path: 'a',
      name: 'a',
      root: '/r',
      children: ['/r/a/b', '/r/a/b/c'],
    });
    const parent = makeEntry({
      path: '/r/a/b',
      rel_path: 'a/b',
      name: 'b',
      root: '/r',
      parent: '/r/a',
      children: ['/r/a/b/c'],
    });
    const child = makeEntry({ path: '/r/a/b/c', rel_path: 'a/b/c', name: 'c', root: '/r', parent: '/r/a/b' });

    const tree = buildRepoTree([grandparent, parent, child], ['/r'], true);
    const flatten = (nodes: typeof tree): string[] =>
      nodes.flatMap((node) => [node.id, ...flatten(node.children)]);
    const ids = flatten(tree);

    expect(ids.filter((id) => id === '/r/a/b/c')).toHaveLength(1);
    expect(tree).toHaveLength(1);
    expect(tree[0].repoCount).toBe(3);
  });

  // prunePlain in cmd/repos/discover.go drops a plain folder that has a kept repo
  // ancestor, so this shape does not occur in a real report. It is asserted anyway
  // because the tree is built from `parent`, and a future scanner change that does
  // emit one must not make a node disappear.
  it('keeps a plain folder nested inside a repository, which the descendant list omits', () => {
    const parent = makeEntry({ path: '/r/a', rel_path: 'a', name: 'a', root: '/r', children: [] });
    const plain = makeEntry({
      path: '/r/a/notes',
      rel_path: 'a/notes',
      name: 'notes',
      root: '/r',
      kind: 'plain',
      remote: null,
      has_commits: false,
      parent: '/r/a',
    });

    const tree = buildRepoTree([parent, plain], ['/r'], true);
    expect(tree[0].children.map((node) => node.id)).toContain('/r/a/notes');
    // Two: the folder itself, and the repository that encloses it, because
    // archiving the parent would take the folder with it.
    expect(tree[0].laneCounts['no-backup']).toBe(2);
  });

  it('keeps two roots apart when their relative paths collide', () => {
    const a = makeEntry({ path: '/one/foo', rel_path: 'foo', name: 'foo', root: '/one' });
    const b = makeEntry({ path: '/two/foo', rel_path: 'foo', name: 'foo', root: '/two' });

    const tree = buildRepoTree([a, b], ['/one', '/two'], true);
    expect(tree).toHaveLength(2);
    expect(tree.map((node) => node.id)).toEqual(['root:/one', 'root:/two']);
  });

  it('sums exclusive size so a nested repository is not counted twice', () => {
    const parent = makeEntry({
      path: '/r/a',
      root: '/r',
      size: { total_kb: 680000, exclusive_kb: 2048 },
      children: ['/r/a/b'],
    });
    const child = makeEntry({
      path: '/r/a/b',
      root: '/r',
      parent: '/r/a',
      size: { total_kb: 4096, exclusive_kb: 4096 },
    });

    const tree = buildRepoTree([parent, child], ['/r'], true);
    expect(tree[0].sizeKB).toBe(2048 + 4096);
  });

  it('attaches a worktree whose main repository was never scanned at root level', () => {
    const orphan = makeEntry({
      path: '/r/wt',
      rel_path: 'wt',
      name: 'wt',
      root: '/r',
      kind: 'worktree',
      git_is_dir: false,
      worktree: { main_repo: '/elsewhere/main', prunable: false, broken: false },
    });

    const tree = buildRepoTree([orphan], ['/r'], true);
    expect(tree.map((node) => node.id)).toEqual(['/r/wt']);
  });
});
