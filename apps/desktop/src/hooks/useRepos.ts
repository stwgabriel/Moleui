import { useCallback, useEffect, useRef, useState } from 'react';
import type { RepoEntry, RepoReport } from '@/types';

// Wraps the mole:repos:* IPC surface.
//
// Two ideas drive the shape of this hook. First, a scan without --verify is fast
// but cannot prove anything is backed up, so `verified` is tracked separately
// and the UI gates destructive actions on it. Second, the report is a snapshot:
// the shell re-checks every precondition against the network before it archives
// anything, so a stale snapshot here can only ever produce a refusal, never a
// wrong deletion.

export type RepoCategory =
  | 'at-risk'
  | 'needs-push'
  | 'archivable'
  | 'blocked'
  | 'active';

export interface RepoBucket {
  id: RepoCategory;
  entries: RepoEntry[];
}

interface UseReposState {
  report: RepoReport | null;
  loading: boolean;
  verifying: boolean;
  error: string | null;
  roots: string[];
  lastScanAt: number | null;
}

export function useRepos() {
  const [state, setState] = useState<UseReposState>({
    report: null,
    loading: false,
    verifying: false,
    error: null,
    roots: [],
    lastScanAt: null,
  });
  // Guards against a resolved scan from a previous request overwriting a newer
  // one, and against setState after the page unmounts.
  const requestRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      window.moleDesktop?.repos?.removeListeners();
    };
  }, []);

  const loadRoots = useCallback(async () => {
    const api = window.moleDesktop?.repos;
    if (!api) return;
    const result = await api.getRoots();
    if (!mountedRef.current) return;
    setState((prev) => ({ ...prev, roots: result?.roots ?? [] }));
  }, []);

  useEffect(() => {
    void loadRoots();
  }, [loadRoots]);

  const scan = useCallback(async (options?: { verify?: boolean; coldDays?: number }) => {
    const api = window.moleDesktop?.repos;
    if (!api) {
      setState((prev) => ({
        ...prev,
        error: 'This build has no repo scanner. Rebuild the desktop runtime to enable it.',
      }));
      return;
    }

    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    const verify = options?.verify ?? false;

    setState((prev) => ({ ...prev, loading: true, verifying: verify, error: null }));

    const result = await api.scan({ verify, coldDays: options?.coldDays });

    if (!mountedRef.current || requestRef.current !== requestId) return;

    if (!result?.ok) {
      setState((prev) => ({
        ...prev,
        loading: false,
        verifying: false,
        error: result?.stderr?.trim() || 'The repository scan failed.',
      }));
      return;
    }

    try {
      const report = JSON.parse(result.stdout) as RepoReport;
      setState((prev) => ({
        ...prev,
        report,
        loading: false,
        verifying: false,
        error: null,
        lastScanAt: Date.now(),
      }));
    } catch {
      setState((prev) => ({
        ...prev,
        loading: false,
        verifying: false,
        error: 'The scanner returned output that could not be read.',
      }));
    }
  }, []);

  const cancelScan = useCallback(async () => {
    await window.moleDesktop?.repos?.killScan();
    if (!mountedRef.current) return;
    setState((prev) => ({ ...prev, loading: false, verifying: false }));
  }, []);

  const addRoot = useCallback(async () => {
    const api = window.moleDesktop?.repos;
    if (!api) return;
    const result = await api.chooseRoot();
    if (!mountedRef.current || !result?.ok) return;
    setState((prev) => ({ ...prev, roots: result.roots }));
  }, []);

  const removeRoot = useCallback(
    async (root: string) => {
      const api = window.moleDesktop?.repos;
      if (!api) return;
      const next = state.roots.filter((r) => r !== root);
      const result = await api.setRoots(next);
      if (!mountedRef.current || !result?.ok) return;
      setState((prev) => ({ ...prev, roots: result.roots }));
    },
    [state.roots]
  );

  return {
    ...state,
    scan,
    cancelScan,
    addRoot,
    removeRoot,
    reloadRoots: loadRoots,
  };
}

// categorize sorts entries into the buckets the page renders.
//
// Order matters: "at risk" wins over everything, because a repository whose only
// copy is on this machine is the one thing the user should see first, whether or
// not it is also idle or dirty.
export function categorize(entries: RepoEntry[]): Record<RepoCategory, RepoEntry[]> {
  const buckets: Record<RepoCategory, RepoEntry[]> = {
    'at-risk': [],
    'needs-push': [],
    archivable: [],
    blocked: [],
    active: [],
  };

  for (const entry of entries) {
    if (isAtRisk(entry)) {
      buckets['at-risk'].push(entry);
      continue;
    }
    if (entry.archivable) {
      buckets.archivable.push(entry);
      continue;
    }
    if (entry.needs_push && !entry.push_blocked) {
      buckets['needs-push'].push(entry);
      continue;
    }
    if (entry.activity.cold || entry.push_blocked) {
      buckets.blocked.push(entry);
      continue;
    }
    buckets.active.push(entry);
  }

  const bySize = (a: RepoEntry, b: RepoEntry) => b.size.exclusive_kb - a.size.exclusive_kb;
  const byIdle = (a: RepoEntry, b: RepoEntry) => b.activity.days_idle - a.activity.days_idle;

  buckets['at-risk'].sort(bySize);
  buckets['needs-push'].sort(byIdle);
  buckets.archivable.sort(bySize);
  buckets.blocked.sort(byIdle);
  buckets.active.sort(byIdle);

  return buckets;
}

// isAtRisk means nothing off this machine holds this work: no git history, no
// remote, or a remote an authenticated request cannot reach.
export function isAtRisk(entry: RepoEntry): boolean {
  if (entry.kind === 'plain') return true;
  if (entry.kind === 'worktree') return false;
  if (!entry.has_commits) return true;
  if (!entry.remote) return true;
  return entry.remote.missing;
}

export function riskReason(entry: RepoEntry): string {
  if (entry.kind === 'plain') {
    return 'Not a git repository, so none of it is backed up.';
  }
  if (!entry.has_commits) {
    return 'A repository with no commits: nothing has ever been pushed.';
  }
  if (!entry.remote) {
    return 'No remote is configured, so this code exists only here.';
  }
  if (entry.remote.missing) {
    return `Signed in, but ${entry.remote.host} cannot reach ${entry.remote.owner}/${entry.remote.repo}. Deleted, renamed, or your access was revoked.`;
  }
  return 'This work has no copy anywhere else.';
}

export function formatKB(kb: number): string {
  if (!Number.isFinite(kb) || kb <= 0) return '0 KB';
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = kb;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 100 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}

export function formatIdle(days: number): string {
  if (days < 0) return 'unknown';
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  if (days < 365) return `${Math.round(days / 30)} months ago`;
  const years = (days / 365).toFixed(1).replace(/\.0$/, '');
  return `${years} years ago`;
}
