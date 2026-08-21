import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { StartScreen } from '@/components/common/StartScreen';
import { StageTransition } from '@/components/common/StageTransition';
import { cn } from '@/utils/cn';
import { featureAccentVars } from '@/lib/featureAccents';
import { assignLanes, canArchive, canPush } from '@/lib/repoLanes';
import { useRepos } from '@/hooks/useRepos';
import { formatKB } from '@/hooks/useRepos';
import { presentRepositories, displayedRepositorySize } from '@/lib/repoPresentation';
import { ReposHeader } from '@/components/repos/ReposHeader';
import { RepoGrid } from '@/components/repos/RepoGrid';
import { RepoInspector } from '@/components/repos/RepoInspector';
import { ReposActionBar } from '@/components/repos/ReposActionBar';
import { OutputDrawer } from '@/components/repos/OutputDrawer';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { ACCENT_WASH, META_TEXT, SOFT_CARD } from '@/components/repos/chrome';
import type { PageConfig } from '@/types';

interface ReposPageProps {
  active?: boolean;
}

const LOG_LIMIT = 400;

const config: PageConfig = {
  title: 'Repositories',
  description: 'One clear view of your projects and their remotes.',
  icon: 'GitBranch',
  buttonText: 'Scan Repositories',
  items: [
    {
      icon: 'FolderSearch',
      title: 'Scan projects',
      description: 'Find repositories in the folders you choose.',
    },
    {
      icon: 'ShieldCheck',
      title: 'Keep worktrees together',
      description: 'See each project once, with its worktrees in the details.',
    },
    {
      icon: 'GitPullRequest',
      title: 'Sync intentionally',
      description: 'Choose exactly which repositories to sync.',
    },
  ],
};

