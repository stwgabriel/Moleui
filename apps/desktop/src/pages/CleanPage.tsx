import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Boxes,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Code2,
  FileText,
  FolderDown,
  Loader2,
  Lock,
  Mail,
  PackageX,
  RefreshCcw,
  Sparkles,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { StartScreen } from '@/components/common/StartScreen';
import { Button } from '@/components/ui/Button';
import type { PageConfig } from '@/types';
import { formatBytes, parseSizeToBytes, stripAnsi } from '@/utils/format';
import { usePaywall } from '@/hooks/usePaywall';
import { usePersistentState } from '@/utils/persistentState';

type Stage = 'idle' | 'analyzing' | 'results' | 'cleaning' | 'complete';
type GroupStatus = 'pending' | 'active' | 'ready' | 'cleaning' | 'complete' | 'empty' | 'error';
type CleanupCommand = 'clean' | 'purge' | 'installer';
type CategoryBadgeTone = 'selected' | 'excluded' | 'attention' | 'running' | 'queued' | 'done' | 'clean' | 'found';

interface LogEntry {
  text: string;
  timestamp: number;
  type: 'info' | 'error' | 'success';
}

interface CleanupItem {
  id: string;
  label: string;
  size: number;
  sourceLine: string;
  selected: boolean;
}

interface CleanupGroup {
  id: string;
  name: string;
  subtitle: string;
  command: CleanupCommand;
  sections?: string[];
  color: string;
  tint: string;
  icon: 'system' | 'apps' | 'developer' | 'projects' | 'installers';
  size: number;
  fileCount: number;
  items: CleanupItem[];
  logs: LogEntry[];
  status: GroupStatus;
  selected: boolean;
  expanded: boolean;
}

interface CategoryBadge {
  label: string;
  tone: CategoryBadgeTone;
}

const STAGES: Stage[] = ['idle', 'analyzing', 'results', 'cleaning', 'complete'];

const GROUP_ICONS: Record<CleanupGroup['icon'], LucideIcon> = {
  system: FileText,
  apps: PackageX,
  developer: Code2,
  projects: Boxes,
  installers: FolderDown,
};

const categoryBadgeClassByTone: Record<CategoryBadgeTone, string> = {
  selected: 'bg-violet-50 text-violet-600 ring-1 ring-violet-100/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)]',
  excluded: 'bg-slate-100/80 text-slate-500 ring-1 ring-slate-200/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]',
  attention: 'bg-rose-50 text-rose-500 ring-1 ring-rose-100/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)]',
  running: 'bg-violet-50 text-violet-600 ring-1 ring-violet-100/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)]',
  queued: 'bg-slate-100/80 text-slate-500 ring-1 ring-slate-200/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]',
  done: 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)]',
  clean: 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)]',
  found: 'bg-orange-50 text-orange-500 ring-1 ring-orange-100/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)]',
};

const ORBIT_PRESENTATION: Array<{
  groupIds: string[];
  label: string;
  icon: LucideIcon;
  iconClassName: string;
  positionClassName: string;
}> = [
  {
    groupIds: ['system', 'user', 'apple-silicon', 'device-backups', 'time-machine', 'large-files', 'system-data'],
    label: 'System Junk',
    icon: FileText,
    iconClassName: 'bg-rose-100 text-rose-500 shadow-rose-200/70',
    positionClassName: 'left-[40%] top-[-4%]',
  },
  {
    groupIds: ['app-caches', 'browsers', 'cloud-office', 'applications', 'app-support', 'app-leftovers'],
    label: 'Apps Junk',
    icon: Sparkles,
    iconClassName: 'bg-violet-100 text-violet-600 shadow-violet-200/70',
    positionClassName: 'left-[calc(-8%+10px)] top-[36%]',
  },
  {
    groupIds: ['developer', 'virtualization'],
    label: 'Dev Junk',
    icon: FolderDown,
    iconClassName: 'bg-blue-100 text-blue-500 shadow-blue-200/70',
    positionClassName: 'right-[calc(-8%+10px)] top-[36%]',
  },
  {
    groupIds: ['project-hints', 'projects'],
    label: 'Project Artifacts',
    icon: FileText,
    iconClassName: 'bg-orange-100 text-orange-500 shadow-orange-200/70',
    positionClassName: 'left-[12%] bottom-[0%]',
  },
  {
    groupIds: ['installers'],
    label: 'Installer Files',
    icon: Mail,
    iconClassName: 'bg-green-100 text-green-500 shadow-green-200/70',
    positionClassName: 'right-[8%] bottom-[0%]',
  },
];

const GROUP_DEFINITIONS: Omit<CleanupGroup, 'size' | 'fileCount' | 'items' | 'logs' | 'status' | 'selected' | 'expanded'>[] = [
  {
    id: 'system',
    name: 'System Junk',
    subtitle: 'Privileged system caches, temporary files, and snapshots',
    command: 'clean',
    sections: ['System'],
    color: '#8b5cf6',
    tint: 'bg-violet-100 text-violet-600 shadow-violet-200/70',
    icon: 'system',
  },
  {
    id: 'user',
    name: 'User Essentials',
    subtitle: 'User logs, temporary files, trash, and Finder metadata',
    command: 'clean',
    sections: ['User essentials'],
    color: '#8b5cf6',
    tint: 'bg-violet-100 text-violet-600 shadow-violet-200/70',
    icon: 'system',
  },
  {
    id: 'app-caches',
    name: 'App Caches',
    subtitle: 'Standard and sandboxed application caches',
    command: 'clean',
    sections: ['App caches'],
    color: '#3b82f6',
    tint: 'bg-blue-100 text-blue-500 shadow-blue-200/70',
    icon: 'apps',
  },
  {
    id: 'browsers',
    name: 'Browser Data',
    subtitle: 'Browser caches, temporary browsing data, and web leftovers',
    command: 'clean',
    sections: ['Browsers'],
    color: '#3b82f6',
    tint: 'bg-blue-100 text-blue-500 shadow-blue-200/70',
    icon: 'apps',
  },
  {
    id: 'cloud-office',
    name: 'Cloud & Office',
    subtitle: 'Cloud sync and office app caches',
    command: 'clean',
    sections: ['Cloud & Office'],
    color: '#3b82f6',
    tint: 'bg-blue-100 text-blue-500 shadow-blue-200/70',
    icon: 'apps',
  },
  {
    id: 'developer',
    name: 'Dev Junk',
    subtitle: 'Package managers, build caches, simulators, and dev tools',
    command: 'clean',
    sections: ['Developer tools'],
    color: '#f97316',
    tint: 'bg-orange-100 text-orange-500 shadow-orange-200/70',
    icon: 'developer',
  },
  {
    id: 'applications',
    name: 'Apps',
    subtitle: 'GUI application logs, support caches, and temporary data',
    command: 'clean',
    sections: ['Applications'],
    color: '#3b82f6',
    tint: 'bg-blue-100 text-blue-500 shadow-blue-200/70',
    icon: 'apps',
  },
  {
    id: 'virtualization',
    name: 'Virtualization',
    subtitle: 'Container, VM, and virtualization tool caches',
    command: 'clean',
    sections: ['Virtualization'],
    color: '#f97316',
    tint: 'bg-orange-100 text-orange-500 shadow-orange-200/70',
    icon: 'developer',
  },
  {
    id: 'app-support',
    name: 'Application Support',
    subtitle: 'Application support logs and rebuildable support files',
    command: 'clean',
    sections: ['Application Support'],
    color: '#3b82f6',
    tint: 'bg-blue-100 text-blue-500 shadow-blue-200/70',
    icon: 'apps',
  },
  {
    id: 'app-leftovers',
    name: 'App Leftovers',
    subtitle: 'Orphaned app data, service files, and container stubs',
    command: 'clean',
    sections: ['App leftovers'],
    color: '#3b82f6',
    tint: 'bg-blue-100 text-blue-500 shadow-blue-200/70',
    icon: 'apps',
  },
  {
    id: 'apple-silicon',
    name: 'Apple Silicon',
    subtitle: 'Apple Silicon update and platform caches',
    command: 'clean',
    sections: ['Apple Silicon'],
    color: '#8b5cf6',
    tint: 'bg-violet-100 text-violet-600 shadow-violet-200/70',
    icon: 'system',
  },
  {
    id: 'device-backups',
    name: 'Device Backups & Firmware',
    subtitle: 'Device firmware caches and iOS backup checks',
    command: 'clean',
    sections: ['Device backups & firmware'],
    color: '#8b5cf6',
    tint: 'bg-violet-100 text-violet-600 shadow-violet-200/70',
    icon: 'system',
  },
  {
    id: 'time-machine',
    name: 'Time Machine',
    subtitle: 'Failed backups and local Time Machine cleanup targets',
    command: 'clean',
    sections: ['Time Machine'],
    color: '#8b5cf6',
    tint: 'bg-violet-100 text-violet-600 shadow-violet-200/70',
    icon: 'system',
  },
  {
    id: 'large-files',
    name: 'Large Files',
    subtitle: 'Large file candidates surfaced for review',
    command: 'clean',
    sections: ['Large files'],
    color: '#8b5cf6',
    tint: 'bg-violet-100 text-violet-600 shadow-violet-200/70',
    icon: 'system',
  },
  {
    id: 'system-data',
    name: 'System Data Clues',
    subtitle: 'Storage clues and possible system data sources',
    command: 'clean',
    sections: ['System Data clues'],
    color: '#8b5cf6',
    tint: 'bg-violet-100 text-violet-600 shadow-violet-200/70',
    icon: 'system',
  },
  {
    id: 'project-hints',
    name: 'Project Artifact Hints',
    subtitle: 'Project artifact candidates detected during cleanup scan',
    command: 'clean',
    sections: ['Project artifacts'],
    color: '#22c55e',
    tint: 'bg-emerald-100 text-emerald-500 shadow-emerald-200/70',
    icon: 'projects',
  },
  {
    id: 'projects',
    name: 'Project Artifacts',
    subtitle: 'Dependency folders and build output from configured project paths',
    command: 'purge',
    color: '#22c55e',
    tint: 'bg-emerald-100 text-emerald-500 shadow-emerald-200/70',
    icon: 'projects',
  },
  {
    id: 'installers',
    name: 'Installer Files',
    subtitle: 'Downloaded DMGs, PKGs, XIPs, ISOs, and installer archives',
    command: 'installer',
    color: '#ec4899',
    tint: 'bg-pink-100 text-pink-500 shadow-pink-200/70',
    icon: 'installers',
  },
];

