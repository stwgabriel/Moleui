import type { RepoEntry } from '@/types';

/**
 * The scanner reports filesystem entries. The UI reports repositories. Linked
 * worktrees are deliberately folded into their primary repository so the same
 * git history never appears as several projects in the grid or batch actions.
 */
export interface PresentedRepo {
  entry: RepoEntry;
  worktrees: RepoEntry[];
}

export function presentRepositories(entries: RepoEntry[]): PresentedRepo[] {
  const byPath = new Map<string, RepoEntry>();
  for (const entry of entries) {
    // A scan can overlap roots. Keep the first canonical path deterministically.
    if (!byPath.has(entry.path)) byPath.set(entry.path, entry);
  }

  const worktreesByMain = new Map<string, RepoEntry[]>();
  const standaloneWorktrees: RepoEntry[] = [];
  for (const entry of byPath.values()) {
    if (entry.kind !== 'worktree') continue;
    const main = entry.worktree?.main_repo;
    if (main && byPath.has(main)) {
      const children = worktreesByMain.get(main) ?? [];
      children.push(entry);
      worktreesByMain.set(main, children);
    } else {
      // A main repo outside the chosen roots is still useful. It cannot be
      // represented by a missing parent, so display it once as a worktree.
      standaloneWorktrees.push(entry);
    }
  }

  const shown = [...byPath.values()]
    .filter((entry) => entry.kind !== 'worktree')
    .map((entry) => ({
      entry,
      worktrees: (worktreesByMain.get(entry.path) ?? []).sort((a, b) => a.path.localeCompare(b.path)),
    }));

  for (const entry of standaloneWorktrees) shown.push({ entry, worktrees: [] });

  return shown.sort((a, b) => a.entry.name.localeCompare(b.entry.name) || a.entry.path.localeCompare(b.entry.path));
}

export function displayedRepositorySize(repositories: PresentedRepo[]) {
  return repositories.reduce((total, repository) => total + repository.entry.size.total_kb, 0);
}
