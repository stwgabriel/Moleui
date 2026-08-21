import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ReposPage } from './ReposPage';
import { categorize, isAtRisk } from '@/hooks/useRepos';
import type { RepoEntry, RepoReport } from '@/types';

// The assertions here are about refusals and about what the user is told. A page
// that offers to delete directories has to be provably unable to offer that for
// anything it has not confirmed is stored elsewhere.
//
// Several queries here changed shape when the per-row expander became a single
// inspector pane: selecting a repository is now clicking its chip, and the detail
// that used to sit under the row is in the pane. The refusals being asserted are
// unchanged, and in two cases the page now refuses harder than it did.

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

function makeReport(entries: RepoEntry[], verified = true): RepoReport {
  return {
    version: 1,
    scanned_at: '2026-07-25T00:00:00Z',
    roots: ['/Users/x/Dev'],
    cold_days: 7,
    verified,
    entries,
    summary: {
      total: entries.length,
      repos: entries.filter((e) => e.kind !== 'plain').length,
      plain: entries.filter((e) => e.kind === 'plain').length,
      worktrees: 0,
      no_remote: 0,
      third_party: 0,
      needs_push: entries.filter((e) => e.needs_push).length,
      dirty: 0,
      cold: entries.filter((e) => e.activity.cold).length,
      archivable: entries.filter((e) => e.archivable).length,
      reclaimable_kb: entries.filter((e) => e.archivable).reduce((s, e) => s + e.size.exclusive_kb, 0),
      total_kb: entries.reduce((s, e) => s + e.size.exclusive_kb, 0),
      remote_conflict: 0,
      unverified: 0,
      remote_missing: entries.filter((e) => e.remote?.missing).length,
      auth_failed: 0,
      no_backup: entries.filter(isAtRisk).length,
    },
    duration_ms: 10,
  };
}

function mockRepos(report: RepoReport) {
  const api = {
    scan: vi.fn().mockResolvedValue({
      ok: true,
      command: 'repos --json',
      exitCode: 0,
      stdout: JSON.stringify(report),
      stderr: '',
    }),
    killScan: vi.fn().mockResolvedValue({ ok: true, message: '' }),
    gate: vi.fn(),
    push: vi.fn().mockResolvedValue({ ok: true, command: '', exitCode: 0, stdout: '', stderr: '' }),
    killPush: vi.fn(),
    archive: vi.fn().mockResolvedValue({ ok: true, command: '', exitCode: 0, stdout: '', stderr: '' }),
    killArchive: vi.fn(),
    getRoots: vi.fn().mockResolvedValue({ ok: true, roots: ['/Users/x/Dev'] }),
    setRoots: vi.fn(),
    chooseRoot: vi.fn(),
    onScanStdout: vi.fn(),
    onPushStdout: vi.fn(),
    onPushStderr: vi.fn(),
    onArchiveStdout: vi.fn(),
    onArchiveStderr: vi.fn(),
    removeListeners: vi.fn(),
  };
  window.moleDesktop = { repos: api } as unknown as typeof window.moleDesktop;
  return api;
}

async function startRepoScan() {
  fireEvent.click(await screen.findByRole('button', { name: /scan repositories/i }));
}

describe('categorize', () => {
  it('puts a repo with a deleted remote in at-risk, ahead of every other signal', () => {
    const entry = makeEntry({
      archivable: false,
      remote: { ...makeEntry().remote!, missing: true, verify_ok: false, verify_error: 'Repository not found.' },
    });
    const buckets = categorize([entry]);
    expect(buckets['at-risk']).toHaveLength(1);
    expect(buckets.blocked).toHaveLength(0);
  });

  it('treats a folder with no git history as at-risk, never archivable', () => {
    const entry = makeEntry({ kind: 'plain', remote: null, has_commits: false });
    expect(isAtRisk(entry)).toBe(true);
    expect(categorize([entry])['at-risk']).toHaveLength(1);
  });

  it('does not treat a linked worktree as at-risk, since its objects live in the main repo', () => {
    const entry = makeEntry({ kind: 'worktree', git_is_dir: false });
    expect(isAtRisk(entry)).toBe(false);
  });

  it('keeps push-blocked repos out of the pushable bucket', () => {
    const entry = makeEntry({
      needs_push: true,
      push_blocked: true,
      push_blocked_by: 'remote belongs to someone else',
    });
    const buckets = categorize([entry]);
    expect(buckets['needs-push']).toHaveLength(0);
    expect(buckets.blocked).toHaveLength(1);
  });
});

