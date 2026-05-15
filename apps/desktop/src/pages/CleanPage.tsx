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
import { Spinner } from '@/components/ui/Spinner';
import { formatBytes, stripAnsi, parseSizeToBytes } from '@/utils/format';
import { usePersistentState } from '@/utils/persistentState';
import type { PageConfig, CleanCategory } from '@/types';

type Stage = 'idle' | 'scanning' | 'results' | 'cleaning' | 'complete';

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

export function CleanPage() {
  const [stage, setStage] = usePersistentState<Stage>('mole-clean-stage', 'idle');
  const [categories, setCategories] = usePersistentState<CleanCategory[]>('mole-clean-categories', []);
  const [totalSize, setTotalSize] = usePersistentState('mole-clean-total-size', 0);
  const [cleanedSize, setCleanedSize] = usePersistentState('mole-clean-cleaned-size', 0);
  const [, setLogs] = usePersistentState<LogEntry[]>('mole-clean-logs', []);
  const [timeline, setTimeline] = usePersistentState<TimelineStage[]>('mole-clean-timeline', []);
  const [selectedSections, setSelectedSections] = usePersistentState<string[]>('mole-clean-selected-sections', []);
  const [expandedSections, setExpandedSections] = usePersistentState<string[]>('mole-clean-expanded-sections', []);
  const [sortBy, setSortBy] = usePersistentState<'size' | 'name'>('mole-clean-sort-by', 'size');

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
      variant="glass"
      className="h-full p-6 overflow-y-auto custom-scrollbar"
      onScroll={handleTimelineScroll}
    >
      <h3 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
        <Icon className="w-4 h-4" />
        {title}
      </h3>
      <div className="space-y-4">
        {timeline.map((timelineStage, index) => {
          const isExpanded = timelineStage.status === 'active' || expandedSections.includes(timelineStage.name);
          const visibleItems = isExpanded ? timelineStage.items : timelineStage.items.slice(-3);

          return (
            <div key={timelineStage.id} className="relative">
              {index < timeline.length - 1 && (
                <div className="absolute left-4 top-10 bottom-0 w-0.5 bg-gradient-to-b from-accent-primary/30 to-transparent" />
              )}

              <div className="flex gap-3">
                <div className="relative z-10">
                  {timelineStage.status === 'active' && (
                    <div className="w-8 h-8 rounded-full bg-accent-primary/20 flex items-center justify-center">
                      <Loader2 className="w-4 h-4 text-accent-primary animate-spin" />
                    </div>
                  )}
                  {timelineStage.status === 'complete' && (
                    <div className="w-8 h-8 rounded-full bg-accent-success/20 flex items-center justify-center">
                      <CheckCircle2 className="w-4 h-4 text-accent-success" />
                    </div>
                  )}
                  {timelineStage.status === 'error' && (
                    <div className="w-8 h-8 rounded-full bg-accent-danger/20 flex items-center justify-center">
                      <AlertCircle className="w-4 h-4 text-accent-danger" />
                    </div>
                  )}
                  {timelineStage.status === 'pending' && (
                    <div className="w-8 h-8 rounded-full bg-surface flex items-center justify-center">
                      <Clock className="w-4 h-4 text-text-tertiary" />
                    </div>
                  )}
                </div>

                <div className="flex-1 pb-4 min-w-0">
                  <button
                    type="button"
                    onClick={() => toggleExpandedSection(timelineStage.name)}
                    className="w-full flex items-center justify-between gap-3 text-left"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-text-tertiary shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-text-tertiary shrink-0" />
                      )}
                      <span className="font-semibold text-text-primary truncate">{timelineStage.name}</span>
                    </span>
                    {timelineStage.size && timelineStage.size > 0 && (
                      <span className={`text-xs shrink-0 ${sizeClass}`}>{formatBytes(timelineStage.size)}</span>
                    )}
                  </button>

                  {timelineStage.items.length > 0 && (
                    <div className="space-y-1 mt-2 pl-6">
                      {visibleItems.map((item, itemIndex) => (
                        <div key={`${item}-${itemIndex}`} className="text-xs text-text-secondary break-words">
                          {item}
                        </div>
                      ))}
                      {!isExpanded && timelineStage.items.length > 3 && (
                        <div className="text-xs text-text-tertiary italic">
                          +{timelineStage.items.length - 3} more items
                        </div>
                      )}
                    </div>
                  )}

                  {timelineStage.status === 'active' && timelineStage.items.length === 0 && (
                    <div className="text-xs text-text-tertiary italic pl-6 mt-2">{activeText}</div>
                  )}

                  {timelineStage.startTime && timelineStage.endTime && (
                    <div className="text-xs text-text-tertiary mt-1 pl-6">
                      Completed in {((timelineStage.endTime - timelineStage.startTime) / 1000).toFixed(1)}s
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {timeline.length === 0 && (
          <div className="text-center text-text-tertiary py-8">
            <Icon className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">{emptyText}</p>
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
      <div className="h-full flex flex-col p-8">
        <div className="mb-6 text-center">
          <div className="flex justify-center mb-4">
            <div className="relative">
              <Spinner size="lg" />
              <Search className="absolute inset-0 m-auto w-6 h-6 text-accent-primary" />
            </div>
          </div>
          <h2 className="text-2xl font-semibold text-text-primary">Scanning System...</h2>
          <p className="text-text-secondary">Analyzing cleanup sections and collecting details</p>
        </div>

        <div className="flex-1 overflow-hidden mb-6">
          {renderTimeline('Scan Progress', Clock, 'Initializing scan...', 'Scanning...', 'text-accent-primary')}
        </div>

        <Button variant="secondary" icon={X} onClick={stopScan}>
          Stop Scan
        </Button>
      </div>
    );
  }

  if (stage === 'results') {
    return (
      <div className="h-full flex flex-col p-8 overflow-hidden">
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-text-primary mb-2">Scan Results</h2>
          <p className="text-text-secondary">
            Found {formatBytes(totalSize)} of cleanable data. Selected {formatBytes(selectedSize)}.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <Card variant="glass" className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-accent-primary/12 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-accent-primary" />
              </div>
              <div>
                <div className="text-2xl font-bold text-text-primary">{formatBytes(selectedSize)}</div>
                <div className="text-sm text-text-secondary">Selected to Clean</div>
              </div>
            </div>
          </Card>

          <Card variant="glass" className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-accent-secondary/12 flex items-center justify-center">
                <Trash2 className="w-6 h-6 text-accent-secondary" />
              </div>
              <div>
                <div className="text-2xl font-bold text-text-primary">{selectedCategories.length}</div>
                <div className="text-sm text-text-secondary">Sections Selected</div>
              </div>
            </div>
          </Card>
        </div>

        <div className="flex items-center justify-between gap-4 mb-3">
          <div className="text-sm font-semibold text-text-primary">Cleanup Sections</div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface border border-surface-hover">
              <ArrowUpDown className="w-4 h-4 text-text-tertiary" />
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as 'size' | 'name')}
                className="bg-transparent text-sm text-text-primary focus:outline-none cursor-pointer"
                aria-label="Sort cleanup sections"
              >
                <option value="size">Sort by Size</option>
                <option value="name">Sort by Name</option>
              </select>
            </div>
            <Button variant="ghost" size="sm" onClick={selectAllCleanable}>
              Select All
            </Button>
            <Button variant="ghost" size="sm" onClick={clearSelection}>
              Clear
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 mb-6 px-2 py-1">
          {sortedCategories.map((category) => {
            const meta = getSectionMeta(category.section);
            const isSelected = selectedSections.includes(category.section);
            const isExpanded = expandedSections.includes(category.section);

            return (
              <Card
                key={category.section}
                variant="glass"
                hover={category.cleanable}
                className={`p-4 ${!category.cleanable ? 'opacity-75' : ''}`}
                onClick={() => toggleSelectedSection(category)}
              >
                <div className="flex items-start gap-4">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    disabled={!category.cleanable}
                    onChange={() => toggleSelectedSection(category)}
                    onClick={(event) => event.stopPropagation()}
                    className="mt-3 h-4 w-4 accent-accent-primary disabled:opacity-40"
                    aria-label={`Select ${category.name}`}
                  />
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${category.color}20`, color: category.color }}
                  >
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-text-primary">{category.name}</h3>
                        <p className="text-sm text-text-secondary">
                          {category.cleanable
                            ? `${category.fileCount} items - ${formatBytes(category.size)}`
                            : category.scanned
                              ? 'No cleanable data found'
                              : 'Not scanned'}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-lg font-semibold text-text-primary">{formatBytes(category.size)}</div>
                        <div
                          className={`text-xs ${
                            category.cleanable ? 'text-accent-success' : 'text-text-tertiary'
                          }`}
                        >
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
                      className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-text-secondary hover:text-text-primary"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                      Details
                    </button>

                    {isExpanded && (
                      <div className="mt-3 rounded-md bg-surface/70 border border-surface-hover p-3">
                        <p className="text-xs text-text-secondary mb-2">{meta.description}</p>
                        <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                          {category.items.map((item, itemIndex) => (
                            <div key={`${category.section}-${itemIndex}`} className="text-xs text-text-secondary break-words">
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

        <div className="flex gap-4">
          <Button variant="secondary" icon={ArrowLeft} onClick={reset}>
            Back
          </Button>
          <Button icon={Trash2} onClick={startCleaning} className="flex-1" disabled={selectedSize === 0}>
            Clean Selected
          </Button>
        </div>
      </div>
    );
  }

  if (stage === 'cleaning') {
    const progress = selectedSize > 0 ? (cleanedSize / selectedSize) * 100 : 0;

    return (
      <div className="h-full flex flex-col p-8">
        <div className="mb-6 text-center">
          <div className="flex justify-center mb-4">
            <div className="relative">
              <Spinner size="lg" />
              <Trash2 className="absolute inset-0 m-auto w-6 h-6 text-accent-primary" />
            </div>
          </div>
          <h2 className="text-2xl font-semibold text-text-primary">Cleaning...</h2>
          <div className="mt-4 max-w-md mx-auto">
            <div className="w-full h-2 bg-surface rounded-full overflow-hidden mb-2">
              <div
                className="h-full bg-accent-primary rounded-full transition-all duration-300"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
            <p className="text-sm text-text-tertiary">
              {formatBytes(cleanedSize)} of {formatBytes(selectedSize)} ({Math.round(Math.min(progress, 100))}%)
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-hidden mb-6">
          {renderTimeline('Cleanup Progress', Trash2, 'Initializing cleanup...', 'Cleaning...', 'text-accent-success')}
        </div>

        <Button variant="secondary" icon={X} onClick={stopCleaning}>
          Stop Cleaning
        </Button>
      </div>
    );
  }

  if (stage === 'complete') {
    const totalItems = selectedCategories.reduce((sum, cat) => sum + cat.fileCount, 0);

    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-8 max-w-md">
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-full bg-accent-success/12 flex items-center justify-center">
              <Check className="w-10 h-10 text-accent-success" />
            </div>
          </div>
          <div>
            <h2 className="text-3xl font-bold text-text-primary mb-2">Cleaning Complete!</h2>
            <p className="text-text-secondary">Successfully freed {formatBytes(cleanedSize)}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Card variant="glass" className="p-6">
              <div className="text-3xl font-bold text-accent-success mb-1">{formatBytes(cleanedSize)}</div>
              <div className="text-sm text-text-secondary">Space Recovered</div>
            </Card>
            <Card variant="glass" className="p-6">
              <div className="text-3xl font-bold text-accent-primary mb-1">{totalItems}</div>
              <div className="text-sm text-text-secondary">Items Removed</div>
            </Card>
          </div>

          <Button icon={Check} onClick={reset} size="lg">
            Done
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