export function ReposPage({ active = true }: ReposPageProps) {
  const { report, loading, verifying, error, roots, scan, cancelScan, addRoot, removeRoot } = useRepos();

  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | 'push' | 'archive'>(null);
  const [syncing, setSyncing] = useState(false);
  const [profiles, setProfiles] = useState<Array<{ login: string; active: boolean }>>([]);
  const [profile, setProfile] = useState('');
  const [askBeforeCreate, setAskBeforeCreate] = useState(true);
  const [pendingSyncPaths, setPendingSyncPaths] = useState<string[] | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [logTruncated, setLogTruncated] = useState(false);
  const [failedAt, setFailedAt] = useState<number | null>(null);
  const [status, setStatus] = useState('');
  const [hasScanned, setHasScanned] = useState(false);
  const [started, setStarted] = useState(false);

  // Once the user starts the page, run the fast, offline pass so it has content immediately.
  // Verification is a deliberate second step: it hits the network for every
  // distinct remote and can take minutes on a machine with dozens of repos.
  useEffect(() => {
    if (!active || !started || hasScanned) return;
    setHasScanned(true);
    void scan({ verify: false });
  }, [active, hasScanned, scan, started]);

  useEffect(() => {
    const api = window.moleDesktop?.repos;
    if (!api) return;
    const append = (text: string) => {
      setLog((previous) => {
        const next = [...previous, ...text.split('\n').filter(Boolean)];
        if (next.length > LOG_LIMIT) {
          setLogTruncated(true);
          return next.slice(-LOG_LIMIT);
        }
        return next;
      });
    };
    api.onPushStdout(append);
    api.onPushStderr(append);
    api.onArchiveStdout(append);
    api.onArchiveStderr(append);
    api.onSyncStdout?.(append);
    api.onSyncStderr?.(append);
    return () => api.removeListeners();
  }, []);

  useEffect(() => {
    const api = window.moleDesktop?.repos;
    if (!api?.getProfiles) return;
    void api.getProfiles().then((result) => {
      if (!result?.ok) return;
      setProfiles(result.profiles);
      setProfile(result.profile);
      setAskBeforeCreate(result.askBeforeCreate);
    });
  }, []);

  const verified = report?.verified ?? false;
  const reportEntries = report?.entries ?? [];
  // Keep one identity per path all the way through grouping and action payloads.
  // The grid also guards its own display, but actions must never count or send a
  // duplicated repository if a scanner report contains one.
  const entries = useMemo(
    () => Array.from(new Map(reportEntries.map((entry) => [entry.path, entry])).values()),
    [reportEntries]
  );

  const { groups, laneByPath, context } = useMemo(
    () => assignLanes(entries, verified),
    [entries, verified]
  );
  const repositories = useMemo(() => presentRepositories(entries), [entries]);
  const repositorySize = useMemo(() => displayedRepositorySize(repositories), [repositories]);

  // A new report invalidates only paths that vanished. Selection also drives
  // sync, so a local-only repository remains selectable even before it has a
  // remote or an archive verdict.
  const reportStamp = report?.scanned_at ?? '';
  useEffect(() => {
    if (!report) return;
    setSelected((previous) => {
      if (previous.size === 0) return previous;
      const next = new Set<string>();
      for (const entry of report.entries) {
        if (!previous.has(entry.path)) continue;
        if (entry.kind !== 'worktree') next.add(entry.path);
      }
      return next.size === previous.size ? previous : next;
    });
    setCurrentPath((previous) =>
      previous && report.entries.some((entry) => entry.path === previous) ? previous : null
    );
  }, [report, reportStamp]);

  const toggle = useCallback((path: string) => {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const runPush = useCallback(
    async (paths: string[], dryRun: boolean) => {
      const api = window.moleDesktop?.repos;
      if (!api || paths.length === 0) return;
      setBusy('push');
      setLog([]);
      setLogTruncated(false);
      setFailedAt(null);
      setStatus(dryRun ? 'Previewing push' : `Pushing ${paths.length} repositories`);
      const result = await api.push(paths, { dryRun });
      setBusy(null);
      if (result?.ok) {
        setStatus(dryRun ? 'Dry run finished' : 'Push finished');
        toast.success(dryRun ? 'Dry run finished. Nothing was pushed.' : `Pushed ${paths.length} repositories.`);
        if (!dryRun) void scan({ verify: true });
      } else {
        setFailedAt(Date.now());
        setStatus('Some repositories could not be pushed');
        toast.error(result?.stderr?.trim() || 'Some repositories could not be pushed.');
      }
    },
    [scan]
  );

  const runArchive = useCallback(
    async (paths: string[], options: { dryRun: boolean; vault: boolean }) => {
      const api = window.moleDesktop?.repos;
      if (!api || paths.length === 0) return;
      setBusy('archive');
      setLog([]);
      setLogTruncated(false);
      setFailedAt(null);
      setStatus(options.dryRun ? 'Previewing archive' : `Moving ${paths.length} repositories to the Trash`);
      const result = await api.archive(paths, { dryRun: options.dryRun, vault: options.vault });
      setBusy(null);
      if (result?.ok) {
        setStatus(options.dryRun ? 'Dry run finished' : 'Archive finished');
        toast.success(
          options.dryRun ? 'Dry run finished. Nothing was moved.' : `Moved ${paths.length} repositories to the Trash.`
        );
        if (!options.dryRun) {
          setSelected(new Set());
          void scan({ verify: true });
        }
      } else {
        setFailedAt(Date.now());
        setStatus('Nothing was archived');
        toast.error(result?.stderr?.trim() || 'Nothing was archived.');
      }
    },
    [scan]
  );

  const runSync = useCallback(async (paths: string[], createMissing: boolean) => {
    const api = window.moleDesktop?.repos;
    if (!api?.sync || paths.length === 0) return;
    if (!profile) {
      toast.error('Choose a GitHub profile before syncing.');
      return;
    }
    setSyncing(true);
    setLog([]);
    setLogTruncated(false);
    setFailedAt(null);
    setStatus(`Syncing ${paths.length} repositories`);
    const result = await api.sync(paths, { profile, createMissing });
    setSyncing(false);
    if (result?.ok) {
      setStatus('Sync finished');
      toast.success(`Synced ${paths.length} repositories.`);
      void scan({ verify: true });
    } else {
      setFailedAt(Date.now());
      setStatus('Some repositories could not be synced');
      toast.error(result?.stderr?.trim() || 'Some repositories could not be synced.');
    }
  }, [profile, scan]);

  const requestSync = useCallback((paths: string[]) => {
    const includesNoRemote = paths.some((path) => entries.find((entry) => entry.path === path)?.kind !== 'plain' && !entries.find((entry) => entry.path === path)?.remote);
    if (includesNoRemote && askBeforeCreate) {
      setPendingSyncPaths(paths);
      return;
    }
    void runSync(paths, includesNoRemote);
  }, [askBeforeCreate, entries, runSync]);

  const saveSyncPreferences = useCallback(async (next: { profile?: string; askBeforeCreate?: boolean }) => {
    const api = window.moleDesktop?.repos;
    if (!api?.setSyncPreferences) return;
    const result = await api.setSyncPreferences(next);
    if (!result?.ok) return;
    setProfile(result.profile);
    setAskBeforeCreate(result.askBeforeCreate);
  }, []);

  const selectedPushable = useMemo(
    () => groups.unconfirmed.filter((entry) => selected.has(entry.path) && canPush(entry)),
    [groups.unconfirmed, selected]
  );
  const selectedArchivable = useMemo(
    () => groups.archivable.filter((entry) => selected.has(entry.path) && canArchive(entry, verified)),
    [groups.archivable, selected, verified]
  );
  const selectedRepositories = useMemo(
    () => repositories.map(({ entry }) => entry).filter((entry) => selected.has(entry.path)),
    [repositories, selected]
  );

  const currentEntry = useMemo(
    () => entries.find((entry) => entry.path === currentPath) ?? null,
    [entries, currentPath]
  );

  const checkRemotes = useCallback(() => void scan({ verify: true }), [scan]);
  const workspace = (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden pt-1" style={featureAccentVars('repos')}>
      <div className={ACCENT_WASH} />

      {/* One status node per surface. The page sits inside an aria-live region, so
          without this every re-render of a list would be announced. */}
      <p role="status" aria-live="polite" className="sr-only">
        {status}
      </p>

      <div className="relative flex min-h-0 flex-1 flex-col">
        <ReposHeader
          roots={roots}
          loading={loading}
          verifying={verifying}
          onAddRoot={() => void addRoot()}
          onRemoveRoot={(root) => void removeRoot(root)}
          onRescan={() => void scan({ verify: false })}
          onCheckRemotes={checkRemotes}
          onStop={() => void cancelScan()}
        />

        {error && (
          <div className="shrink-0 px-5 pt-3">
            <p className="rounded-[1.25rem] bg-red-500/10 px-4 py-3 text-[0.85rem] font-semibold text-red-700 dark:text-red-300">
              {error}
            </p>
          </div>
        )}

        <div className="flex shrink-0 items-center justify-between gap-3 px-5 pt-3">
          <span className={cn('text-[0.78rem] font-semibold', META_TEXT)}>
            {repositories.length} repositories · {formatKB(repositorySize)} total
          </span>
          {report?.scanned_at && <span className={cn('text-[0.72rem]', META_TEXT)}>Scanned {new Date(report.scanned_at).toLocaleTimeString()}</span>}
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 px-5 pt-2">
          <div className="flex items-center gap-2">
            <label className={cn('text-[0.72rem] font-semibold', META_TEXT)} htmlFor="repo-github-profile">GitHub</label>
            <select
              id="repo-github-profile"
              value={profile}
              onChange={(event) => void saveSyncPreferences({ profile: event.target.value })}
              className="rounded-lg border border-white/60 bg-white/55 px-2 py-1 text-xs font-semibold text-slate-700 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-200"
              disabled={profiles.length === 0 || syncing}
            >
              {profiles.length === 0 ? <option value="">No signed-in account</option> : profiles.map((account) => <option key={account.login} value={account.login}>{account.login}</option>)}
            </select>
          </div>
          <Button variant="glass" size="sm" onClick={() => requestSync(repositories.map(({ entry }) => entry.path))} disabled={!profile || syncing || repositories.length === 0}>
            {syncing ? 'Syncing…' : 'Sync all'}
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden px-5 pb-3 pt-3">
          {!report && loading ? (
            <ScanSkeleton />
          ) : entries.length === 0 && !loading ? (
            <div className={cn('p-8 text-center', SOFT_CARD)}>
              <p className={META_TEXT}>No repositories found under the folders above.</p>
            </div>
          ) : (
            <div
              className={cn(
                'grid h-full min-h-0 gap-3',
                'lg:grid-cols-[minmax(0,1fr)_minmax(20rem,22rem)]'
              )}
            >
              <div
                role="tabpanel"
                aria-label="Repositories"
                className="min-h-0 overflow-y-auto pr-1 custom-scrollbar"
                aria-busy={loading}
              >
                <RepoGrid
                  repositories={repositories}
                  laneByPath={laneByPath}
                  context={context}
                  selected={selected}
                  currentPath={currentPath}
                  onToggle={toggle}
                  onInspect={setCurrentPath}
                />
              </div>

              <div className="hidden min-h-0 lg:block">
                <RepoInspector
                  entry={currentEntry}
                  worktrees={currentEntry ? repositories.find((repository) => repository.entry.path === currentEntry.path)?.worktrees : []}
                  lane={currentPath ? laneByPath.get(currentPath) ?? null : null}
                  context={context}
                  scannedAt={report?.scanned_at}
                  onClose={() => setCurrentPath(null)}
                />
              </div>
            </div>
          )}
        </div>

        <OutputDrawer log={log} failedAt={failedAt} truncated={logTruncated} />

        <ReposActionBar
          busy={busy}
          verified={verified}
          pushable={selectedPushable}
          archivable={selectedArchivable}
          totalSelected={selected.size}
          syncable={selectedRepositories}
          syncing={syncing}
          onSync={(paths) => requestSync(paths)}
          onPush={(dryRun) => void runPush(selectedPushable.map((entry) => entry.path), dryRun)}
          onArchive={(dryRun, vault) =>
            void runArchive(selectedArchivable.map((entry) => entry.path), { dryRun, vault })
          }
          onClear={() => setSelected(new Set())}
        />
      </div>
      <Sheet
        open={Boolean(pendingSyncPaths)}
        onClose={() => setPendingSyncPaths(null)}
        title="Create private repositories?"
        description="Selected local repositories without a remote will be created as private repositories in the chosen GitHub account, then pushed."
        role="alertdialog"
        footer={<div className="flex justify-end gap-2"><Button variant="glass" size="sm" onClick={() => setPendingSyncPaths(null)}>Cancel</Button><Button variant="glass-danger" size="sm" onClick={() => { const paths = pendingSyncPaths; setPendingSyncPaths(null); if (paths) void runSync(paths, true); }}>Create private and sync</Button></div>}
      >
        <label className={cn('flex cursor-pointer items-center gap-2 text-sm font-semibold', META_TEXT)}>
          <input type="checkbox" checked={askBeforeCreate} onChange={(event) => void saveSyncPreferences({ askBeforeCreate: event.target.checked })} />
          Ask every time
        </label>
      </Sheet>
    </div>
  );

  return (
    <div className="relative h-full min-h-0" style={featureAccentVars('repos')}>
      <StageTransition viewKey={started ? 'workspace' : 'start'}>
        {started ? workspace : <StartScreen config={config} onStart={() => setStarted(true)} variant="feature" />}
      </StageTransition>
    </div>
  );
}

// First paint after a scan starts has nothing to show, and an empty band layout
// reads as "no repositories" rather than "still looking".
function ScanSkeleton() {
  return (
    <div className="space-y-3" aria-hidden="true">
      {[0, 1, 2].map((index) => (
        <div key={index} className={cn('p-4', SOFT_CARD)}>
          <div className="mole-skeleton h-4 w-48 rounded-full" />
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div className="mole-skeleton h-10 rounded-[1.25rem]" />
            <div className="mole-skeleton h-10 rounded-[1.25rem]" />
          </div>
        </div>
      ))}
    </div>
  );
}
