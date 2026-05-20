import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Boxes,
  Check,
  ChevronDown,
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
import { usePersistentState } from '@/utils/persistentState';

type Stage = 'idle' | 'analyzing' | 'results' | 'cleaning' | 'complete';
type GroupStatus = 'pending' | 'active' | 'ready' | 'cleaning' | 'complete' | 'empty' | 'error';
type CleanupCommand = 'clean' | 'purge' | 'installer';

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

const STAGES: Stage[] = ['idle', 'analyzing', 'results', 'cleaning', 'complete'];

const GROUP_ICONS: Record<CleanupGroup['icon'], LucideIcon> = {
  system: FileText,
  apps: PackageX,
  developer: Code2,
  projects: Boxes,
  installers: FolderDown,
};

const ORBIT_PRESENTATION: Array<{
  groupId: string;
  label: string;
  icon: LucideIcon;
  iconClassName: string;
  positionClassName: string;
}> = [
  {
    groupId: 'system',
    label: 'System Junk',
    icon: FileText,
    iconClassName: 'bg-rose-100 text-rose-500 shadow-rose-200/70',
    positionClassName: 'left-[39%] top-[3%]',
  },
  {
    groupId: 'apps',
    label: 'Application Junk',
    icon: Sparkles,
    iconClassName: 'bg-violet-100 text-violet-600 shadow-violet-200/70',
    positionClassName: 'left-[-4%] top-[36%]',
  },
  {
    groupId: 'developer',
    label: 'Developer Junk',
    icon: FolderDown,
    iconClassName: 'bg-blue-100 text-blue-500 shadow-blue-200/70',
    positionClassName: 'right-[-4%] top-[36%]',
  },
  {
    groupId: 'projects',
    label: 'Project Artifacts',
    icon: FileText,
    iconClassName: 'bg-orange-100 text-orange-500 shadow-orange-200/70',
    positionClassName: 'left-[9%] bottom-[8%]',
  },
  {
    groupId: 'installers',
    label: 'Installer Files',
    icon: Mail,
    iconClassName: 'bg-green-100 text-green-500 shadow-green-200/70',
    positionClassName: 'right-[1%] bottom-[8%]',
  },
];

const GROUP_DEFINITIONS: Omit<CleanupGroup, 'size' | 'fileCount' | 'items' | 'logs' | 'status' | 'selected' | 'expanded'>[] = [
  {
    id: 'system',
    name: 'System Junk',
    subtitle: 'System caches, user essentials, large files, and storage clues',
    command: 'clean',
    sections: ['System', 'User essentials', 'App caches', 'Apple Silicon', 'Device backups & firmware', 'Time Machine', 'Large files', 'System Data clues'],
    color: '#8b5cf6',
    tint: 'bg-violet-100 text-violet-600 shadow-violet-200/70',
    icon: 'system',
  },
  {
    id: 'apps',
    name: 'Application Junk',
    subtitle: 'Browser data, cloud app caches, app support, and leftovers',
    command: 'clean',
    sections: ['Browsers', 'Cloud & Office', 'Applications', 'Virtualization', 'Application Support', 'App leftovers'],
    color: '#3b82f6',
    tint: 'bg-blue-100 text-blue-500 shadow-blue-200/70',
    icon: 'apps',
  },
  {
    id: 'developer',
    name: 'Developer Junk',
    subtitle: 'Package managers, build caches, simulators, dev tools, and artifact hints',
    command: 'clean',
    sections: ['Developer tools', 'Project artifacts'],
    color: '#f97316',
    tint: 'bg-orange-100 text-orange-500 shadow-orange-200/70',
    icon: 'developer',
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
  title: 'Start a cleanup scan',
  description: 'Scan every cleanup area Mole can safely inspect, then review the junk found before cleaning.',
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
    title: 'Scanning your Mac',
    description: 'Mole is checking cleanup sections and adding junk categories as results stream in.',
  },
  results: {
    title: 'Review junk before cleaning',
    description: 'Choose what stays selected, then start cleaning the matching cleanup groups.',
  },
  cleaning: {
    title: 'Cleaning selected junk',
    description: 'Mole is removing the selected cleanup groups and tracking reclaimed space.',
  },
};