describe('ReposPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('runs an offline scan after start and does not contact remotes unasked', async () => {
    const api = mockRepos(makeReport([makeEntry()], false));
    render(<ReposPage />);
    await startRepoScan();
    await waitFor(() => expect(api.scan).toHaveBeenCalled());
    expect(api.scan).toHaveBeenCalledWith({ verify: false, coldDays: undefined });
  });

  it('renders a duplicated scan path as one folder card', async () => {
    mockRepos(makeReport([makeEntry(), makeEntry({ name: 'duplicate-name' })], false));
    render(<ReposPage />);
    await startRepoScan();

    await waitFor(() => expect(screen.getByText('example')).toBeInTheDocument());
    expect(screen.getAllByRole('button', { name: /Inspect example/ })).toHaveLength(1);
  });

  it('keeps an offline scan compact while offering the remote check in the header', async () => {
    mockRepos(makeReport([makeEntry()], false));
    render(<ReposPage />);
    await startRepoScan();
    await waitFor(() => expect(screen.getByRole('button', { name: /check remotes/i })).toBeInTheDocument());
  });

  it('surfaces an unreachable remote as having no backup', async () => {
    const entry = makeEntry({
      rel_path: 'orphaned-project',
      remote: {
        ...makeEntry().remote!,
        missing: true,
        verify_ok: false,
        verify_error: 'Repository not found.',
      },
    });
    mockRepos(makeReport([entry]));
    render(<ReposPage />);
    await startRepoScan();

    await waitFor(() => expect(screen.getByText('orphaned-project')).toBeInTheDocument());
    expect(screen.getByText(/No backup anywhere/i)).toBeInTheDocument();
  });

  it('offers no archive action until a repository passes the gate', async () => {
    mockRepos(makeReport([makeEntry({ archivable: false, needs_push: false })]));
    render(<ReposPage />);
    await startRepoScan();
    await waitFor(() => expect(screen.getByText('example')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /Archive/i })).not.toBeInTheDocument();
  });

  it('requires a second click before archiving, and sends only the selected paths', async () => {
    const entry = makeEntry({ archivable: true });
    const api = mockRepos(makeReport([entry]));
    render(<ReposPage />);
    await startRepoScan();

    await waitFor(() => expect(screen.getByText('example')).toBeInTheDocument());

    fireEvent.click(screen.getByLabelText(/Select example/));

    // First click only arms the action.
    fireEvent.click(screen.getByRole('button', { name: /^Archive 1$/i }));
    expect(api.archive).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Move 1 to Trash/i }));
    await waitFor(() => expect(api.archive).toHaveBeenCalledTimes(1));
    expect(api.archive).toHaveBeenCalledWith([entry.path], { dryRun: false, vault: true });
  });

  it('refuses to offer archiving at all when the scan was not verified', async () => {
    // Selection is available for Sync even when an offline report cannot prove
    // a repository is archivable. Archive remains unavailable.
    mockRepos(makeReport([makeEntry({ archivable: true })], false));
    render(<ReposPage />);
    await startRepoScan();

    await waitFor(() => expect(screen.getByText('example')).toBeInTheDocument());

    expect(screen.getByLabelText(/Select example/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Archive/i })).not.toBeInTheDocument();
  });

  it('disarms a pending archive when the selection changes at the same count', async () => {
    // Keying the armed state on a count let a user confirm one set and have a
    // different set of the same size be the one that moved.
    const first = makeEntry({ path: '/Users/x/Dev/one', rel_path: 'one', name: 'one', archivable: true });
    const second = makeEntry({ path: '/Users/x/Dev/two', rel_path: 'two', name: 'two', archivable: true });
    const api = mockRepos(makeReport([first, second]));
    render(<ReposPage />);
    await startRepoScan();

    await waitFor(() => expect(screen.getByText('one')).toBeInTheDocument());

    fireEvent.click(screen.getByLabelText(/Select one/));
    fireEvent.click(screen.getByRole('button', { name: /^Archive 1$/i }));
    expect(screen.getByRole('button', { name: /Move 1 to Trash/i })).toBeInTheDocument();

    // Same count, different repository.
    fireEvent.click(screen.getByLabelText(/Select two/));
    fireEvent.click(screen.getByLabelText(/Select one/));

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /Move 1 to Trash/i })).not.toBeInTheDocument()
    );
    expect(api.archive).not.toHaveBeenCalled();
  });

  it('explains what blocks an idle repository from being archived', async () => {
    const entry = makeEntry({
      archivable: false,
      blocked_by: ['no_stashes'],
      stashes: 2,
      gates: [
        { id: 'clean_tree', label: 'No uncommitted changes', ok: true },
        {
          id: 'no_stashes',
          label: 'No stashes',
          ok: false,
          detail: '2 stashes exist only on this machine',
        },
      ],
    });
    mockRepos(makeReport([entry]));
    render(<ReposPage />);
    await startRepoScan();

    await waitFor(() => expect(screen.getByText('example')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /example/ }));

    await waitFor(() =>
      expect(screen.getByText(/2 stashes exist only on this machine/i)).toBeInTheDocument()
    );
  });

  it('reports exclusive size so nested repos are not counted twice', async () => {
    const entry = makeEntry({
      kind: 'nested_parent',
      children: ['/Users/x/Dev/example/child'],
      size: { total_kb: 680000, exclusive_kb: 2048 },
    });
    mockRepos(makeReport([entry]));
    render(<ReposPage />);
    await startRepoScan();

    await waitFor(() => expect(screen.getByText('example')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /example/ }));
    fireEvent.click(await screen.findByRole('button', { name: /^Details$/ }));

    await waitFor(() => expect(screen.getByText(/excluding nested repos/i)).toBeInTheDocument());
  });

  it('removes the layout proposal and shows the repository total instead', async () => {
    const report = makeReport([makeEntry()]);
    report.organize = [
      {
        from: '/Users/x/Dev/example',
        to: '/Users/x/Dev/Archive/example',
        reason: 'idle 200 days and fully pushed',
        risk: '',
        safe: true,
      },
    ];
    mockRepos(report);
    render(<ReposPage />);
    await startRepoScan();

    await waitFor(() => expect(screen.getByText(/1 repositories.*2\.0 MB total/i)).toBeInTheDocument());
    expect(screen.queryByRole('tab', { name: /Layout plan/i })).not.toBeInTheDocument();
  });

  it('tells the user to prune an orphaned worktree rather than delete the folder', async () => {
    const entry = makeEntry({
      rel_path: 'worktrees/feature',
      kind: 'worktree',
      git_is_dir: false,
      worktree: { main_repo: '/Users/x/Dev/main', git_dir: '/gone/.git/worktrees/feature', prunable: true, broken: true },
    });
    mockRepos(makeReport([entry]));
    render(<ReposPage />);
    await startRepoScan();

    await waitFor(() => expect(screen.getByText('worktrees/feature')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /worktrees\/feature/ }));

    await waitFor(() => expect(screen.getByText(/git worktree prune/i)).toBeInTheDocument());
  });
});
