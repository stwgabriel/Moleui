import type { AutomationAction, AutomationActionKind, AutomationSchedule } from '@/types';

// Local curated marketplace. Every template is data only: an action kind plus,
// for `clean`, section labels that must also appear in the main-process
// allowlist. Nothing here can widen what the main process is willing to run.
//
// `purge` is absent on purpose: it opens an interactive TTY menu and has no
// --yes flag, so it cannot run unattended.

export const AUTOMATABLE_CLEAN_SECTIONS = [
  'App caches',
  'Browsers',
  'Cloud & Office',
  'Applications',
  'Application Support',
  'Virtualization',
  'Apple Silicon',
] as const;

export type AutomatableCleanSection = (typeof AUTOMATABLE_CLEAN_SECTIONS)[number];

export const CLEAN_SECTION_DESCRIPTIONS: Record<AutomatableCleanSection, string> = {
  'App caches': 'Rebuildable caches for sandboxed and standard apps',
  Browsers: 'Browser caches, code signature caches and stale profiles',
  'Cloud & Office': 'Dropbox, OneDrive, Google Drive and Office caches',
  Applications: 'Per-app caches for GUI apps you still have installed',
  'Application Support': 'Old logs and scratch data under Application Support',
  Virtualization: 'Docker, VM and container tool caches',
  'Apple Silicon': 'Rosetta and Apple Silicon translation caches',
};

export interface AutomationTemplate {
  id: string;
  name: string;
  summary: string;
  /** Lucide icon name rendered by the marketplace card. */
  icon: string;
  risk: 'low' | 'moderate';
  action: AutomationAction;
  schedule: AutomationSchedule;
}

export const AUTOMATION_CATALOG: AutomationTemplate[] = [
  {
    id: 'browser-app-cache-sweep',
    name: 'Weekly Browser + App Cache Sweep',
    summary: 'Clears browser and application caches every week. The safest recurring win.',
    icon: 'Sparkles',
    risk: 'low',
    action: { kind: 'clean', sections: ['App caches', 'Browsers'] },
    schedule: { frequency: 'weekly', hour: 3, minute: 0, weekday: 0 },
  },
  {
    id: 'cloud-office-trim',
    name: 'Cloud and Office Cache Trim',
    summary: 'Trims Dropbox, OneDrive, Google Drive and Office caches that rebuild on demand.',
    icon: 'Cloud',
    risk: 'low',
    action: { kind: 'clean', sections: ['Cloud & Office'] },
    schedule: { frequency: 'weekly', hour: 3, minute: 30, weekday: 3 },
  },
  {
    id: 'app-support-refresh',
    name: 'App Support Refresh',
    summary: 'Sweeps per-app caches and stale Application Support logs for installed apps.',
    icon: 'LayoutGrid',
    risk: 'low',
    action: { kind: 'clean', sections: ['Applications', 'Application Support'] },
    schedule: { frequency: 'weekly', hour: 4, minute: 0, weekday: 6 },
  },
  {
    id: 'virtualization-silicon-trim',
    name: 'Virtualization + Apple Silicon Trim',
    summary: 'Reclaims container, VM and Rosetta translation caches. Rebuilt on next use.',
    icon: 'Boxes',
    risk: 'low',
    action: { kind: 'clean', sections: ['Virtualization', 'Apple Silicon'] },
    schedule: { frequency: 'weekly', hour: 4, minute: 30, weekday: 2 },
  },
  {
    id: 'weekly-installer-sweep',
    name: 'Weekly Installer Sweep',
    summary: 'Removes downloaded installer files you already ran. Review the dry run carefully.',
    icon: 'PackageOpen',
    risk: 'moderate',
    action: { kind: 'installer', sections: [] },
    schedule: { frequency: 'weekly', hour: 5, minute: 0, weekday: 1 },
  },
];

export const ACTION_KIND_LABELS: Record<AutomationActionKind, string> = {
  clean: 'Cleanup',
  installer: 'Installer sweep',
};

export const WEEKDAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function describeAction(action: AutomationAction): string {
  if (action.kind === 'installer') return 'Installer files already run';
  return action.sections.join(', ');
}

export function describeSchedule(schedule: AutomationSchedule): string {
  const time = `${String(schedule.hour).padStart(2, '0')}:${String(schedule.minute).padStart(2, '0')}`;
  if (schedule.frequency === 'daily') return `Daily at ${time}`;
  return `${WEEKDAY_LABELS[schedule.weekday] ?? 'Sunday'}s at ${time}`;
}