function createInitialGroups(): CleanupGroup[] {
  return GROUP_DEFINITIONS.map((group, index) => ({
    ...group,
    size: 0,
    fileCount: 0,
    items: [],
    logs: [],
    status: 'pending',
    selected: false,
    expanded: index === 0,
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
  return /^[→▸➤]\s+(.+?)$/.test(line);
}

function cleanDisplayLine(line: string) {
  return line
    .replace(/^[✓✔•*\-\s]+/, '')
    .replace(/\s*\((\d+(?:\.\d+)?\s*(?:B|KB|MB|GB|TB))\)\s*$/i, '')
    .replace(/\s+\d+(?:\.\d+)?\s*(?:B|KB|MB|GB|TB)\b\s*$/i, '')
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
    expanded: items.length > 0,
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

function scrollToBottom(element: HTMLDivElement | null) {
  if (!element) return;

  if (typeof element.scrollTo === 'function') {
    element.scrollTo({ top: element.scrollHeight, behavior: 'smooth' });
    return;
  }

  element.scrollTop = element.scrollHeight;
}

export function CleanPage() {
  const [stage, setStage] = usePersistentState<Stage>('mole-clean-stage', 'idle', isStage);
  const [groups, setGroups] = usePersistentState<CleanupGroup[]>('mole-clean-groups', createInitialGroups(), isCleanupGroupArray);
  const [cleanedSize, setCleanedSize] = usePersistentState('mole-clean-cleaned-size', 0, (value): value is number => typeof value === 'number');
  const [liveScanSize, setLiveScanSize] = useState(0);
  const [currentScanItem, setCurrentScanItem] = useState('Ready to inspect safe cleanup targets.');
  const activeGroupRef = useRef<string | null>(null);
  const streamLineIndexRef = useRef(0);
  const categoryListRef = useRef<HTMLDivElement | null>(null);
  const itemListRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const foundGroups = useMemo(() => groups.filter((group) => group.items.length > 0), [groups]);
  const visibleGroups = useMemo(
    () => groups.filter((group) => group.items.length > 0 || group.status === 'active' || group.status === 'cleaning'),
    [groups],
  );
  const totalSize = useMemo(() => groups.reduce((sum, group) => sum + group.size, 0), [groups]);
  const selectedSize = useMemo(
    () => groups.reduce((sum, group) => sum + group.items.filter((item) => item.selected).reduce((itemSum, item) => itemSum + item.size, 0), 0),
    [groups],
  );
  const selectedItemCount = useMemo(() => groups.reduce((sum, group) => sum + group.items.filter((item) => item.selected).length, 0), [groups]);
  const displaySize = stage === 'analyzing' ? Math.max(liveScanSize, totalSize) : totalSize;
  const activeGroup = groups.find((group) => group.status === 'active' || group.status === 'cleaning');
  const activeGroupId = activeGroup?.id;
  const stageHeader = stage === 'idle' || stage === 'complete' ? null : stageCopy[stage];
  const groupActivitySignature = groups.map((group) => `${group.id}:${group.status}:${group.items.length}`).join('|');
  const storageUsageLabel = '200.78 GB of 228.27 GB used';
  const storageCapacityLabel = '228.27 GB';

  useEffect(() => {
    return () => window.moleDesktop?.clean?.removeListeners();
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

  const runGroup = async (group: CleanupGroup, dryRun: boolean) => {
    activeGroupRef.current = group.id;
    streamLineIndexRef.current = 0;
    const output: string[] = [];
    const status = dryRun ? 'active' : 'cleaning';
    let currentSection = '';

    patchGroup(group.id, { status, logs: [], ...(dryRun ? { items: [], size: 0, fileCount: 0, selected: false, expanded: true } : {}) });
    setCurrentScanItem(`Scanning ${group.name.toLowerCase()}...`);
    appendLog(group.id, `$ ${commandLabel(group, dryRun)}`);

    window.moleDesktop.clean.removeListeners();
    window.moleDesktop.clean.onStdout((text) => {
      output.push(text);
      appendLog(group.id, text);

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
          setLiveScanSize((previous) => previous + item.size);
          setCurrentScanItem(item.label);
          patchGroup(group.id, (currentGroup) => {
            if (currentGroup.items.some((existing) => existing.sourceLine === item.sourceLine)) return {};
            const items = [...currentGroup.items, item];
            const size = items.reduce((sum, nextItem) => sum + nextItem.size, 0);
            return {
              items,
              size,
              fileCount: items.length,
              selected: true,
              expanded: true,
              status: 'active',
            };
          });
        } else if (dryRun && !isSummaryLine(line) && !isSkippedLine(line)) {
          setCurrentScanItem(cleanDisplayLine(line));
        }
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

    if (!result.ok && !dryRun) {
      patchGroup(group.id, { status: 'error' });
      appendLog(group.id, result.stderr || 'Command failed', 'error');
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

    for (const group of nextGroups) {
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

  const startCleaning = async () => {
    const groupsToClean = groups.filter((group) => group.items.some((item) => item.selected));
    if (groupsToClean.length === 0) return;

    setStage('cleaning');
    setCleanedSize(0);
    setCurrentScanItem('Preparing selected cleanup...');
    setGroups((previous) => previous.map((group) => ({ ...group, status: group.items.some((item) => item.selected) ? 'pending' : group.status })));

    for (const group of groupsToClean) {
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

  const toggleExpanded = (id: string) => {
    patchGroup(id, (group) => ({ expanded: !group.expanded }));
  };

  const renderOrbitItem = (item: (typeof ORBIT_PRESENTATION)[number], index: number) => {
    const group = groups.find((nextGroup) => nextGroup.id === item.groupId);
    const Icon = item.icon;
    const active = group ? activeGroup?.id === group.id : false;
    const showSize = group && group.size > 0 ? group.size : active && stage === 'analyzing' ? liveScanSize : 0;
    const itemCount = group?.items.length ?? 0;
    const statusLabel = active
      ? 'Scanning now'
      : itemCount > 0
        ? `${itemCount} ${itemCount === 1 ? 'item' : 'items'} found`
        : 'Waiting to scan';

    return (
      <div
        key={item.groupId}
        className={`absolute ${item.positionClassName} z-20 flex min-w-[190px] items-center gap-3 rounded-[1rem] border border-white/74 bg-white/84 px-3.5 py-3 shadow-[0_16px_45px_rgba(83,76,148,0.13)] backdrop-blur-2xl transition-all duration-500 animate-clean-float ${active ? 'scale-105 ring-2 ring-violet-300/70' : ''}`}
        style={{ animationDelay: `${index * -0.45}s` }}
      >
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[0.9rem] ${item.iconClassName}`}>
          <Icon className="h-5 w-5" strokeWidth={2.2} />
        </div>
        <div className="min-w-0">
          <div className="truncate text-base font-black text-slate-950">{item.label}</div>
          <div className="mt-1 flex items-center gap-2 text-xs font-black">
            <span className="text-violet-600">{formatGigValue(showSize)}</span>
            <span className="h-1 w-1 rounded-full bg-slate-300" />
            <span className="truncate text-slate-400">{statusLabel}</span>
          </div>
        </div>
      </div>
    );
  };

  const renderCategoryCard = (group: CleanupGroup) => {
    const Icon = GROUP_ICONS[group.icon];
    const isActive = group.status === 'active' || group.status === 'cleaning';
    const cardSize = group.items.reduce((sum, item) => sum + item.size, 0);

    return (
      <section
        key={group.id}
        className={`rounded-[1.35rem] border bg-white/70 shadow-[0_12px_36px_rgba(67,56,122,0.07)] backdrop-blur-2xl transition-all duration-300 ${
          group.expanded ? 'border-violet-300/95' : 'border-slate-200/70'
        } ${isActive ? 'animate-clean-card-pulse' : ''}`}
      >
        <div className="flex items-center gap-5 px-6 py-5">
          <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full ${group.tint}`}>
            {isActive ? <Loader2 className="h-7 w-7 animate-spin" /> : <Icon className="h-7 w-7" strokeWidth={2.2} />}
          </div>

          <button type="button" onClick={() => toggleExpanded(group.id)} className="min-w-0 flex-1 text-left">
            <h3 className="truncate text-lg font-black leading-tight text-slate-950 sm:text-xl">{group.name}</h3>
            <p className="mt-1.5 line-clamp-2 text-sm font-semibold leading-snug text-slate-500 sm:text-base">{isActive ? currentScanItem : group.subtitle}</p>
          </button>

          <div className="shrink-0 text-right">
            <div className="whitespace-nowrap text-xl font-black text-violet-600 sm:text-2xl">{formatGigValue(cardSize)}</div>
          </div>

          <button
            type="button"
            onClick={() => toggleExpanded(group.id)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-violet-50 hover:text-violet-600"
            aria-label={`${group.expanded ? 'Collapse' : 'Expand'} ${group.name}`}
          >
            {group.expanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </button>
        </div>

        {group.expanded && (
          <div className="px-6 pb-6 pl-[7.9rem]">
            <div
              ref={(element) => {
                itemListRefs.current[group.id] = element;
              }}
              className="max-h-[210px] space-y-3 overflow-y-auto pr-2 custom-scrollbar"
            >
              {group.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggleItem(group.id, item.id)}
                  className="grid w-full grid-cols-[1fr_auto] items-center gap-4 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-violet-50/80"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className={`grid h-2 w-2 shrink-0 place-items-center rounded-full ${item.selected ? 'bg-violet-500' : 'bg-slate-300'}`} />
                    <span className={`line-clamp-2 text-sm font-semibold leading-snug sm:text-base ${item.selected ? 'text-slate-600' : 'text-slate-400'}`}>{item.label}</span>
                  </span>
                  <span className={`whitespace-nowrap text-sm font-black sm:text-base ${item.selected ? 'text-slate-600' : 'text-slate-400'}`}>{formatBytes(item.size)}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>
    );
  };

  if (stage === 'idle') {
    return <StartScreen config={config} onStart={startAnalyze} variant="feature" />;
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
    <div className="relative h-full min-h-0 overflow-hidden bg-[#fbf9ff] px-16 pb-7 pt-10 text-slate-950">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_26%_14%,rgba(109,93,252,0.08),transparent_28%),radial-gradient(circle_at_80%_12%,rgba(236,72,153,0.07),transparent_28%),linear-gradient(135deg,rgba(255,255,255,0.78),rgba(247,243,255,0.58))]" />

      <div className="relative flex h-full min-h-0 flex-col">
        <header className="flex shrink-0 items-start justify-between gap-4">
          <div>
            <h1 className="text-[clamp(2.35rem,3.1vw,3.15rem)] font-black leading-none text-slate-950">{stageHeader?.title}</h1>
            <p className="mt-4 max-w-[30rem] text-base font-semibold leading-relaxed text-slate-500">{stageHeader?.description}</p>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <Button variant="secondary" icon={ArrowLeft} onClick={reset} className="rounded-full border border-white/70 bg-white/70 px-5 text-slate-600 shadow-[0_10px_30px_rgba(83,76,148,0.08)] hover:bg-white">
              Back
            </Button>
            {(stage === 'analyzing' || stage === 'cleaning') ? (
              <Button variant="secondary" icon={X} onClick={stopCurrent} className="rounded-full border border-white/70 bg-white/70 px-5 text-slate-600 shadow-[0_10px_30px_rgba(83,76,148,0.08)] hover:bg-white">
                Stop
              </Button>
            ) : (
              <Button variant="secondary" icon={RefreshCcw} onClick={startAnalyze} className="rounded-full border border-white/70 bg-white/70 px-5 text-violet-600 shadow-[0_10px_30px_rgba(83,76,148,0.08)] hover:bg-white">
                Scan Again
              </Button>
            )}
          </div>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-[minmax(520px,1fr)_minmax(570px,1fr)] gap-16">
          <section className="relative min-h-0">
            <div className="relative mx-auto mt-4 h-[min(53vh,620px)] min-h-[500px] max-w-[720px]">
              <div className="absolute inset-[8%] rounded-full border border-violet-100" />
              <div className="absolute inset-[18%] rounded-full border border-violet-100" />
              <div className="absolute inset-[28%] rounded-full border border-violet-200" />
              <div className="absolute inset-[9%] animate-clean-orbit rounded-full border border-transparent border-r-violet-300 border-t-violet-200" />
              <div className="absolute left-1/2 top-1/2 h-[clamp(230px,15vw,290px)] w-[clamp(230px,15vw,290px)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle_at_38%_26%,#f3c4ff_0%,#9e72ff_46%,#6847ef_100%)] shadow-[0_28px_90px_rgba(109,93,252,0.32),inset_0_1px_1px_rgba(255,255,255,0.8)]" />
              <div className="absolute left-1/2 top-1/2 z-10 flex h-[clamp(230px,15vw,290px)] w-[clamp(230px,15vw,290px)] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full text-white">
                <Sparkles className="mb-2 h-8 w-8 animate-sparkle" />
                <div className="max-w-[88%] whitespace-nowrap text-center text-[clamp(2rem,3.45vw,3.65rem)] font-black leading-none">{formatGigValue(displaySize).replace(' ', '\u00a0')}</div>
                <div className="mt-3 text-lg font-semibold text-white/86">{stage === 'analyzing' ? 'found so far' : 'of junk found'}</div>
              </div>

              {ORBIT_PRESENTATION.map(renderOrbitItem)}
            </div>

            <div className="mx-auto -mt-4 flex max-w-[560px] items-center gap-5 rounded-[1.3rem] border border-white/75 bg-white/76 p-4 shadow-[0_18px_54px_rgba(83,76,148,0.10)] backdrop-blur-2xl">
              <div
                className="grid h-[84px] w-[84px] shrink-0 place-items-center rounded-full"
                style={{ background: 'conic-gradient(#ef334b 316.8deg, #ece8f5 0deg)' }}
              >
                <div className="grid h-[60px] w-[60px] place-items-center rounded-full bg-white text-sm font-black text-slate-950">88%</div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-lg font-black text-slate-950">Storage</div>
                <div className="mt-1 text-sm font-semibold text-slate-500">{storageUsageLabel}</div>
                <div className="mt-4 grid grid-cols-[1fr_auto] items-center gap-5">
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full w-[88%] rounded-full bg-[linear-gradient(90deg,#ef334b,#ff9d9a)] transition-all duration-500" />
                  </div>
                  <div className="text-sm font-semibold text-slate-500">{storageCapacityLabel}</div>
                </div>
              </div>
            </div>
          </section>

          <section className="flex min-h-0 flex-col pt-8">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-xl font-black text-slate-600">Junk Categories</h2>
            </div>

            <div ref={categoryListRef} className="min-h-0 flex-1 overflow-y-auto pr-2 custom-scrollbar">
              <div className="space-y-3">
                {visibleGroups.map(renderCategoryCard)}

                {stage === 'analyzing' && (
                  <div className="rounded-[1.15rem] border border-dashed border-violet-200 bg-white/48 p-5 shadow-[0_12px_36px_rgba(67,56,122,0.05)] backdrop-blur-2xl">
                    <div className="flex items-center gap-4">
                      <div className="flex h-[3.25rem] w-[3.25rem] items-center justify-center rounded-full bg-violet-100 text-violet-600">
                        <Loader2 className="h-6 w-6 animate-spin" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-lg font-black text-slate-950">Finding more junk</div>
                        <div className="mt-1 truncate text-sm font-semibold text-slate-500">{currentScanItem}</div>
                      </div>
                    </div>
                  </div>
                )}

                {stage !== 'analyzing' && foundGroups.length === 0 && (
                  <div className="rounded-[1.15rem] border border-violet-100 bg-white/62 p-8 text-center shadow-[0_12px_36px_rgba(67,56,122,0.05)]">
                    <Sparkles className="mx-auto h-10 w-10 text-violet-500" />
                    <h3 className="mt-3 text-xl font-black text-slate-950">Ready for a cleanup scan</h3>
                    <p className="mx-auto mt-2 max-w-md text-sm font-semibold leading-relaxed text-slate-500">Mole will scan safe cleanup areas and build review cards from the junk it actually finds.</p>
                  </div>
                )}

                {stage === 'results' && foundGroups.length > 0 && (
                  <div className="rounded-[1.15rem] border border-violet-100 bg-violet-50/70 p-4 shadow-[0_12px_36px_rgba(67,56,122,0.05)]">
                    <div className="flex items-center gap-4">
                      <Sparkles className="h-8 w-8 shrink-0 text-violet-600" />
                      <div>
                        <div className="text-base font-black text-violet-700">Review before cleaning</div>
                        <div className="mt-1 text-sm font-semibold text-slate-500">Select the junk items you want included. Mole will ask the CLI to clean the matching cleanup groups.</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>

        <footer className="mt-6 flex shrink-0 flex-col items-center gap-3">
          <Button
            icon={stage === 'cleaning' ? Loader2 : Sparkles}
            onClick={startCleaning}
            disabled={stage === 'analyzing' || stage === 'cleaning' || (stage === 'results' && selectedItemCount === 0)}
            size="lg"
            className="min-w-[450px] rounded-full bg-violet-600 px-10 py-4 text-xl shadow-[0_18px_50px_rgba(109,93,252,0.32)] hover:bg-violet-700"
          >
            {stage === 'analyzing'
                ? `Scanning ${formatGigValue(displaySize)}`
                : stage === 'cleaning'
                  ? `Cleaning ${formatGigValue(cleanedSize)}`
                  : `Start Cleaning ${formatGigValue(selectedSize)}`}
          </Button>
          <div className="flex items-center gap-2 text-sm font-bold text-slate-500">
            <Lock className="h-4 w-4" />
            Nothing will be deleted without your permission
          </div>
        </footer>
      </div>
    </div>
  );
}