const CLEAN_SECTION_NAMES = new Set(
  [
    'External volume',
    ...GROUP_DEFINITIONS.flatMap((group) => group.sections ?? []),
  ],
);

const config: PageConfig = {
  title: 'Cleanup',
  description: 'Scan every cleanup area you can safely inspect, then review the junk found before cleaning.',
  icon: 'Sparkles',
  buttonText: 'Scan for Junk',
  items: [
    { icon: 'HardDrive', title: 'System', description: 'Caches, logs, temporary files, and Apple cleanup targets' },
    { icon: 'Package', title: 'Apps', description: 'Browsers, app caches, cloud apps, and app leftovers' },
    { icon: 'Code', title: 'Developer', description: 'Package manager, simulator, build, and tool caches' },
    { icon: 'Archive', title: 'Artifacts', description: 'Project artifacts and installer files' },
  ],
};

const stageCopy: Record<Exclude<Stage, 'idle' | 'complete'>, { title: string; description: string }> = {
  analyzing: {
    title: 'Scanning Mac',
    description: 'Mole is checking cleanup sections and adding junk categories as results stream in.',
  },
  results: {
    title: 'Review junk',
    description: 'Choose what stays selected, then start cleaning the matching cleanup groups.',
  },
  cleaning: {
    title: 'Cleaning junk',
    description: 'Mole is removing the selected cleanup groups and tracking reclaimed space.',
  },
};

function categoryItemCountLabel(count: number) {
  return `${count} ${count === 1 ? 'item' : 'items'}`;
}

function getCategoryBadge(group: CleanupGroup, currentStage: Stage, isSelected: boolean): CategoryBadge {
  if (group.status === 'error') return { label: 'Attention Needed', tone: 'attention' };
  if (group.status === 'active') return { label: 'Scanning', tone: 'running' };
  if (group.status === 'cleaning') return { label: 'Cleaning', tone: 'running' };
  if (group.status === 'pending') return { label: 'Queued', tone: 'queued' };
  if (group.status === 'complete') return { label: 'Cleaned', tone: 'done' };
  if (group.items.length === 0) return { label: 'Clean', tone: 'clean' };
  if (currentStage === 'results') return isSelected ? { label: 'Selected', tone: 'selected' } : { label: 'Excluded', tone: 'excluded' };

  return { label: 'Found', tone: 'found' };
}

function createInitialGroups(): CleanupGroup[] {
  return GROUP_DEFINITIONS.map((group) => ({
    ...group,
    size: 0,
    fileCount: 0,
    items: [],
    logs: [],
    status: 'pending',
    selected: false,
    expanded: false,
  }));
}

function isStage(value: unknown): value is Stage {
  return typeof value === 'string' && STAGES.includes(value as Stage);
}

function isLogEntry(value: unknown): value is LogEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Record<string, unknown>;
  return typeof entry.text === 'string' && typeof entry.timestamp === 'number' && ['info', 'error', 'success'].includes(String(entry.type));
}

function isCleanupItem(value: unknown): value is CleanupItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === 'string' &&
    typeof item.label === 'string' &&
    typeof item.size === 'number' &&
    typeof item.sourceLine === 'string' &&
    typeof item.selected === 'boolean'
  );
}

function isCleanupGroup(value: unknown): value is CleanupGroup {
  if (!value || typeof value !== 'object') return false;
  const group = value as Record<string, unknown>;
  return (
    typeof group.id === 'string' &&
    typeof group.name === 'string' &&
    typeof group.command === 'string' &&
    typeof group.size === 'number' &&
    typeof group.fileCount === 'number' &&
    Array.isArray(group.items) &&
    group.items.every(isCleanupItem) &&
    Array.isArray(group.logs) &&
    group.logs.every(isLogEntry) &&
    typeof group.selected === 'boolean'
  );
}

function isCleanupGroupArray(value: unknown): value is CleanupGroup[] {
  return Array.isArray(value) && value.every(isCleanupGroup);
}

function parseLineSize(line: string) {
  const sizeMatch = line.match(/(\d+(?:\.\d+)?)\s*(B|KB|MB|GB|TB)\b/i);
  if (!sizeMatch) return 0;
  return parseSizeToBytes(parseFloat(sizeMatch[1]), sizeMatch[2]);
}

function isSkippedLine(line: string) {
  return /skipp|protected|whitelist|already clean|nothing to clean|requires sudo|not available|not found|running|manual review|review only/i.test(line);
}

