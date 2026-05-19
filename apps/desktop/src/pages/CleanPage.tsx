import { useEffect, useMemo, useRef } from 'react';
import {
  Search,
  Sparkles,
  Trash2,
  Check,
  ArrowLeft,
  X,
  Clock,
  CheckCircle2,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  ArrowUpDown,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { StartScreen } from '@/components/common/StartScreen';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { formatBytes, stripAnsi, parseSizeToBytes } from '@/utils/format';
import { usePersistentState } from '@/utils/persistentState';
import type { PageConfig, CleanCategory } from '@/types';

type Stage = 'idle' | 'scanning' | 'results' | 'cleaning' | 'complete';

const STAGES: Stage[] = ['idle', 'scanning', 'results', 'cleaning', 'complete'];

interface LogEntry {
  text: string;
  timestamp: number;
  type: 'info' | 'success' | 'error';
}

interface TimelineStage {
  id: string;
  name: string;
  status: 'pending' | 'active' | 'complete' | 'error';
  items: string[];
  size?: number;
  startTime?: number;
  endTime?: number;
}

interface CleanSectionMeta {
  section: string;
  name: string;
  icon: string;
  color: string;
  description: string;
}

const CLEAN_SECTIONS: CleanSectionMeta[] = [
  {
    section: 'System',
    name: 'System Caches',
    icon: 'Shield',
    color: '#3b82f6',
    description: 'Privileged system caches, temporary files, local snapshots, and rebuildable system artifacts.',
  },
  {
    section: 'User essentials',
    name: 'User Caches',
    icon: 'User',
    color: '#8b5cf6',
    description: 'User cache folders, temporary files, Finder metadata, and common macOS leftovers.',
  },
  {
    section: 'App caches',
    name: 'App Caches',
    icon: 'Package',
    color: '#06b6d4',
    description: 'Sandboxed and standard app cache directories that can be rebuilt by applications.',
  },
  {
    section: 'Browsers',
    name: 'Browser Data',
    icon: 'Globe',
    color: '#10b981',
    description: 'Browser caches, code caches, GPU caches, crash reports, and old browser versions.',
  },
  {
    section: 'Cloud & Office',
    name: 'Cloud & Office',
    icon: 'Cloud',
    color: '#14b8a6',
    description: 'Rebuildable cache and temporary data from cloud sync and productivity applications.',
  },
  {
    section: 'Developer tools',
    name: 'Developer Tools',
    icon: 'Code',
    color: '#ec4899',
    description: 'Build caches, package manager caches, simulator data, and development tool temporary files.',
  },
  {
    section: 'Applications',
    name: 'Applications',
    icon: 'AppWindow',
    color: '#f97316',
    description: 'GUI application caches and logs that are safe to recreate.',
  },
  {
    section: 'Virtualization',
    name: 'Virtualization',
    icon: 'Boxes',
    color: '#6366f1',
    description: 'Virtualization tool caches and temporary files.',
  },
  {
    section: 'Application Support',
    name: 'Application Support',
    icon: 'FolderCog',
    color: '#0ea5e9',
    description: 'Bounded Application Support log, cache, and temporary folders.',
  },
  {
    section: 'App leftovers',
    name: 'App Leftovers',
    icon: 'ArchiveX',
    color: '#ef4444',
    description: 'Orphaned app data, inactive service files, container stubs, and related cleanup hints.',
  },
  {
    section: 'Apple Silicon',
    name: 'Apple Silicon',
    icon: 'Cpu',
    color: '#a855f7',
    description: 'Apple Silicon and Rosetta rebuildable runtime caches.',
  },
  {
    section: 'Device backups & firmware',
    name: 'Device Backups & Firmware',
    icon: 'HardDrive',
    color: '#22c55e',
    description: 'Cached device firmware and iOS backup review hints.',
  },
  {
    section: 'Time Machine',
    name: 'Time Machine',
    icon: 'History',
    color: '#84cc16',
    description: 'Failed or incomplete Time Machine backup artifacts.',
  },
  {
    section: 'Large files',
    name: 'Large Files',
    icon: 'FileSearch',
    color: '#f59e0b',
    description: 'Large file candidates that Mole reports for review instead of deleting automatically.',
  },
  {
    section: 'System Data clues',
    name: 'System Data Clues',
    icon: 'Info',
    color: '#64748b',
    description: 'Hints that explain storage counted by macOS as System Data.',
  },
  {
    section: 'Project artifacts',
    name: 'Project Artifacts',
    icon: 'Hammer',
    color: '#d946ef',
    description: 'Project build artifact hints. Use Purge for deeper project cleanup.',
  },
];

const SECTION_NAMES = new Set(CLEAN_SECTIONS.map((section) => section.section));
const HINT_ONLY_SECTIONS = new Set(['Large files', 'System Data clues', 'Project artifacts']);
const SOFT_CARD = 'rounded-[1.75rem] border border-white/55 bg-white/35 backdrop-blur-2xl';
const CLEAN_SHELL = 'relative h-full min-h-0 overflow-hidden p-2';
const CLEAN_ACCENT_BG = 'pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_88%_16%,rgba(59,130,246,0.16),transparent_34%),radial-gradient(circle_at_16%_88%,rgba(109,93,252,0.12),transparent_38%)]';
const LIST_CARD = `relative overflow-hidden rounded-[1.5rem] p-4 ${SOFT_CARD}`;
const MUTED_PILL = 'rounded-full border border-white/60 bg-white/35 shadow-inner shadow-white/30 backdrop-blur-xl';

const config: PageConfig = {
  title: 'Cleanup',
  description: 'Remove unnecessary files, caches, and temporary data to free up valuable disk space.',
  icon: 'Sparkles',
  buttonText: 'Start Cleaning',
  items: [
    {
      icon: 'HardDrive',
      title: 'System & User Caches',
      description: 'Remove temporary files and system caches',
    },
    {
      icon: 'Globe',
      title: 'Browser Data',
      description: 'Clear browser caches and temporary files',
    },
    {
      icon: 'Package',
      title: 'App Leftovers',
      description: 'Remove orphaned app data and logs',
    },
    {
      icon: 'Code',
      title: 'Developer Tools',
      description: 'Clean build caches and temporary files',
    },
  ],
};

function getSectionMeta(section: string): CleanSectionMeta {
  return (
    CLEAN_SECTIONS.find((item) => item.section === section) ?? {
      section,
      name: section,
      icon: 'Sparkles',
      color: '#6d5dfc',
      description: 'Cleanup section reported by Mole.',
    }
  );
}

function parseSectionHeader(line: string) {
  const sectionMatch = line.match(/^[→▸➤]\s+(.+?)$/);
  const sectionName = sectionMatch?.[1]?.trim();
  return sectionName && SECTION_NAMES.has(sectionName) ? sectionName : null;
}

function parseLineSize(line: string) {
  const sizeMatch = line.match(/(\d+(?:\.\d+)?)\s*(B|KB|MB|GB|TB)/i);
  if (!sizeMatch) return 0;
  return parseSizeToBytes(parseFloat(sizeMatch[1]), sizeMatch[2]);
}

function isSkippedLine(line: string) {
  return /skipp|protected|whitelist|already clean|nothing to clean|requires sudo|not available|not found|running/i.test(line);
}

function isSummaryLine(line: string) {
  return (
    line.startsWith('#') ||
    /^(Dry run complete|Cleanup complete|Test mode complete|Potential space:|Space freed:|Detailed file list:|Use mo clean|Free space now:)/i.test(
      line,
    )
  );
}

function isStage(value: unknown): value is Stage {
  return typeof value === 'string' && STAGES.includes(value as Stage);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isSortBy(value: unknown): value is 'size' | 'name' {
  return value === 'size' || value === 'name';
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isCleanCategory(value: unknown): value is CleanCategory {
  if (!value || typeof value !== 'object') return false;

  const category = value as Record<string, unknown>;
  return (
    typeof category.section === 'string' &&
    typeof category.name === 'string' &&
    typeof category.icon === 'string' &&
    typeof category.color === 'string' &&
    isFiniteNumber(category.size) &&
    isFiniteNumber(category.fileCount) &&
    isStringArray(category.items) &&
    typeof category.cleanable === 'boolean' &&
    typeof category.scanned === 'boolean'
  );
}

function isCleanCategoryArray(value: unknown): value is CleanCategory[] {
  return Array.isArray(value) && value.every(isCleanCategory);
}

function isTimelineStage(value: unknown): value is TimelineStage {
  if (!value || typeof value !== 'object') return false;

  const timelineStage = value as Record<string, unknown>;
  return (
    typeof timelineStage.id === 'string' &&
    typeof timelineStage.name === 'string' &&
    ['pending', 'active', 'complete', 'error'].includes(String(timelineStage.status)) &&
    isStringArray(timelineStage.items) &&
    (timelineStage.size === undefined || isFiniteNumber(timelineStage.size)) &&
    (timelineStage.startTime === undefined || isFiniteNumber(timelineStage.startTime)) &&
    (timelineStage.endTime === undefined || isFiniteNumber(timelineStage.endTime))
  );
}

function isTimelineStageArray(value: unknown): value is TimelineStage[] {
  return Array.isArray(value) && value.every(isTimelineStage);
}

export function CleanPage() {
  const [stage, setStage] = usePersistentState<Stage>('mole-clean-stage', 'idle', isStage);
  const [categories, setCategories] = usePersistentState<CleanCategory[]>('mole-clean-categories', [], isCleanCategoryArray);
  const [totalSize, setTotalSize] = usePersistentState('mole-clean-total-size', 0, isFiniteNumber);
  const [cleanedSize, setCleanedSize] = usePersistentState('mole-clean-cleaned-size', 0, isFiniteNumber);
  const [, setLogs] = usePersistentState<LogEntry[]>('mole-clean-logs', []);
  const [timeline, setTimeline] = usePersistentState<TimelineStage[]>('mole-clean-timeline', [], isTimelineStageArray);
  const [selectedSections, setSelectedSections] = usePersistentState<string[]>('mole-clean-selected-sections', [], isStringArray);
  const [expandedSections, setExpandedSections] = usePersistentState<string[]>('mole-clean-expanded-sections', [], isStringArray);
  const [sortBy, setSortBy] = usePersistentState<'size' | 'name'>('mole-clean-sort-by', 'size', isSortBy);

  const timelineScrollRef = useRef<HTMLDivElement | null>(null);
  const autoScrollTimelineRef = useRef(true);

  const selectedCategories = useMemo(
    () => categories.filter((category) => category.cleanable && selectedSections.includes(category.section)),
    [categories, selectedSections],
  );
  const selectedSize = useMemo(
    () => selectedCategories.reduce((sum, category) => sum + category.size, 0),
    [selectedCategories],
  );
  const sortedCategories = useMemo(() => {
    return [...categories].sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      }

      return b.size - a.size || a.name.localeCompare(b.name);
    });
  }, [categories, sortBy]);

  useEffect(() => {
    return () => {
      if (window.moleDesktop?.clean) {
        window.moleDesktop.clean.removeListeners();
      }
    };
  }, []);

  useEffect(() => {
    if ((stage !== 'scanning' && stage !== 'cleaning') || !autoScrollTimelineRef.current) return;

    requestAnimationFrame(() => {
      const scrollContainer = timelineScrollRef.current;
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    });
  }, [timeline, stage]);

  const handleTimelineScroll = () => {
    const scrollContainer = timelineScrollRef.current;
    if (!scrollContainer) return;

    const distanceFromBottom =
      scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight;
    autoScrollTimelineRef.current = distanceFromBottom < 24;
  };

  const stopScan = async () => {
    addLog('Stopping scan...', 'info');
    const result = await window.moleDesktop.clean.kill();
    if (result.ok) {
      addLog('Scan stopped by user', 'error');
    } else {
      addLog('No active scan to stop', 'error');
      setStage('idle');
      window.moleDesktop.clean.removeListeners();
    }
  };

  const stopCleaning = async () => {
    addLog('Stopping cleanup...', 'info');
    const result = await window.moleDesktop.clean.kill();
    if (result.ok) {
      addLog('Cleanup stopped by user', 'error');
    } else {
      addLog('No active cleanup to stop', 'error');
      setStage('results');
      window.moleDesktop.clean.removeListeners();
    }
  };

  const addLog = (text: string, type: LogEntry['type'] = 'info') => {
    const cleanText = stripAnsi(text).trim();
    if (cleanText) {
      const logEntry = { text: cleanText, timestamp: Date.now(), type };
      setLogs((prev) => [...prev, logEntry]);

      const timestamp = new Date().toLocaleTimeString();
      const prefix = `[Mole Clean ${timestamp}]`;

      if (type === 'error') {
        console.error(prefix, cleanText);
      } else if (type === 'success') {
        console.log(`%c${prefix} ${cleanText}`, 'color: #10b981; font-weight: bold');
      } else {
        console.log(prefix, cleanText);
      }
    }
  };

  const parseTimelineLine = (line: string) => {
    const sectionName = parseSectionHeader(line);

    if (sectionName) {
      setTimeline((prev) => {
        const updated = prev.map((timelineStage) =>
          timelineStage.status === 'active'
            ? { ...timelineStage, status: 'complete' as const, endTime: Date.now() }
            : timelineStage,
        );

        const existingIndex = updated.findIndex((timelineStage) => timelineStage.name === sectionName);
        if (existingIndex >= 0) {
          updated[existingIndex] = {
            ...updated[existingIndex],
            status: 'active',
            startTime: Date.now(),
          };
          return updated;
        }

        return [
          ...updated,
          {
            id: `stage-${Date.now()}-${sectionName}`,
            name: sectionName,
            status: 'active',
            items: [],
            startTime: Date.now(),
          },
        ];
      });
      return;
    }

    if (!line || isSummaryLine(line)) return;

    setTimeline((prev) => {
      const activeIndex = prev.findIndex((timelineStage) => timelineStage.status === 'active');
      if (activeIndex < 0) return prev;

      const itemSize = isSkippedLine(line) ? 0 : parseLineSize(line);
      const updated = [...prev];
      updated[activeIndex] = {
        ...updated[activeIndex],
        items: [...updated[activeIndex].items, line],
        size: (updated[activeIndex].size || 0) + itemSize,
      };
      return updated;
    });
  };

  const parseTimelineFromLog = (text: string) => {
    stripAnsi(text)
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach(parseTimelineLine);
  };

  const startScan = async () => {
    setStage('scanning');
    setCategories([]);
    setTotalSize(0);
    setCleanedSize(0);
    setLogs([]);
    setTimeline([]);
    setSelectedSections([]);
    setExpandedSections([]);
    autoScrollTimelineRef.current = true;

    const outputBuffer: string[] = [];

    addLog('Starting system scan...', 'info');

    window.moleDesktop.clean.onStdout((text) => {
      outputBuffer.push(text);
      addLog(text, 'info');
      parseTimelineFromLog(text);
    });

    window.moleDesktop.clean.onStderr((text) => {
      console.error('Clean stderr:', text);
      addLog(text, 'error');
    });

    try {
      const result = await window.moleDesktop.clean.execute({ dryRun: true });

      if (result.ok) {
        const parsedCategories = parseFinalResults(outputBuffer.join(''));
        const nextSelectedSections = parsedCategories
          .filter((category) => category.cleanable)
          .map((category) => category.section);
        const total = parsedCategories.reduce((sum, cat) => sum + cat.size, 0);

        setCategories(parsedCategories);
        setSelectedSections(nextSelectedSections);
        setTotalSize(total);
        addLog(`Scan complete! Found ${formatBytes(total)} of cleanable data`, 'success');
        setStage('results');
      } else if (result.killed) {
        addLog('Scan was cancelled', 'error');
        setStage('idle');
      } else {
        addLog(`Scan failed: ${result.stderr}`, 'error');
        setStage('idle');
      }
    } catch (error) {
      console.error('Clean scan error:', error);
      addLog(`Error: ${error}`, 'error');
      setStage('idle');
    } finally {
      setTimeline((prev) =>
        prev.map((timelineStage) =>
          timelineStage.status === 'active'
            ? { ...timelineStage, status: 'complete' as const, endTime: Date.now() }
            : timelineStage,
        ),
      );
      window.moleDesktop.clean.removeListeners();
    }
  };

  const startCleaning = async () => {
    const sectionsToClean = selectedCategories.map((category) => category.section);
    const targetSize = selectedSize;

    if (sectionsToClean.length === 0) return;

    setStage('cleaning');
    setCleanedSize(0);
    setLogs([]);
    setTimeline([]);
    autoScrollTimelineRef.current = true;

    addLog(`Starting cleanup operation for ${sectionsToClean.length} selected sections...`, 'info');

    window.moleDesktop.clean.onStdout((text) => {
      addLog(text, 'info');
      parseTimelineFromLog(text);

      const bytes = parseLineSize(text);
      if (bytes > 0 && !isSkippedLine(text)) {
        setCleanedSize((prev) => Math.min(prev + bytes, targetSize));
      }
    });

    window.moleDesktop.clean.onStderr((text) => {
      console.error('Clean stderr:', text);
      addLog(text, 'error');
    });

    try {
      const result = await window.moleDesktop.clean.execute({ dryRun: false, sections: sectionsToClean });

      if (result.ok) {
        setCleanedSize(targetSize);
        addLog(`Cleanup complete! Freed ${formatBytes(targetSize)}`, 'success');
        setStage('complete');
      } else if (result.killed) {
        addLog('Cleanup was cancelled', 'error');
        setStage('results');
      } else {
        addLog('Cleanup failed', 'error');
        setStage('results');
      }
    } catch (error) {
      console.error('Clean error:', error);
      addLog(`Error: ${error}`, 'error');
      setStage('results');
    } finally {
      setTimeline((prev) =>
        prev.map((timelineStage) =>
          timelineStage.status === 'active'
            ? { ...timelineStage, status: 'complete' as const, endTime: Date.now() }
            : timelineStage,
        ),
      );
      window.moleDesktop.clean.removeListeners();
    }
  };

  const parseFinalResults = (output: string): CleanCategory[] => {
    const categoryData: Record<string, CleanCategory> = {};
    let currentSection: string | null = null;

    for (const meta of CLEAN_SECTIONS) {
      categoryData[meta.section] = {
        ...meta,
        size: 0,
        fileCount: 0,
        items: [],
        cleanable: false,
        scanned: false,
      };
    }

    for (const rawLine of output.split('\n')) {
      const line = stripAnsi(rawLine).trim();
      if (!line) continue;

      const sectionName = parseSectionHeader(line);
      if (sectionName) {
        currentSection = sectionName;
        categoryData[sectionName].scanned = true;
        continue;
      }

      if (line.includes('System caches need sudo')) {
        categoryData.System.items.push('System preview skipped because sudo is not currently cached.');
        continue;
      }

      if (!currentSection || isSummaryLine(line)) {
        if (isSummaryLine(line)) currentSection = null;
        continue;
      }

      const category = categoryData[currentSection];
      const bytes = isSkippedLine(line) || HINT_ONLY_SECTIONS.has(currentSection) ? 0 : parseLineSize(line);

      category.items.push(line);
      if (bytes > 0) {
        category.size += bytes;
        category.fileCount += 1;
      }
    }

    return CLEAN_SECTIONS.map((meta) => {
      const category = categoryData[meta.section];
      return {
        ...category,
        cleanable: category.size > 0 && !HINT_ONLY_SECTIONS.has(category.section),
        items:
          category.items.length > 0
            ? category.items
            : [category.scanned ? 'No cleanable files found in this section.' : 'This section was not scanned.'],
      };
    });
  };

  const reset = () => {
    setStage('idle');
    setCategories([]);
    setTotalSize(0);
    setCleanedSize(0);
    setLogs([]);
    setTimeline([]);
    setSelectedSections([]);
    setExpandedSections([]);
  };

  const toggleSelectedSection = (category: CleanCategory) => {
    if (!category.cleanable) return;

    setSelectedSections((prev) =>
      prev.includes(category.section)
        ? prev.filter((section) => section !== category.section)
        : [...prev, category.section],
    );
  };

  const toggleExpandedSection = (section: string) => {
    setExpandedSections((prev) =>
      prev.includes(section) ? prev.filter((item) => item !== section) : [...prev, section],
    );
  };

  const selectAllCleanable = () => {
    setSelectedSections(categories.filter((category) => category.cleanable).map((category) => category.section));
  };

  const clearSelection = () => {
    setSelectedSections([]);
  };

  const renderTimeline = (title: string, Icon: LucideIcon, emptyText: string, activeText: string, sizeClass: string) => (
    <Card
      ref={timelineScrollRef}
      className={`${LIST_CARD} h-full overflow-y-auto custom-scrollbar`}
      onScroll={handleTimelineScroll}
    >
      <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-950">
        <Icon className="w-4 h-4 text-blue-500" />
        {title}
      </h3>
      <div className="space-y-4">
        {timeline.map((timelineStage, index) => {
          const isExpanded = timelineStage.status === 'active' || expandedSections.includes(timelineStage.name);
          const visibleItems = isExpanded ? timelineStage.items : timelineStage.items.slice(-3);

          return (
            <div key={timelineStage.id} className="relative">
              {index < timeline.length - 1 && (
                <div className="absolute left-4 bottom-0 top-10 w-0.5 bg-gradient-to-b from-blue-400/35 to-transparent" />
              )}

              <div className="flex gap-3">
                <div className="relative z-10">
                  {timelineStage.status === 'active' && (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full border border-blue-200/70 bg-blue-100/35 shadow-[0_10px_24px_rgba(59,130,246,0.14)] backdrop-blur-xl">
                      <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                    </div>
                  )}
                  {timelineStage.status === 'complete' && (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full border border-emerald-200/70 bg-emerald-100/35 shadow-[0_10px_24px_rgba(16,185,129,0.14)] backdrop-blur-xl">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    </div>
                  )}
                  {timelineStage.status === 'error' && (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full border border-red-200/70 bg-red-100/35 shadow-[0_10px_24px_rgba(239,68,68,0.14)] backdrop-blur-xl">
                      <AlertCircle className="w-4 h-4 text-red-500" />
                    </div>
                  )}
                  {timelineStage.status === 'pending' && (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/60 bg-white/35 shadow-inner shadow-white/30 backdrop-blur-xl">
                      <Clock className="w-4 h-4 text-slate-400" />
                    </div>
                  )}
                </div>

                <div className="flex-1 pb-4 min-w-0">
                  <button
                    type="button"
                    onClick={() => toggleExpandedSection(timelineStage.name)}
                    className="flex w-full items-center justify-between gap-3 text-left"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
                      ) : (
                        <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                      )}
                      <span className="truncate font-bold text-slate-950">{timelineStage.name}</span>
                    </span>
                    {timelineStage.size && timelineStage.size > 0 && (
                      <span className={`shrink-0 text-xs font-bold ${sizeClass}`}>{formatBytes(timelineStage.size)}</span>
                    )}
                  </button>

                  {timelineStage.items.length > 0 && (
                    <div className="space-y-1 mt-2 pl-6">
                      {visibleItems.map((item, itemIndex) => (
                        <div key={`${item}-${itemIndex}`} className="break-words text-xs font-medium text-slate-500">
                          {item}
                        </div>
                      ))}
                      {!isExpanded && timelineStage.items.length > 3 && (
                        <div className="text-xs font-medium italic text-slate-400">
                          +{timelineStage.items.length - 3} more items
                        </div>
                      )}
                    </div>
                  )}

                  {timelineStage.status === 'active' && timelineStage.items.length === 0 && (
                    <div className="mt-2 pl-6 text-xs font-medium italic text-slate-400">{activeText}</div>
                  )}

                  {timelineStage.startTime && timelineStage.endTime && (
                    <div className="mt-1 pl-6 text-xs font-medium text-slate-400">
                      Completed in {((timelineStage.endTime - timelineStage.startTime) / 1000).toFixed(1)}s
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {timeline.length === 0 && (
          <div className="py-8 text-center text-slate-400">
            <Icon className="mx-auto mb-2 h-8 w-8 opacity-50" />
            <p className="text-sm font-medium">{emptyText}</p>
          </div>
        )}
      </div>
    </Card>
  );

  if (stage === 'idle') {
    return <StartScreen config={config} onStart={startScan} variant="feature" />;
  }

  if (stage === 'scanning') {
    return (
      <div className={CLEAN_SHELL}>
        <div className={CLEAN_ACCENT_BG} />
        <div className="relative flex h-full min-h-0 flex-col gap-2">
          <div className="px-4 pb-4 pt-3 text-center">
            <div className="mb-4 inline-flex rounded-full border border-blue-200/70 bg-blue-100/35 p-6 shadow-[0_18px_48px_rgba(59,130,246,0.18)] backdrop-blur-xl">
              <Search className="h-12 w-12 animate-pulse text-blue-500" />
            </div>
            <h2 className="mb-2 text-3xl font-black tracking-[-0.045em] text-slate-950">Scanning System...</h2>
            <p className="font-medium text-slate-600">Analyzing cleanup sections and collecting details</p>
          </div>

          <div className="min-h-0 flex-1 rounded-[1.75rem] p-2">
            {renderTimeline('Scan Progress', Clock, 'Initializing scan...', 'Scanning...', 'text-blue-500')}
          </div>

          <div className="flex justify-center px-4 py-4">
            <Button variant="secondary" icon={X} onClick={stopScan} className="rounded-full bg-white/45 px-5 text-slate-800 shadow-[0_12px_28px_rgba(15,23,42,0.08)] hover:bg-white/60">
              Stop Scan
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (stage === 'results') {
    return (
      <div className={CLEAN_SHELL}>
        <div className={CLEAN_ACCENT_BG} />
        <div className="relative flex h-full min-h-0 flex-col gap-2">
          <div className="px-4 pb-4 pt-3">
            <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <h2 className="mb-1 text-3xl font-black tracking-[-0.045em] text-slate-950">Scan Results</h2>
                <p className="text-sm font-semibold text-slate-500">
                  Found {formatBytes(totalSize)} of cleanable data. Selected {formatBytes(selectedSize)}.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-start gap-2 lg:justify-end">
                <Button
                  variant="ghost"
                  icon={ArrowLeft}
                  onClick={reset}
                  size="sm"
                  className="rounded-full px-3 text-slate-500 hover:bg-red-500/10 hover:text-red-500"
                >
                  Back
                </Button>
                <Button
                  variant="secondary"
                  onClick={selectAllCleanable}
                  size="sm"
                  className="rounded-full bg-white/45 px-4 text-slate-800 shadow-[0_12px_28px_rgba(15,23,42,0.08)] hover:bg-white/60"
                >
                  Select All
                </Button>
                <Button
                  variant="secondary"
                  onClick={clearSelection}
                  size="sm"
                  className="rounded-full bg-white/45 px-4 text-slate-800 shadow-[0_12px_28px_rgba(15,23,42,0.08)] hover:bg-white/60"
                >
                  Clear
                </Button>
                <Button
                  icon={Trash2}
                  onClick={startCleaning}
                  size="sm"
                  className="rounded-full bg-blue-500 px-5 shadow-[0_18px_40px_rgba(59,130,246,0.24)] hover:bg-blue-600"
                  disabled={selectedSize === 0}
                >
                  Clean Selected
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Card className={`${LIST_CARD} border-blue-200/60`}>
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-200/70 bg-blue-100/35 shadow-[0_12px_30px_rgba(59,130,246,0.14)] backdrop-blur-xl">
                    <Sparkles className="h-6 w-6 text-blue-500" />
                  </div>
                  <div>
                    <div className="text-2xl font-black tracking-[-0.035em] text-slate-950">{formatBytes(selectedSize)}</div>
                    <div className="text-sm font-medium text-slate-500">Selected to Clean</div>
                  </div>
                </div>
              </Card>

              <Card className={LIST_CARD}>
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-200/70 bg-violet-100/35 shadow-[0_12px_30px_rgba(109,93,252,0.14)] backdrop-blur-xl">
                    <Trash2 className="h-6 w-6 text-violet-500" />
                  </div>
                  <div>
                    <div className="text-2xl font-black tracking-[-0.035em] text-slate-950">{selectedCategories.length}</div>
                    <div className="text-sm font-medium text-slate-500">Sections Selected</div>
                  </div>
                </div>
              </Card>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 px-4 pb-2">
            <div className="text-sm font-bold text-slate-950">Cleanup Sections</div>
            <div className={`flex items-center gap-2 px-4 py-3 ${MUTED_PILL}`}>
              <ArrowUpDown className="h-4 w-4 text-slate-400" />
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as 'size' | 'name')}
                className="cursor-pointer bg-transparent text-sm font-semibold text-slate-700 focus:outline-none"
                aria-label="Sort cleanup sections"
              >
                <option value="size">Sort by Size</option>
                <option value="name">Sort by Name</option>
              </select>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto rounded-[1.75rem] p-2 custom-scrollbar">
            <div className="space-y-2">
              {sortedCategories.map((category) => {
                const meta = getSectionMeta(category.section);
                const isSelected = selectedSections.includes(category.section);
                const isExpanded = expandedSections.includes(category.section);

                return (
                  <Card
                    key={category.section}
                    className={`${LIST_CARD} cursor-pointer transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/45 ${
                      isSelected ? 'bg-white/55 ring-2 ring-blue-400' : ''
                    } ${!category.cleanable ? 'cursor-default opacity-70 hover:translate-y-0' : ''}`}
                    onClick={() => toggleSelectedSection(category)}
                  >
                    <div className="flex items-start gap-4">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={!category.cleanable}
                        onChange={() => toggleSelectedSection(category)}
                        onClick={(event) => event.stopPropagation()}
                        className="sr-only"
                        aria-label={`Select ${category.name}`}
                      />
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/60 shadow-[0_10px_24px_rgba(15,23,42,0.10)] backdrop-blur-xl"
                        style={{ backgroundColor: `${category.color}20`, color: category.color }}
                      >
                        <Sparkles className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <h3 className="font-bold text-slate-950">{category.name}</h3>
                            <p className="truncate text-sm font-medium text-slate-500">
                              {category.cleanable
                                ? `${category.fileCount} items - ${formatBytes(category.size)}`
                                : category.scanned
                                  ? 'No cleanable data found'
                                  : 'Not scanned'}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <div className="text-lg font-black tracking-[-0.03em] text-slate-950">{formatBytes(category.size)}</div>
                            <div className={`text-xs font-bold ${category.cleanable ? 'text-emerald-500' : 'text-slate-400'}`}>
                              {category.cleanable ? 'Cleanable' : 'Not cleanable'}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleExpandedSection(category.section);
                          }}
                          className="mt-3 inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold text-slate-500 transition-colors hover:bg-white/45 hover:text-slate-950"
                        >
                          {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                          Details
                        </button>

                        {isExpanded && (
                          <div className="mt-3 rounded-2xl border border-white/60 bg-white/35 p-3 shadow-inner shadow-white/30 backdrop-blur-xl">
                            <p className="mb-2 text-xs font-semibold text-slate-500">{meta.description}</p>
                            <div className="max-h-40 space-y-1 overflow-y-auto pr-1 custom-scrollbar">
                              {category.items.map((item, itemIndex) => (
                                <div key={`${category.section}-${itemIndex}`} className="break-words text-xs font-medium text-slate-500">
                                  {item}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (stage === 'cleaning') {
    const progress = selectedSize > 0 ? (cleanedSize / selectedSize) * 100 : 0;

    return (
      <div className={CLEAN_SHELL}>
        <div className={CLEAN_ACCENT_BG} />
        <div className="relative flex h-full min-h-0 flex-col gap-2">
          <div className="px-4 pb-4 pt-3">
            <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <h2 className="mb-1 text-3xl font-black tracking-[-0.045em] text-slate-950">Cleaning...</h2>
                <p className="font-medium text-slate-600">Removing selected cleanup sections and reclaiming space.</p>
              </div>
              <div className="flex justify-start lg:justify-end">
                <Button variant="secondary" icon={X} onClick={stopCleaning} className="rounded-full bg-white/45 px-5 text-slate-800 shadow-[0_12px_28px_rgba(15,23,42,0.08)] hover:bg-white/60">
                  Stop Cleaning
                </Button>
              </div>
            </div>

            <Card className={`${LIST_CARD} border-blue-200/60`}>
              <div className="mb-2 flex items-center justify-between text-sm font-semibold text-slate-600">
                <span>{formatBytes(cleanedSize)} of {formatBytes(selectedSize)}</span>
                <span>{Math.round(Math.min(progress, 100))}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/45 shadow-inner shadow-white/40">
                <div
                  className="h-full bg-gradient-to-r from-blue-400 to-cyan-500 transition-all duration-300"
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
              <div className="mt-3 flex items-center gap-3 py-1">
                <Trash2 className="h-5 w-5 text-blue-500" />
                <span className="text-sm font-medium text-slate-600">Do not close this window until cleanup completes</span>
              </div>
            </Card>
          </div>

          <div className="min-h-0 flex-1 rounded-[1.75rem] p-2">
            {renderTimeline('Cleanup Progress', Trash2, 'Initializing cleanup...', 'Cleaning...', 'text-emerald-500')}
          </div>
        </div>
      </div>
    );
  }

  if (stage === 'complete') {
    const totalItems = selectedCategories.reduce((sum, cat) => sum + cat.fileCount, 0);

    return (
      <div className={CLEAN_SHELL}>
        <div className={CLEAN_ACCENT_BG} />
        <div className="relative flex h-full items-center justify-center">
          <div className="w-full max-w-2xl p-8 text-center">
            <div className="space-y-6">
              <div className="inline-flex rounded-full border border-emerald-200/70 bg-emerald-100/35 p-6 shadow-[0_18px_48px_rgba(16,185,129,0.16)] backdrop-blur-xl">
                <Check className="h-12 w-12 text-emerald-500" />
              </div>
              <div>
                <h2 className="mb-2 text-3xl font-black tracking-[-0.045em] text-slate-950">Cleaning Complete!</h2>
                <p className="font-medium text-slate-600">Successfully freed {formatBytes(cleanedSize)}</p>
              </div>

              <div className="mx-auto grid max-w-xl grid-cols-1 gap-3 sm:grid-cols-2">
                <Card className={`${LIST_CARD} text-center`}>
                  <div className="mb-1 text-3xl font-black tracking-[-0.04em] text-emerald-500">{formatBytes(cleanedSize)}</div>
                  <div className="text-sm font-medium text-slate-500">Space Recovered</div>
                </Card>
                <Card className={`${LIST_CARD} text-center`}>
                  <div className="mb-1 text-3xl font-black tracking-[-0.04em] text-blue-500">{totalItems}</div>
                  <div className="text-sm font-medium text-slate-500">Items Removed</div>
                </Card>
              </div>

              <Button icon={Check} onClick={reset} size="lg" className="rounded-full bg-blue-500 shadow-[0_18px_40px_rgba(59,130,246,0.24)] hover:bg-blue-600">
                Done
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <StartScreen config={config} onStart={startScan} variant="feature" />;
}