function isSummaryLine(line: string) {
  return /^(#|Dry run complete|Cleanup complete|Purge complete|Installers cleaned|Potential space|Space freed|Would free|Items:|Categories:|Free space|Free:|Detailed file list|Use mo clean)/i.test(line);
}

function isSectionHeader(line: string) {
  const sectionMatch = line.match(/^[→▸➤]\s+(.+?)$/);
  return Boolean(sectionMatch && CLEAN_SECTION_NAMES.has(sectionMatch[1].trim()));
}

function cleanDisplayLine(line: string) {
  return line
    .replace(/^[✓✔•*\-→▸➤↳☞◎\s]+/, '')
    .replace(/\s*\((\d+(?:\.\d+)?\s*(?:B|KB|MB|GB|TB))\)\s*$/i, '')
    .replace(/\s*,?\s*\d+(?:\.\d+)?\s*(?:B|KB|MB|GB|TB)\b(?:\s+dry)?\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function makeItemId(groupId: string, line: string, index: number) {
  return `${groupId}-${index}-${line.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 48)}`;
}

function parseCleanableLine(group: CleanupGroup, line: string, currentSection: string, index: number): CleanupItem | null {
  if (!line || isSummaryLine(line) || isSectionHeader(line) || isSkippedLine(line)) return null;

  if (group.command === 'clean' && group.sections?.length && currentSection && !group.sections.includes(currentSection)) {
    return null;
  }

  const size = parseLineSize(line);
  if (size <= 0) return null;

  if (group.command === 'purge' && !/\[DRY RUN\]|would clean|would remove|would delete/i.test(line)) {
    return null;
  }

  if (group.command === 'installer' && !/\.(dmg|pkg|mpkg|iso|xip|zip)\b/i.test(line)) {
    return null;
  }

  return {
    id: makeItemId(group.id, line, index),
    label: cleanDisplayLine(line),
    size,
    sourceLine: line,
    selected: true,
  };
}

function parseCleanableItems(group: CleanupGroup, output: string) {
  const items: CleanupItem[] = [];
  let currentSection = '';

  for (const rawLine of stripAnsi(output).split('\n')) {
    const line = rawLine.trim();
    const sectionMatch = line.match(/^[→▸➤]\s+(.+?)$/);
    if (sectionMatch && CLEAN_SECTION_NAMES.has(sectionMatch[1].trim())) {
      currentSection = sectionMatch[1].trim();
      continue;
    }

    const item = parseCleanableLine(group, line, currentSection, items.length);
    if (item) items.push(item);
  }

  const size = items.reduce((sum, item) => sum + item.size, 0);

  return {
    items,
    size,
    fileCount: items.length,
    selected: items.length > 0,
    expanded: false,
    status: items.length > 0 ? ('ready' as const) : ('empty' as const),
  };
}

function commandLabel(group: CleanupGroup, dryRun: boolean) {
  const suffix = dryRun ? ' --dry-run' : '';
  if (group.command === 'clean') {
    const sections = group.sections?.map((section) => ` --section "${section}"`).join('') ?? '';
    return `mo clean${suffix}${sections}`;
  }
  if (group.command === 'installer') return `mo installer${suffix} --all --yes`;
  return `mo purge${suffix}`;
}

function formatGigValue(bytes: number) {
  if (bytes <= 0) return '0 GB';
  if (bytes < 1024 * 1024 * 1024) return formatBytes(bytes);
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

const STORAGE_USED_BYTES = parseSizeToBytes(200.78, 'GB');
const STORAGE_CAPACITY_BYTES = parseSizeToBytes(228.27, 'GB');

function toPercent(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, (value / total) * 100));
}

function scrollToBottom(element: HTMLDivElement | null) {
  if (!element) return;

  if (typeof element.scrollTo === 'function') {
    element.scrollTo({ top: element.scrollHeight, behavior: 'smooth' });
    return;
  }

  element.scrollTop = element.scrollHeight;
}

function getScrollShadowState(element: HTMLDivElement | null) {
  if (!element) return { top: false, bottom: false };

  const hasOverflow = element.scrollHeight - element.clientHeight > 1;
  return {
    top: hasOverflow && element.scrollTop > 1,
    bottom: hasOverflow && element.scrollTop + element.clientHeight < element.scrollHeight - 1,
  };
}

export function CleanPage() {
  const { requireSubscription } = usePaywall();
  const [stage, setStage] = usePersistentState<Stage>('mole-clean-stage', 'idle', isStage);
  const [groups, setGroups] = usePersistentState<CleanupGroup[]>('mole-clean-groups', createInitialGroups(), isCleanupGroupArray);
  const [cleanedSize, setCleanedSize] = usePersistentState('mole-clean-cleaned-size', 0, (value): value is number => typeof value === 'number');
  const [liveScanSize, setLiveScanSize] = useState(0);
  const [currentScanItem, setCurrentScanItem] = useState('Ready to inspect safe cleanup targets.');
  const [categoryScrollShadow, setCategoryScrollShadow] = useState({ top: false, bottom: false });
  const activeGroupRef = useRef<string | null>(null);
  const streamLineIndexRef = useRef(0);
  const categoryListRef = useRef<HTMLDivElement | null>(null);
  const itemListRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const foundGroups = useMemo(() => groups.filter((group) => group.items.length > 0), [groups]);
  const visibleGroups = useMemo(
    () => groups.filter((group) => group.items.length > 0 || group.status === 'active' || group.status === 'cleaning' || group.status === 'error'),
    [groups],
  );
  const totalSize = useMemo(() => groups.reduce((sum, group) => sum + group.size, 0), [groups]);
  const selectedSize = useMemo(
    () => groups.reduce((sum, group) => sum + group.items.filter((item) => item.selected).reduce((itemSum, item) => itemSum + item.size, 0), 0),
    [groups],
  );
  const selectedItemCount = useMemo(() => groups.reduce((sum, group) => sum + group.items.filter((item) => item.selected).length, 0), [groups]);
  const foundItemCount = useMemo(() => foundGroups.reduce((sum, group) => sum + group.items.length, 0), [foundGroups]);
  const displaySize = stage === 'analyzing' ? Math.max(liveScanSize, totalSize) : totalSize;
  const activeGroup = groups.find((group) => group.status === 'active' || group.status === 'cleaning');
  const activeGroupId = activeGroup?.id;
  const stageHeader = stage === 'idle' || stage === 'complete' ? null : stageCopy[stage];
  const groupActivitySignature = groups.map((group) => `${group.id}:${group.status}:${group.items.length}`).join('|');
  const storageUsedPercent = toPercent(STORAGE_USED_BYTES, STORAGE_CAPACITY_BYTES);
  const storageUsedPercentLabel = `${Math.round(storageUsedPercent)}%`;
  const storageReclaimableSize = Math.min(selectedSize, STORAGE_USED_BYTES);
  const storageReclaimablePercent = toPercent(storageReclaimableSize, STORAGE_CAPACITY_BYTES);
  const storageUsedAfterCleanupPercent = Math.max(0, storageUsedPercent - storageReclaimablePercent);
  const storageUsageLabel = `${formatBytes(STORAGE_USED_BYTES)} of ${formatBytes(STORAGE_CAPACITY_BYTES)} used`;
  const storageCapacityLabel = formatBytes(STORAGE_CAPACITY_BYTES);
  const storageReclaimableLabel = formatGigValue(storageReclaimableSize);
  const storageAriaValueText = storageReclaimableSize > 0
    ? `${storageUsageLabel}, ${storageReclaimableLabel} will be freed by cleaning selected items`
    : storageUsageLabel;

  const updateCategoryScrollShadow = () => {
    const next = getScrollShadowState(categoryListRef.current);
    setCategoryScrollShadow((previous) => (previous.top === next.top && previous.bottom === next.bottom ? previous : next));
  };

  useEffect(() => {
    return () => window.moleDesktop?.clean?.removeListeners();
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(updateCategoryScrollShadow);
    return () => window.cancelAnimationFrame(frame);
  });

  useEffect(() => {
    window.addEventListener('resize', updateCategoryScrollShadow);
    return () => window.removeEventListener('resize', updateCategoryScrollShadow);
  }, []);

  useEffect(() => {
    if (stage !== 'analyzing' || !activeGroupId) return;

    scrollToBottom(categoryListRef.current);
    scrollToBottom(itemListRefs.current[activeGroupId]);
  }, [activeGroupId, groupActivitySignature, stage]);

  const patchGroup = (id: string, patch: Partial<CleanupGroup> | ((group: CleanupGroup) => Partial<CleanupGroup>)) => {
    setGroups((previous) =>
      previous.map((group) => {
        if (group.id !== id) return group;
        const nextPatch = typeof patch === 'function' ? patch(group) : patch;
        return { ...group, ...nextPatch };
      }),
    );
  };

  const appendLog = (id: string, text: string, type: LogEntry['type'] = 'info') => {
    const lines = stripAnsi(text)
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length === 0) return;

    patchGroup(id, (group) => ({
      logs: [
        ...group.logs,
        ...lines.map((line) => ({ text: line, timestamp: Date.now(), type })),
      ].slice(-80),
    }));
  };

  const runCleanGroups = async (cleanGroups: CleanupGroup[], dryRun: boolean) => {
    if (cleanGroups.length === 0) return true;

    const cleanSections = cleanGroups.flatMap((group) => group.sections ?? []);
    const cleanGroupIds = new Set(cleanGroups.map((group) => group.id));
    const output: string[] = [];
    let currentSection = '';
    let currentGroupId = cleanGroups[0]?.id ?? '';
    streamLineIndexRef.current = 0;
    activeGroupRef.current = currentGroupId;

    setGroups((previous) => previous.map((group) => {
      if (!cleanGroupIds.has(group.id)) return group;
      return {
        ...group,
        status: group.id === currentGroupId ? (dryRun ? 'active' : 'cleaning') : 'pending',
        logs: [],
        ...(dryRun ? { items: [], size: 0, fileCount: 0, selected: false, expanded: false } : {}),
      };
    }));
    setCurrentScanItem(dryRun ? 'Scanning cleanup sections...' : 'Cleaning selected cleanup sections...');
    appendLog(currentGroupId, `$ mo clean${dryRun ? ' --dry-run' : ''}${cleanSections.map((section) => ` --section "${section}"`).join('')}`);

    const findGroupForSection = (section: string) => cleanGroups.find((group) => group.sections?.includes(section));

    window.moleDesktop.clean.removeListeners();
    window.moleDesktop.clean.onStdout((text) => {
      output.push(text);
      const parsedItemsByGroup = new Map<string, CleanupItem[]>();
      let liveSizeDelta = 0;
      let nextScanItem = '';

      for (const rawLine of stripAnsi(text).split('\n')) {
        const line = rawLine.trim();
        if (!line) continue;

        const sectionMatch = line.match(/^[→▸➤]\s+(.+?)$/);
        if (sectionMatch && CLEAN_SECTION_NAMES.has(sectionMatch[1].trim())) {
          currentSection = sectionMatch[1].trim();
          const sectionGroup = findGroupForSection(currentSection);
          if (sectionGroup) {
            currentGroupId = sectionGroup.id;
            activeGroupRef.current = sectionGroup.id;
            setGroups((previous) => previous.map((group) => {
              if (!cleanGroupIds.has(group.id)) return group;
              if (group.id === sectionGroup.id) return { ...group, status: dryRun ? 'active' : 'cleaning' };
              return group.status === 'active' || group.status === 'cleaning' ? { ...group, status: 'pending' } : group;
            }));
          }
          setCurrentScanItem(`Scanning ${currentSection}...`);
          continue;
        }

        const currentGroup = findGroupForSection(currentSection);
        if (!currentGroup) continue;
        appendLog(currentGroup.id, line);
        streamLineIndexRef.current += 1;
        const item = parseCleanableLine(currentGroup, line, currentSection, streamLineIndexRef.current);
        if (dryRun && item) {
          parsedItemsByGroup.set(currentGroup.id, [...(parsedItemsByGroup.get(currentGroup.id) ?? []), item]);
          liveSizeDelta += item.size;
          nextScanItem = item.label;
        } else if (dryRun && !isSummaryLine(line) && !isSkippedLine(line)) {
          nextScanItem = cleanDisplayLine(line);
        }
      }

      if (dryRun && parsedItemsByGroup.size > 0) {
        setLiveScanSize((previous) => previous + liveSizeDelta);
        setGroups((previous) => previous.map((currentGroup) => {
          const parsedItems = parsedItemsByGroup.get(currentGroup.id);
          if (!parsedItems) return currentGroup;
          const existingLines = new Set(currentGroup.items.map((existing) => existing.sourceLine));
          const uniqueItems = parsedItems.filter((item) => !existingLines.has(item.sourceLine));
          if (uniqueItems.length === 0) return currentGroup;
          const items = [...currentGroup.items, ...uniqueItems];
          const size = items.reduce((sum, nextItem) => sum + nextItem.size, 0);
          return {
            ...currentGroup,
            items,
            size,
            fileCount: items.length,
            selected: true,
            expanded: false,
            status: 'active',
          };
        }));
      }

      if (dryRun && nextScanItem) setCurrentScanItem(nextScanItem);
    });
    window.moleDesktop.clean.onStderr((text) => appendLog(currentGroupId, text, 'error'));

    const result = await window.moleDesktop.clean.execute({
      command: 'clean',
      dryRun,
      sections: cleanSections,
    });

    window.moleDesktop.clean.removeListeners();

    if (result.killed) {
      setGroups((previous) => previous.map((group) => cleanGroupIds.has(group.id) ? { ...group, status: 'error' } : group));
      appendLog(currentGroupId, 'Cancelled by user', 'error');
      return false;
    }

    const emptyDryRun = dryRun && result.exitCode === 2;
    if (!result.ok && !emptyDryRun) {
      setGroups((previous) => previous.map((group) => cleanGroupIds.has(group.id) ? { ...group, status: 'error' } : group));
      appendLog(currentGroupId, result.stderr || 'Command failed', 'error');
      return false;
    }

    if (dryRun) {
      for (const group of cleanGroups) {
        const parsed = parseCleanableItems(group, output.join('') || result.stdout);
        patchGroup(group.id, parsed);
        appendLog(group.id, parsed.items.length > 0 ? `Found ${formatBytes(parsed.size)} cleanable` : 'No cleanable items found', parsed.items.length > 0 ? 'success' : 'info');
      }
      return true;
    }

    setGroups((previous) => previous.map((group) => cleanGroupIds.has(group.id) ? { ...group, status: 'complete' } : group));
    for (const group of cleanGroups) appendLog(group.id, 'Cleanup complete', 'success');
    setCleanedSize((previous) => previous + cleanGroups.reduce((sum, group) => sum + group.items.filter((item) => item.selected).reduce((itemSum, item) => itemSum + item.size, 0), 0));
    return true;
  };

  const runGroup = async (group: CleanupGroup, dryRun: boolean) => {
    activeGroupRef.current = group.id;
    streamLineIndexRef.current = 0;
    const output: string[] = [];
    const status = dryRun ? 'active' : 'cleaning';
    let currentSection = '';

    patchGroup(group.id, { status, logs: [], ...(dryRun ? { items: [], size: 0, fileCount: 0, selected: false, expanded: false } : {}) });
    setCurrentScanItem(`Scanning ${group.name.toLowerCase()}...`);
    appendLog(group.id, `$ ${commandLabel(group, dryRun)}`);

    window.moleDesktop.clean.removeListeners();
    window.moleDesktop.clean.onStdout((text) => {
      output.push(text);
      appendLog(group.id, text);
      const parsedItems: CleanupItem[] = [];
      let liveSizeDelta = 0;
      let nextScanItem = '';

      for (const rawLine of stripAnsi(text).split('\n')) {
        const line = rawLine.trim();
        if (!line) continue;

        const sectionMatch = line.match(/^[→▸➤]\s+(.+?)$/);
        if (sectionMatch && CLEAN_SECTION_NAMES.has(sectionMatch[1].trim())) {
          currentSection = sectionMatch[1].trim();
          setCurrentScanItem(`Scanning ${currentSection}...`);
          continue;
        }

        streamLineIndexRef.current += 1;
        const item = parseCleanableLine(group, line, currentSection, streamLineIndexRef.current);
        if (dryRun && item) {
          parsedItems.push(item);
          liveSizeDelta += item.size;
          nextScanItem = item.label;
        } else if (dryRun && !isSummaryLine(line) && !isSkippedLine(line)) {
          nextScanItem = cleanDisplayLine(line);
        }
      }

      if (dryRun && parsedItems.length > 0) {
        setLiveScanSize((previous) => previous + liveSizeDelta);
        patchGroup(group.id, (currentGroup) => {
          const existingLines = new Set(currentGroup.items.map((existing) => existing.sourceLine));
          const uniqueItems = parsedItems.filter((item) => !existingLines.has(item.sourceLine));
          if (uniqueItems.length === 0) return {};
          const items = [...currentGroup.items, ...uniqueItems];
          const size = items.reduce((sum, nextItem) => sum + nextItem.size, 0);
          return {
            items,
            size,
            fileCount: items.length,
            selected: true,
            expanded: false,
            status: 'active',
          };
        });
      }

      if (dryRun && nextScanItem) {
        setCurrentScanItem(nextScanItem);
      }
    });
    window.moleDesktop.clean.onStderr((text) => appendLog(group.id, text, 'error'));

    const result = await window.moleDesktop.clean.execute({
      command: group.command,
      dryRun,
      sections: group.sections,
      all: group.command === 'installer',
    });

    window.moleDesktop.clean.removeListeners();

    if (result.killed) {
      patchGroup(group.id, { status: 'error' });
      appendLog(group.id, 'Cancelled by user', 'error');
      return false;
    }

    const emptyDryRun = dryRun && result.exitCode === 2;
    if (!result.ok && !emptyDryRun) {
      patchGroup(group.id, { status: 'error' });
      appendLog(group.id, result.stderr || 'Command failed', 'error');
      if (dryRun) return true;
      return false;
    }

    if (dryRun) {
      const parsed = parseCleanableItems(group, output.join('') || result.stdout);
      patchGroup(group.id, parsed);
      appendLog(group.id, parsed.items.length > 0 ? `Found ${formatBytes(parsed.size)} cleanable` : 'No cleanable items found', parsed.items.length > 0 ? 'success' : 'info');
      return true;
    }

    patchGroup(group.id, { status: 'complete' });
    appendLog(group.id, 'Cleanup complete', 'success');
    setCleanedSize((previous) => previous + group.items.filter((item) => item.selected).reduce((sum, item) => sum + item.size, 0));
    return true;
  };

  const startAnalyze = async () => {
    const nextGroups = createInitialGroups();
    setGroups(nextGroups);
    setCleanedSize(0);
    setLiveScanSize(0);
    setCurrentScanItem('Preparing cleanup scan...');
    setStage('analyzing');

    const cleanGroups = nextGroups.filter((group) => group.command === 'clean');
    const otherGroups = nextGroups.filter((group) => group.command !== 'clean');

    const cleanOk = await runCleanGroups(cleanGroups, true);
    if (!cleanOk) {
      activeGroupRef.current = null;
      setStage('idle');
      return;
    }

    for (const group of otherGroups) {
      const ok = await runGroup(group, true);
      if (!ok) {
        activeGroupRef.current = null;
        setStage('idle');
        return;
      }
    }

    activeGroupRef.current = null;
    setCurrentScanItem('All cleanup targets have been reviewed.');
    setStage('results');
  };

  const requestAnalyze = () => {
    if (!requireSubscription('Cleanup')) return;
    void startAnalyze();
  };

  const startCleaning = async () => {
    if (!requireSubscription('Cleanup')) return;
    const groupsToClean = groups.filter((group) => group.items.some((item) => item.selected));
    if (groupsToClean.length === 0) return;

    setStage('cleaning');
    setCleanedSize(0);
    setCurrentScanItem('Preparing selected cleanup...');
    setGroups((previous) => previous.map((group) => ({ ...group, status: group.items.some((item) => item.selected) ? 'pending' : group.status })));

    const cleanGroupsToClean = groupsToClean.filter((group) => group.command === 'clean');
    const otherGroupsToClean = groupsToClean.filter((group) => group.command !== 'clean');

    const cleanOk = await runCleanGroups(cleanGroupsToClean, false);
    if (!cleanOk) {
      activeGroupRef.current = null;
      setStage('results');
      return;
    }

    for (const group of otherGroupsToClean) {
      const ok = await runGroup(group, false);
      if (!ok) {
        activeGroupRef.current = null;
        setStage('results');
        return;
      }
    }

    activeGroupRef.current = null;
    setCurrentScanItem('Selected cleanup finished.');
    setStage('complete');
  };

  const stopCurrent = async () => {
    await window.moleDesktop.clean.kill();
    window.moleDesktop.clean.removeListeners();
    activeGroupRef.current = null;
    setCurrentScanItem('Scan stopped.');
    setStage(stage === 'cleaning' ? 'results' : 'idle');
  };

  const reset = () => {
    window.moleDesktop.clean.removeListeners();
    activeGroupRef.current = null;
    setStage('idle');
    setGroups(createInitialGroups());
    setCleanedSize(0);
    setLiveScanSize(0);
    setCurrentScanItem('Ready to inspect safe cleanup targets.');
  };

  const toggleItem = (groupId: string, itemId: string) => {
    patchGroup(groupId, (group) => {
      const items = group.items.map((item) => (item.id === itemId ? { ...item, selected: !item.selected } : item));
      return {
        items,
        selected: items.some((item) => item.selected),
      };
    });
  };

  const toggleGroupSelected = (groupId: string) => {
    patchGroup(groupId, (group) => {
      const selected = !group.items.some((item) => item.selected);
      return {
        items: group.items.map((item) => ({ ...item, selected })),
        selected,
      };
    });
  };

  const toggleExpanded = (id: string) => {
    patchGroup(id, (group) => ({ expanded: !group.expanded }));
  };

  const renderOrbitItem = (item: (typeof ORBIT_PRESENTATION)[number], index: number) => {
    const orbitGroups = item.groupIds.map((groupId) => groups.find((nextGroup) => nextGroup.id === groupId)).filter((group): group is CleanupGroup => Boolean(group));
    const Icon = item.icon;
    const active = orbitGroups.some((group) => activeGroup?.id === group.id);
    const hasError = orbitGroups.some((group) => group.status === 'error');
    const showSize = orbitGroups.reduce((sum, group) => sum + group.size, 0);
    const itemCount = orbitGroups.reduce((sum, group) => sum + group.items.length, 0);
    const hasScanned = orbitGroups.length > 0 && orbitGroups.every((group) => group.status !== 'pending');
    const isClean = hasScanned && !active && !hasError && itemCount === 0;
    const isDone = !active && (itemCount > 0 || isClean || hasError);
    const statusLabel = active ? 'Scanning' : hasError ? 'Issue' : isClean ? 'Clean' : itemCount > 0 ? 'Found' : '';
    const stateClassName = active
      ? 'border-dashed border-violet-400 bg-white/88 shadow-[0_16px_44px_rgba(109,93,252,0.16)] animate-clean-card-pulse'
      : hasError
        ? 'border-rose-300 bg-rose-50/88 shadow-[0_12px_34px_rgba(244,63,94,0.12)]'
        : isDone
          ? 'border-violet-500 bg-violet-50/90 shadow-[0_12px_34px_rgba(109,93,252,0.13)]'
          : 'border-slate-200/90 bg-white/70 shadow-none opacity-75';
    const iconStateClassName = active || isDone ? item.iconClassName : 'bg-slate-100 text-slate-400 shadow-none';

    return (
      <div
        key={item.label}
        className={`absolute ${item.positionClassName} z-20 flex w-[clamp(8rem,13.2vw,15.5rem)] min-w-0 items-center gap-[clamp(0.45rem,0.8vw,0.75rem)] rounded-[clamp(0.7rem,0.95vw,1rem)] border px-[clamp(0.55rem,0.85vw,0.875rem)] py-[clamp(0.45rem,0.75vw,0.75rem)] backdrop-blur-2xl transition-all duration-500 ${stateClassName} ${active ? 'scale-[1.02]' : ''}`}
        style={{ animationDelay: `${index * -0.45}s` }}
      >
        <div className={`flex h-[clamp(2rem,2.8vw,3rem)] w-[clamp(2rem,2.8vw,3rem)] shrink-0 items-center justify-center rounded-[0.8rem] transition-colors duration-500 ${iconStateClassName}`}>
          <Icon className="h-[clamp(0.95rem,1.25vw,1.25rem)] w-[clamp(0.95rem,1.25vw,1.25rem)]" strokeWidth={2.2} />
        </div>
        <div className="min-w-0">
          <div className={`truncate text-[clamp(0.72rem,1vw,1rem)] font-black leading-tight ${active || isDone ? 'text-slate-950' : 'text-slate-500'}`}>{item.label}</div>
          <div className="mt-1 flex min-w-0 items-center gap-[clamp(0.25rem,0.45vw,0.5rem)] text-[clamp(0.6rem,0.74vw,0.75rem)] font-black">
            <span className={active || isDone ? 'text-violet-600' : 'text-slate-400'}>{formatGigValue(showSize)}</span>
            {statusLabel && <span className="h-1 w-1 rounded-full bg-slate-300" />}
            {statusLabel && <span className={`truncate ${active ? 'text-violet-500' : hasError ? 'text-rose-500' : isClean ? 'text-emerald-500' : 'text-slate-500'}`}>{statusLabel}</span>}
          </div>
        </div>
      </div>
    );
  };

  const renderCategoryCard = (group: CleanupGroup) => {
    const Icon = GROUP_ICONS[group.icon];
    const isActive = group.status === 'active' || group.status === 'cleaning';
    const isError = group.status === 'error';
    const cardSize = group.items.reduce((sum, item) => sum + item.size, 0);
    const isSelected = group.items.some((item) => item.selected);
    const canSelect = group.items.length > 0 && stage === 'results';
    const errorMessage = group.logs.find((log) => log.type === 'error')?.text;
    const cardSubtitle = isError ? (errorMessage ?? 'Scan failed for this cleanup group') : isActive ? currentScanItem : group.subtitle;
    const categoryBadge = getCategoryBadge(group, stage, isSelected);
    const detailsId = `clean-category-${group.id.replace(/[^a-zA-Z0-9_-]/g, '-')}`;

    return (
      <section
        key={group.id}
        className={`relative border-b border-slate-900/[0.07] transition-colors duration-300 first:rounded-t-[1.55rem] last:border-b-0 last:rounded-b-[1.55rem] ${
          isError ? 'bg-rose-50/28' : isActive ? 'bg-violet-50/24 animate-clean-card-pulse' : 'hover:bg-white/38'
        } ${canSelect && isSelected ? 'shadow-[inset_5px_0_0_rgba(109,93,252,0.32)]' : ''}`}
      >
        <div className="group flex w-full items-center gap-[clamp(0.8rem,1.15vw,1.25rem)] px-[clamp(0.8rem,1.35vw,1.35rem)] py-[clamp(0.85rem,1.2vw,1.2rem)] text-left transition">
          {canSelect && (
            <button
              type="button"
              onClick={() => toggleGroupSelected(group.id)}
              aria-label={`${isSelected ? 'Deselect' : 'Select'} ${group.name}`}
              aria-pressed={isSelected}
              className={`flex h-[clamp(1.35rem,1.75vw,1.7rem)] w-[clamp(1.35rem,1.75vw,1.7rem)] shrink-0 items-center justify-center rounded-full border transition-all ${
                isSelected
                  ? 'border-violet-500 bg-violet-600 text-white shadow-[0_8px_18px_rgba(109,93,252,0.26),0_0_0_5px_rgba(109,93,252,0.10)]'
                  : 'border-slate-300 bg-white/76 text-transparent shadow-[0_6px_14px_rgba(83,76,148,0.06)] hover:border-violet-300 hover:text-violet-300'
              }`}
            >
              <Check className="h-[clamp(0.8rem,1vw,1rem)] w-[clamp(0.8rem,1vw,1rem)]" strokeWidth={3} />
            </button>
          )}

          <button
            type="button"
            aria-controls={detailsId}
            aria-expanded={group.expanded}
            onClick={() => toggleExpanded(group.id)}
            className="flex min-w-0 flex-1 items-center gap-[clamp(0.8rem,1.15vw,1.25rem)] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#fbf9ff]"
          >
            <div
              className={`flex h-[clamp(2.75rem,3.7vw,4.05rem)] w-[clamp(2.75rem,3.7vw,4.05rem)] shrink-0 items-center justify-center rounded-[1.05rem] border bg-white/76 backdrop-blur-xl ${
                isActive
                  ? 'border-violet-200/90 text-violet-600'
                  : isError
                    ? 'border-rose-200/90 text-rose-500'
                    : 'border-violet-100/80 text-violet-500'
              }`}
            >
              {isActive ? <Loader2 className="h-[clamp(1.25rem,1.65vw,1.65rem)] w-[clamp(1.25rem,1.65vw,1.65rem)] animate-spin" strokeWidth={2.15} /> : <Icon className="h-[clamp(1.25rem,1.65vw,1.65rem)] w-[clamp(1.25rem,1.65vw,1.65rem)]" strokeWidth={2.15} />}
            </div>

            <div className="min-w-0 flex-1">
              <h3 className="truncate text-[clamp(0.92rem,1.12vw,1.15rem)] font-black leading-tight text-slate-950">{group.name}</h3>
              <p className={`mt-[clamp(0.25rem,0.45vw,0.4rem)] truncate text-[clamp(0.74rem,0.92vw,0.92rem)] font-semibold leading-snug ${isError ? 'text-rose-500' : 'text-slate-500'}`}>{cardSubtitle}</p>
            </div>
          </button>

          {!canSelect && (
            <span className={`inline-flex shrink-0 rounded-full px-[clamp(0.65rem,0.9vw,0.8rem)] py-[clamp(0.3rem,0.45vw,0.4rem)] text-[clamp(0.68rem,0.84vw,0.8rem)] font-black leading-none ${categoryBadgeClassByTone[categoryBadge.tone]}`}>
              {categoryBadge.label}
            </span>
          )}

          <span className="shrink-0 whitespace-nowrap text-[clamp(0.72rem,0.9vw,0.86rem)] font-black text-slate-500">
            {formatGigValue(cardSize)}
          </span>

          <button
            type="button"
            aria-controls={detailsId}
            aria-expanded={group.expanded}
            onClick={() => toggleExpanded(group.id)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-white/62 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#fbf9ff]"
            aria-label={`${group.expanded ? 'Collapse' : 'Expand'} ${group.name}`}
          >
            {group.expanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </button>
        </div>

        {group.expanded && (
          <div id={detailsId} className="px-[clamp(0.8rem,1.35vw,1.35rem)] pb-[clamp(0.8rem,1.2vw,1.2rem)]">
            <div
              ref={(element) => {
                itemListRefs.current[group.id] = element;
              }}
              className="ml-[clamp(3.55rem,4.9vw,5.25rem)] max-h-[190px] overflow-y-auto rounded-[1.1rem] border border-violet-100/80 bg-white/54 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)] backdrop-blur-xl custom-scrollbar"
            >
              {group.items.length > 0 ? (
                group.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggleItem(group.id, item.id)}
                    aria-pressed={item.selected}
                    className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto_1.35rem] items-center gap-[clamp(0.55rem,0.95vw,0.9rem)] border-b border-slate-900/[0.06] px-[clamp(0.75rem,1.15vw,1rem)] py-[clamp(0.65rem,0.95vw,0.85rem)] text-left transition-colors last:border-b-0 hover:bg-violet-50/54"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${item.selected ? 'bg-violet-500 shadow-[0_0_0_4px_rgba(109,93,252,0.11)]' : 'bg-slate-300 shadow-[0_0_0_4px_rgba(148,163,184,0.11)]'}`} />
                      <span className={`truncate text-[clamp(0.75rem,0.9vw,0.88rem)] font-bold ${item.selected ? 'text-slate-700' : 'text-slate-400'}`}>{item.label}</span>
                    </span>
                    <span className={`shrink-0 rounded-full px-[clamp(0.55rem,0.8vw,0.7rem)] py-[clamp(0.28rem,0.42vw,0.36rem)] text-[clamp(0.64rem,0.78vw,0.76rem)] font-black leading-none ${item.selected ? 'bg-violet-50 text-violet-600 ring-1 ring-violet-100/95' : 'bg-slate-100/80 text-slate-400 ring-1 ring-slate-200/80'}`}>
                      {formatBytes(item.size)}
                    </span>
                    <ChevronRight className="h-5 w-5 shrink-0 text-slate-300" />
                  </button>
                ))
              ) : (
                <div className="flex min-w-0 items-center gap-3 px-[clamp(0.75rem,1.15vw,1rem)] py-[clamp(0.75rem,1vw,0.95rem)]">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-violet-500 shadow-[0_0_0_4px_rgba(109,93,252,0.11)]" />
                  <span className="truncate text-[clamp(0.75rem,0.9vw,0.88rem)] font-bold text-slate-500">Waiting for cleanup output...</span>
                  {isActive && <Loader2 className="ml-auto h-4 w-4 shrink-0 animate-spin text-violet-500" />}
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    );
  };

  if (stage === 'idle') {
    return <StartScreen config={config} onStart={requestAnalyze} variant="feature" />;
  }

  if (stage === 'complete') {
    return (
      <div className="relative h-full min-h-0 overflow-hidden bg-[#fbf9ff] p-7">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(109,93,252,0.18),transparent_36%),radial-gradient(circle_at_16%_88%,rgba(34,197,94,0.12),transparent_34%)]" />
        <div className="relative flex h-full items-center justify-center">
          <div className="w-full max-w-xl rounded-[1.4rem] border border-white/80 bg-white/70 p-8 text-center shadow-[0_24px_80px_rgba(83,76,148,0.16)] backdrop-blur-2xl">
            <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-500 shadow-[0_18px_45px_rgba(34,197,94,0.16)]">
              <Check className="h-10 w-10" />
            </div>
            <h2 className="text-3xl font-black text-slate-950">Cleanup complete</h2>
            <p className="mt-2 text-sm font-semibold text-slate-500">Mole recovered approximately {formatGigValue(cleanedSize)} from the selected cleanup targets.</p>
            <Button icon={Check} onClick={reset} size="lg" className="mt-8 rounded-full bg-violet-600 px-8 shadow-[0_18px_44px_rgba(109,93,252,0.28)] hover:bg-violet-700">
              Done
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-0 overflow-hidden bg-[#fbf9ff] px-[clamp(1.25rem,3vw,4rem)] pb-[clamp(0.85rem,1.65vw,1.75rem)] pt-[clamp(1.25rem,2.4vw,2.5rem)] text-slate-950">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_26%_14%,rgba(109,93,252,0.08),transparent_28%),radial-gradient(circle_at_80%_12%,rgba(236,72,153,0.07),transparent_28%),linear-gradient(135deg,rgba(255,255,255,0.78),rgba(247,243,255,0.58))]" />

      <div className="relative flex h-full min-h-0 flex-col">
        <header className="flex shrink-0 items-start justify-between gap-4">
          <div>
            <h1 className="text-[clamp(1.65rem,2.65vw,3.15rem)] font-black leading-none text-slate-950">{stageHeader?.title}</h1>
            <p className="mt-[clamp(0.65rem,1.15vw,1rem)] max-w-[30rem] text-[clamp(0.88rem,1.15vw,1rem)] font-semibold leading-relaxed text-slate-500">{stageHeader?.description}</p>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <Button variant="secondary" icon={ArrowLeft} onClick={reset} className="rounded-full border border-white/70 bg-white/70 px-[clamp(1rem,1.45vw,1.25rem)] py-[clamp(0.65rem,0.95vw,0.75rem)] text-[clamp(0.88rem,1.1vw,1rem)] text-slate-600 shadow-[0_10px_30px_rgba(83,76,148,0.08)] hover:bg-white [&_svg]:h-[clamp(1rem,1.25vw,1.25rem)] [&_svg]:w-[clamp(1rem,1.25vw,1.25rem)]">
              Back
            </Button>
            {(stage === 'analyzing' || stage === 'cleaning') ? (
              <Button variant="secondary" icon={X} onClick={stopCurrent} className="rounded-full border border-white/70 bg-white/70 px-[clamp(1rem,1.45vw,1.25rem)] py-[clamp(0.65rem,0.95vw,0.75rem)] text-[clamp(0.88rem,1.1vw,1rem)] text-slate-600 shadow-[0_10px_30px_rgba(83,76,148,0.08)] hover:bg-white [&_svg]:h-[clamp(1rem,1.25vw,1.25rem)] [&_svg]:w-[clamp(1rem,1.25vw,1.25rem)]">
                Stop
              </Button>
            ) : (
              <Button variant="secondary" icon={RefreshCcw} onClick={requestAnalyze} className="rounded-full border border-white/70 bg-white/70 px-[clamp(1rem,1.45vw,1.25rem)] py-[clamp(0.65rem,0.95vw,0.75rem)] text-[clamp(0.88rem,1.1vw,1rem)] text-violet-600 shadow-[0_10px_30px_rgba(83,76,148,0.08)] hover:bg-white [&_svg]:h-[clamp(1rem,1.25vw,1.25rem)] [&_svg]:w-[clamp(1rem,1.25vw,1.25rem)]">
                Scan Again
              </Button>
            )}
          </div>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,0.96fr)_minmax(0,1fr)] gap-[clamp(1.25rem,3vw,4rem)]">
          <section className="relative min-h-0 min-w-0 my-auto">
            <div className="relative mx-auto mt-[clamp(0.15rem,0.8vw,1rem)] h-[clamp(290px,42vh,620px)] max-w-[720px]">
              <div className="absolute inset-[8%] rounded-full border border-violet-100" />
              <div className="absolute inset-[18%] rounded-full border border-violet-100" />
              <div className="absolute inset-[28%] rounded-full border border-violet-200" />
              <div className="clean-orbit-marker absolute inset-[18%]" />
              <div className="absolute left-1/2 top-1/2 h-[clamp(160px,14vw,290px)] w-[clamp(160px,14vw,290px)] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/60 bg-[radial-gradient(circle_at_38%_26%,#f3c4ff_0%,#9e72ff_46%,#6847ef_100%)] shadow-[0_28px_90px_rgba(109,93,252,0.32),inset_0_1px_1px_rgba(255,255,255,0.8)]" />
              <div className="absolute left-1/2 top-1/2 z-10 flex h-[clamp(160px,14vw,290px)] w-[clamp(160px,14vw,290px)] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full text-white">
                <Sparkles className="mb-2 h-[clamp(1.45rem,2vw,2rem)] w-[clamp(1.45rem,2vw,2rem)] animate-sparkle" />
                <div className="max-w-[88%] whitespace-nowrap text-center text-[clamp(1.65rem,3vw,3.65rem)] font-black leading-none">{formatGigValue(displaySize).replace(' ', '\u00a0')}</div>
                <div className="mt-[clamp(0.45rem,0.85vw,0.75rem)] text-[clamp(0.9rem,1.25vw,1.125rem)] font-semibold text-white/86">{stage === 'analyzing' ? 'found so far' : 'of junk found'}</div>
              </div>

              {ORBIT_PRESENTATION.map(renderOrbitItem)}
            </div>

            <div className="mx-auto mt-12 flex max-w-[480px] items-center gap-[clamp(0.65rem,1.2vw,1rem)] rounded-[1.15rem]    p-[clamp(0.55rem,1vw,0.85rem)]">
              <div
                className="grid h-[clamp(58px,5vw,72px)] w-[clamp(58px,5vw,72px)] shrink-0 place-items-center rounded-full"
                style={{ background: `conic-gradient(#ef334b ${storageUsedPercent * 3.6}deg, #ece8f5 0deg)` }}
              >
                <div className="grid h-[clamp(42px,3.65vw,52px)] w-[clamp(42px,3.65vw,52px)] place-items-center rounded-full bg-white text-[clamp(0.72rem,0.9vw,0.8rem)] font-black text-slate-950">{storageUsedPercentLabel}</div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[clamp(0.92rem,1.15vw,1rem)] font-black text-slate-950">Storage</div>
                <div className="mt-0.5 text-[clamp(0.76rem,0.9vw,0.82rem)] font-semibold text-slate-500">{storageUsageLabel}</div>
                <div className="mt-3 grid grid-cols-[1fr_auto] items-center gap-4">
                  <div
                    role="progressbar"
                    aria-label="Storage usage"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(storageUsedPercent)}
                    aria-valuetext={storageAriaValueText}
                    className="relative h-1.5 overflow-hidden rounded-full bg-slate-100"
                  >
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-[linear-gradient(90deg,#ef334b,#ff9d9a)] transition-all duration-500"
                      style={{ width: `${storageUsedPercent}%` }}
                    />
                    {storageReclaimableSize > 0 && (
                      <div
                        className="absolute inset-y-0 rounded-r-full bg-[linear-gradient(90deg,#34d399,#5eead4)] shadow-[0_0_10px_rgba(20,184,166,0.45)] transition-all duration-500"
                        style={{
                          left: `${storageUsedAfterCleanupPercent}%`,
                          width: `${storageReclaimablePercent}%`,
                          minWidth: 3,
                        }}
                      />
                    )}
                  </div>
                  <div className="text-[clamp(0.76rem,0.9vw,0.82rem)] font-semibold text-slate-500">{storageCapacityLabel}</div>
                </div>
                {storageReclaimableSize > 0 && (
                  <div className="mt-1.5 inline-flex max-w-full items-center gap-1.5 rounded-full px-2 py-1 text-[clamp(0.66rem,0.8vw,0.74rem)] font-black">
                    <span className="h-1.5 w-4 shrink-0 rounded-full bg-[linear-gradient(90deg,#34d399,#5eead4)]" />
                    <span className="truncate">Will free {storageReclaimableLabel}</span>
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="flex min-h-0 min-w-0 flex-col pt-[clamp(0.4rem,1.65vw,2rem)]">
            <div className="mb-[clamp(0.6rem,1vw,1rem)] flex items-center justify-between gap-3">
              <h2 className="text-[clamp(0.95rem,1.3vw,1.25rem)] font-black text-slate-600">Junk Categories</h2>
              <div className="rounded-full bg-white/70 px-3 py-1 text-[clamp(0.72rem,0.88vw,0.82rem)] font-black text-violet-600 shadow-[0_8px_24px_rgba(83,76,148,0.06)]">
                {categoryItemCountLabel(foundItemCount)}
              </div>
            </div>

            <div className="relative min-h-0 flex-1 overflow-hidden rounded-[1.55rem]">
              <div ref={categoryListRef} onScroll={updateCategoryScrollShadow} className="h-full min-h-0 overflow-auto pr-2 custom-scrollbar">
                <div>
                  {visibleGroups.length > 0 && (
                    <div className="overflow-hidden rounded-[1.55rem] border border-violet-100/75 bg-white/58 shadow-[inset_0_1px_0_rgba(255,255,255,0.84)] backdrop-blur-2xl">
                      {visibleGroups.map(renderCategoryCard)}
                    </div>
                  )}

                  {stage !== 'analyzing' && foundGroups.length === 0 && (
                    <div className="rounded-[1.15rem] border border-violet-100 bg-white/62 p-8 text-center">
                      <Sparkles className="mx-auto h-10 w-10 text-violet-500" />
                      <h3 className="mt-3 text-xl font-black text-slate-950">Ready for a cleanup scan</h3>
                      <p className="mx-auto mt-2 max-w-md text-sm font-semibold leading-relaxed text-slate-500">Mole will scan safe cleanup areas and build review cards from the junk it actually finds.</p>
                    </div>
                  )}
                </div>
              </div>
              {categoryScrollShadow.top && <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-10 rounded-t-[1.55rem] bg-[linear-gradient(to_bottom,rgba(67,56,122,0.14),rgba(67,56,122,0))]" />}
              {categoryScrollShadow.bottom && <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-10 rounded-b-[1.55rem] bg-[linear-gradient(to_top,rgba(67,56,122,0.14),rgba(67,56,122,0))]" />}
            </div>
          </section>
        </div>

        <footer className="mt-[clamp(0.7rem,1.6vw,1.5rem)] flex shrink-0 flex-col items-center gap-[clamp(0.55rem,1vw,0.75rem)]">
          <Button
            icon={stage === 'cleaning' ? Loader2 : Sparkles}
            onClick={startCleaning}
            disabled={stage === 'analyzing' || stage === 'cleaning' || (stage === 'results' && selectedItemCount === 0)}
            size="lg"
            className="min-w-[min(450px,42vw)] rounded-full bg-violet-600 px-[clamp(2rem,3vw,2.5rem)] py-[clamp(0.85rem,1.25vw,1rem)] text-[clamp(0.95rem,1.25vw,1.25rem)] shadow-[0_18px_50px_rgba(109,93,252,0.32)] hover:bg-violet-700 [&_svg]:h-[clamp(1rem,1.35vw,1.25rem)] [&_svg]:w-[clamp(1rem,1.35vw,1.25rem)]"
          >
            {stage === 'analyzing'
                ? `Scanning ${formatGigValue(displaySize)}`
                : stage === 'cleaning'
                  ? `Cleaning ${formatGigValue(cleanedSize)}`
                  : `Start Cleaning ${formatGigValue(selectedSize)}`}
          </Button>
          <div className="flex items-center gap-2 text-[clamp(0.78rem,1vw,0.875rem)] font-bold text-slate-500">
            <Lock className="h-4 w-4" />
            Nothing will be deleted without your permission
          </div>
        </footer>
      </div>
    </div>
  );
}
