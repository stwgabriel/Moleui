import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  BatteryCharging,
  Bell,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Database,
  Gauge,
  Globe2,
  ListChecks,
  Loader2,
  Play,
  RefreshCcw,
  Rocket,
  Search,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Type,
  UserRound,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { StartScreen } from '@/components/common/StartScreen';
import { StageTransition } from '@/components/common/StageTransition';
import { Button } from '@/components/ui/Button';
import { featureAccentVars } from '@/lib/featureAccents';
import { stripAnsi } from '@/utils/format';
import { usePaywall } from '@/hooks/usePaywall';
import { usePersistentState } from '@/utils/persistentState';
import type { PageConfig } from '@/types';

type Stage = 'idle' | 'previewing' | 'preview-results' | 'optimizing' | 'complete' | 'error';

const optimizeAccentStyle = featureAccentVars('optimize');

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
  selected?: boolean;
  startTime?: number;
  endTime?: number;
}

type TimelineTarget = 'main' | 'preview';

type ParsedOptimizeLine =
  | { kind: 'section'; text: string }
  | { kind: 'item'; text: string };

type TaskBadgeTone = 'recommended' | 'attention' | 'high' | 'medium' | 'safe' | 'running' | 'queued' | 'done';

interface TaskBadge {
  label: string;
  tone: TaskBadgeTone;
}

interface TaskVisualRule {
  pattern: RegExp;
  icon: LucideIcon;
  description: string;
}

const OPTIMIZE_ITEM_ICON_PATTERN = /^[✓✔→◎○ℹ-]\s*/;
const NO_EXPANDED_TASK = '__none__';
const FALLBACK_OPTIMIZE_STAGE_NAME = 'Performance Tweaks';

const noOptimizationOutputPattern = /\b(?:No Optimizations? (?:Found|Needed)|No changes would be applied|No optimization tasks were applied|System already optimized|Nothing to (?:optimize|apply|do)|0\s+(?:optimizations?|changes|tasks)\b|Would apply\s+0\b|All .* (?:healthy|valid|optimal|up to date))\b/i;

const noopOptimizationItemPattern = /\b(?:already|skipped|unavailable|not found|valid|optimal|healthy|verified|up to date|no .*found|all .*healthy|all .*valid|requires sudo|not available|nothing to|no changes|nothing changed)\b/i;

const actionableOptimizationPatterns = [
  /\b(?:would\s+)?(?:disable|clean|clear|flush|refresh|rebuild|repair|restart|release|optimize|vacuum|remove|delete|reset|update|prune|purge|fix|apply|compact)\b/i,
  /\b(?:flushed|refreshed|rebuilt|optimized|repaired|restarted|released|improved|cleared|cleaned|started|disabled|removed|deleted|reset|updated|pruned|purged|fixed|vacuumed|compacted)\b/i,
  /\b(?:outdated|orphaned|broken)\b/i,
];

const taskVisualRules: TaskVisualRule[] = [
  {
    pattern: /login/i,
    icon: UserRound,
    description: 'Items that run automatically at login',
  },
  {
    pattern: /launch\s*agent|daemon/i,
    icon: Rocket,
    description: 'Background agents and daemons',
  },
  {
    pattern: /database|sqlite|launchservices/i,
    icon: Database,
    description: 'Optimize system databases and indexes',
  },
  {
    pattern: /dns|spotlight|network/i,
    icon: Globe2,
    description: 'Refresh caches and resolve issues',
  },
  {
    pattern: /font/i,
    icon: Type,
    description: 'Rebuild font caches for stability',
  },
  {
    pattern: /notification/i,
    icon: Bell,
    description: 'Clean and reset notification data',
  },
  {
    pattern: /finder|cache/i,
    icon: Search,
    description: 'Refresh system caches and services',
  },
  {
    pattern: /security|firewall|gatekeeper|permission|quarantine/i,
    icon: ShieldCheck,
    description: 'Verify protection and repair trust data',
  },
];

const taskBadgeClassByTone: Record<TaskBadgeTone, string> = {
  recommended: 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)]',
  attention: 'bg-rose-50 text-rose-500 ring-1 ring-rose-100/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)]',
  high: 'bg-rose-50 text-rose-500 ring-1 ring-rose-100/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)]',
  medium: 'bg-orange-50 text-orange-500 ring-1 ring-orange-100/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)]',
  safe: 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)]',
  running: 'bg-[rgba(var(--page-accent-rgb),0.10)] text-[var(--page-accent)] ring-1 ring-[rgba(var(--page-accent-rgb),0.18)] shadow-[inset_0_1px_0_rgba(255,255,255,0.78)]',
  queued: 'bg-slate-100/80 text-slate-500 ring-1 ring-slate-200/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]',
  done: 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)]',
};

function removeOptimizeItemIcon(line: string) {
  return line.replace(OPTIMIZE_ITEM_ICON_PATTERN, '').trim();
}

function isOptimizeSummaryLine(line: string) {
  const message = removeOptimizeItemIcon(line);

  return (
    line === 'Optimize' ||
    /^=+$/.test(line) ||
    /^⚙\s+System\b/i.test(line) ||
    /^Active Whitelist:/i.test(message) ||
    noOptimizationOutputPattern.test(message) ||
    /^(DRY RUN MODE|Dry Run Complete|Optimization Complete)\b/i.test(message) ||
    /^(Would apply|Run without|Applied|System fully optimized)/i.test(message)
  );
}

function isNoopOptimizationItem(item: string) {
  return noopOptimizationItemPattern.test(removeOptimizeItemIcon(item));
}

function isActionableOptimizationItem(item: string) {
  const message = removeOptimizeItemIcon(item);
  return Boolean(message) && !isNoopOptimizationItem(message) && actionableOptimizationPatterns.some((pattern) => pattern.test(message));
}

function rewritePreviewItem(line: string) {
  const iconMatch = line.match(/^([✓✔→◎○ℹ-])\s*(.+?)$/);
  const icon = iconMatch?.[1];
  const message = removeOptimizeItemIcon(line);
  if (!message) return '';

  if (!isActionableOptimizationItem(message)) {
    return '';
  }

  if (icon === '◎') return `Needs attention: ${message}`;
  if (icon === '○' || icon === 'ℹ' || icon === '-') return `Would review ${message.charAt(0).toLowerCase()}${message.slice(1)}`;

  const rewriteRules: Array<[RegExp, string]> = [
    [/^(.+?) flushed$/i, 'flush'],
    [/^(.+?) refreshed$/i, 'refresh'],
    [/^(.+?) verified$/i, 'verify'],
    [/^(.+?) rebuilt$/i, 'rebuild'],
    [/^(.+?) optimized$/i, 'optimize'],
    [/^(.+?) repaired$/i, 'repair'],
    [/^(.+?) restarted$/i, 'restart'],
    [/^(.+?) released$/i, 'release'],
    [/^(.+?) improved$/i, 'improve'],
    [/^(.+?) cleared$/i, 'clear'],
    [/^(.+?) cleaned$/i, 'clean'],
    [/^(.+?) started$/i, 'start'],
  ];

  for (const [pattern, verb] of rewriteRules) {
    const match = message.match(pattern);
    if (match?.[1]) return `Would ${verb} ${match[1]}`;
  }

  const actionMatch = message.match(/^(Optimized|Repaired|Cleaned|Cleared|Rebuilt|Refreshed|Restarted|Released|Verified)\s+(.+)$/i);
  if (actionMatch?.[1] && actionMatch[2]) {
    const verbByPastTense: Record<string, string> = {
      optimized: 'optimize',
      repaired: 'repair',
      cleaned: 'clean',
      cleared: 'clear',
      rebuilt: 'rebuild',
      refreshed: 'refresh',
      restarted: 'restart',
      released: 'release',
      verified: 'verify',
    };
    const verb = verbByPastTense[actionMatch[1].toLowerCase()] ?? actionMatch[1].toLowerCase();
    return `Would ${verb} ${actionMatch[2]}`;
  }

  return `Would ${message.charAt(0).toLowerCase()}${message.slice(1)}`;
}

function parseOptimizeLine(rawLine: string, target: TimelineTarget): ParsedOptimizeLine | null {
  const line = stripAnsi(rawLine).trim();
  if (!line || isOptimizeSummaryLine(line)) return null;

  const sectionMatch = line.match(/^[➤▸]\s+(.+?)$/);
  if (sectionMatch?.[1]) {
    return { kind: 'section', text: sectionMatch[1].trim() };
  }

  if (OPTIMIZE_ITEM_ICON_PATTERN.test(line)) {
    const text = target === 'preview' ? rewritePreviewItem(line) : removeOptimizeItemIcon(line);
    if (target !== 'preview' && !isActionableOptimizationItem(text)) return null;
    return text ? { kind: 'item', text } : null;
  }

  return null;
}

function getTaskVisualMeta(taskName: string) {
  return taskVisualRules.find((rule) => rule.pattern.test(taskName)) ?? {
    icon: Gauge,
    description: 'Optimize performance maintenance task',
  };
}

function getTaskBadge(timelineStage: TimelineStage, currentStage: Stage): TaskBadge {
  const taskText = `${timelineStage.name} ${timelineStage.items.join(' ')}`.toLowerCase();

  if (timelineStage.status === 'error') return { label: 'Attention Needed', tone: 'attention' };
  if (timelineStage.status === 'active') return { label: currentStage === 'previewing' ? 'Scanning' : 'Running', tone: 'running' };
  if (timelineStage.status === 'pending') return { label: 'Queued', tone: 'queued' };
  if (currentStage === 'optimizing') return { label: 'Done', tone: 'done' };

  if (/launch\s*agent|daemon|outdated|orphaned|broken/.test(taskText)) {
    return { label: 'Attention Needed', tone: 'attention' };
  }

  if (/login/.test(taskText)) return { label: 'Recommended', tone: 'recommended' };
  if (/database|sqlite|memory|permission|repair/.test(taskText) || timelineStage.items.length >= 6) {
    return { label: 'Medium impact', tone: 'medium' };
  }

  return { label: 'Safe', tone: 'safe' };
}

function getTaskItemBadge(item: string, parentBadge: TaskBadge): TaskBadge {
  const itemText = item.toLowerCase();

  if (/outdated|remove|delete|broken/.test(itemText)) return { label: 'High impact', tone: 'high' };
  if (/disable|clean|clear|flush|refresh|rebuild|repair|restart|release|optimize|vacuum/.test(itemText)) {
    return { label: 'Medium impact', tone: 'medium' };
  }
  if (/already|healthy|valid|verified|verify|optimal|skipped|not found|unavailable/.test(itemText)) {
    return { label: 'Safe', tone: 'safe' };
  }
  if (parentBadge.tone === 'attention') return { label: 'Medium impact', tone: 'medium' };

  return { label: 'Safe', tone: 'safe' };
}

function taskCountLabel(count: number) {
  return `${count} ${count === 1 ? 'item' : 'items'}`;
}

function isTimelineStageSelected(timelineStage: TimelineStage) {
  return timelineStage.selected !== false;
}

function getScrollShadowState(element: HTMLDivElement | null) {
  if (!element) return { top: false, bottom: false };

  const hasOverflow = element.scrollHeight - element.clientHeight > 1;
  return {
    top: hasOverflow && element.scrollTop > 1,
    bottom: hasOverflow && element.scrollTop + element.clientHeight < element.scrollHeight - 1,
  };
}

const config: PageConfig = {
  title: 'Optimize performance',
  description: "Fine-tune your Mac's performance with selectable system optimization tweaks.",
  icon: 'Gauge',
  buttonText: 'Start Optimization',
  items: [
    {
      icon: 'Cpu',
      title: 'System Tuning',
      description: 'Optimize system settings for better performance',
    },
    {
      icon: 'Database',
      title: 'Database Repair',
      description: 'Rebuild and optimize system databases',
    },
    {
      icon: 'RefreshCw',
      title: 'Memory Management',
      description: 'Clear inactive memory and improve responsiveness',
    },
    {
      icon: 'Shield',
      title: 'Security Checks',
      description: 'Review firewall and system security settings',
    },
  ],
};

const stageCopy: Record<Exclude<Stage, 'idle' | 'complete' | 'error'>, { title: string; description: string }> = {
  previewing: {
    title: 'Scanning Mac',
    description: 'Mole is checking the tune-up path first, so you can see every optimization before it changes anything.',
  },
  'preview-results': {
    title: 'Review tweaks',
    description: 'Review the valid optimization tweaks we found, then apply the performance tune-up when you are ready.',
  },
  optimizing: {
    title: 'Boosting performance',
    description: 'Mole is applying the approved maintenance tweaks and tracking each performance pass as it finishes.',
  },
};

function timelineStats(timeline: TimelineStage[]) {
  return {
    completedStages: timeline.filter((stage) => stage.status === 'complete'),
    activeStage: timeline.find((stage) => stage.status === 'active'),
    totalItems: timeline.reduce((sum, stage) => sum + stage.items.length, 0),
  };
}

function hasNoOptimizationsOutput(logs: LogEntry[]) {
  return logs.some((log) => noOptimizationOutputPattern.test(log.text));
}

function actionableOptimizationItemCount(timeline: TimelineStage[]) {
  return timeline.reduce(
    (sum, timelineStage) => sum + timelineStage.items.filter((item) => !isNoopOptimizationItem(item)).length,
    0,
  );
}

function completeTimeline(timeline: TimelineStage[], options: { pruneEmpty?: boolean } = {}) {
  const completed = timeline.map((s) =>
    s.status === 'active' ? { ...s, status: 'complete' as const, endTime: Date.now() } : s
  );

  return options.pruneEmpty ? completed.filter((s) => s.items.length > 0) : completed;
}

function getImpactScores(timeline: TimelineStage[], attentionTaskCount: number, noOptimizationsFound: boolean) {
  if (noOptimizationsFound || timeline.length === 0) {
    return {
      performance: 0,
      responsiveness: 0,
      stability: 0,
      battery: 0,
    };
  }

  const text = timeline.map((timelineStage) => `${timelineStage.name} ${timelineStage.items.join(' ')}`).join(' ').toLowerCase();
  const itemCount = timeline.reduce((sum, timelineStage) => sum + timelineStage.items.length, 0);
  const baseScore = Math.min(4, Math.max(1, Math.ceil(itemCount / 4)));
  const scoreFor = (pattern: RegExp, boost: number) => Math.min(10, baseScore + (pattern.test(text) ? boost : 0));

  return {
    performance: scoreFor(/cache|database|sqlite|spotlight|launchservices|maintenance|memory|optimiz/i, 4),
    responsiveness: scoreFor(/memory|dns|network|quicklook|finder|dock|bluetooth|responsiveness|cache/i, 5),
    stability: attentionTaskCount > 0 ? Math.max(3, baseScore + 1) : scoreFor(/permission|repair|verify|security|quarantine|notification|healthy|stability/i, 5),
    battery: scoreFor(/launch\s*agent|login|background|daemon|bluetooth|network|battery/i, 3),
  };
}

export function OptimizePage() {
  const { requireSubscription } = usePaywall();
  const [stage, setStage] = usePersistentState<Stage>('mole-optimize-stage', 'idle');
  const [logs, setLogs] = usePersistentState<LogEntry[]>('mole-optimize-logs', []);
  const [previewLogs, setPreviewLogs] = usePersistentState<LogEntry[]>('mole-optimize-preview-logs', []);
  const [timeline, setTimeline] = usePersistentState<TimelineStage[]>('mole-optimize-timeline', []);
  const [previewTimeline, setPreviewTimeline] = usePersistentState<TimelineStage[]>('mole-optimize-preview-timeline', []);
  const logEndRef = useRef<HTMLDivElement>(null);
  const previewLogEndRef = useRef<HTMLDivElement>(null);
  const taskListRef = useRef<HTMLDivElement>(null);
  const runIdRef = useRef(0);
  const activeRunRef = useRef<{ id: number; context: 'preview' | 'main' } | null>(null);
  const cancelledRunIdsRef = useRef(new Set<number>());
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [taskScrollShadow, setTaskScrollShadow] = useState({ top: false, bottom: false });

  const updateTaskScrollShadow = () => {
    const next = getScrollShadowState(taskListRef.current);
    setTaskScrollShadow((previous) => (previous.top === next.top && previous.bottom === next.bottom ? previous : next));
  };

  // Auto-scroll logs
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(updateTaskScrollShadow);
    return () => window.cancelAnimationFrame(frame);
  });

  useEffect(() => {
    window.addEventListener('resize', updateTaskScrollShadow);
    return () => window.removeEventListener('resize', updateTaskScrollShadow);
  }, []);

  useEffect(() => {
    previewLogEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [previewLogs]);

  useEffect(() => {
    return () => {
      window.moleDesktop?.optimize?.removeListeners();
    };
  }, []);

  const addLog = (
    text: string,
    type: LogEntry['type'] = 'info',
    target: 'main' | 'preview' = 'main'
  ) => {
    const cleanText = stripAnsi(text).trim();
    if (!cleanText) return;
    const entry = { text: cleanText, timestamp: Date.now(), type };
    if (target === 'preview') {
      setPreviewLogs((prev) => [...prev, entry]);
    } else {
      setLogs((prev) => [...prev, entry]);
    }
  };

  const applyTimelineEvents = (
    events: ParsedOptimizeLine[],
    target: TimelineTarget = 'main'
  ) => {
    if (events.length === 0) return;

    const setter = target === 'preview' ? setPreviewTimeline : setTimeline;

    setter((prev) => {
      let updated = [...prev];

      for (const event of events) {
        if (event.kind === 'section') {
          const sectionName = event.text;
          const startedAt = Date.now();
          updated = updated.map((s) =>
            s.status === 'active' ? { ...s, status: 'complete' as const, endTime: startedAt } : s
          );
          const existingIndex = updated.findIndex((s) => s.name === sectionName);
          if (existingIndex >= 0) {
            updated[existingIndex] = { ...updated[existingIndex], status: 'active', selected: updated[existingIndex].selected ?? true, startTime: startedAt };
          } else {
            updated.push({ id: `stage-${startedAt}-${sectionName}`, name: sectionName, status: 'active', items: [], selected: true, startTime: startedAt });
          }
          continue;
        }

        let activeIndex = updated.findIndex((s) => s.status === 'active');
        if (activeIndex < 0) {
          const startedAt = Date.now();
          updated.push({ id: `stage-${startedAt}-${FALLBACK_OPTIMIZE_STAGE_NAME}`, name: FALLBACK_OPTIMIZE_STAGE_NAME, status: 'active', items: [], selected: true, startTime: startedAt });
          activeIndex = updated.length - 1;
        }

        if (!updated[activeIndex].items.includes(event.text)) {
          updated[activeIndex] = {
            ...updated[activeIndex],
            items: [...updated[activeIndex].items, event.text],
          };
        }
      }

      return updated;
    });
  };

  const parseTimelineFromLog = (
    text: string,
    target: TimelineTarget = 'main'
  ) => {
    const events = stripAnsi(text)
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => parseOptimizeLine(line, target))
      .filter((line): line is ParsedOptimizeLine => Boolean(line));

    applyTimelineEvents(events, target);
  };

  const stopProcess = async (context: 'preview' | 'main') => {
    const activeRun = activeRunRef.current;
    if (activeRun?.context === context) {
      cancelledRunIdsRef.current.add(activeRun.id);
      activeRunRef.current = null;
    }

    addLog('Stopping...', 'info', context);
    window.moleDesktop.optimize.removeListeners();
    setExpandedTaskId(null);
    setStage('idle');

    try {
      await window.moleDesktop.optimize.kill();
      addLog(context === 'preview' ? 'Preview cancelled' : 'Optimization stopped by user', 'error', context);
    } catch (error) {
      addLog(`Failed to stop: ${error}`, 'error', context);
    }
  };

  const toggleTaskSelected = (id: string) => {
    if (stage !== 'preview-results') return;

    setPreviewTimeline((prev) =>
      prev.map((timelineStage) =>
        timelineStage.id === id ? { ...timelineStage, selected: !isTimelineStageSelected(timelineStage) } : timelineStage
      )
    );
  };

  // ─── Dry-run preview ────────────────────────────────────────────────────────

  const startPreview = async () => {
    if (!requireSubscription('Optimize')) return;
    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    activeRunRef.current = { id: runId, context: 'preview' };
    setStage('previewing');
    setPreviewLogs([]);
    setPreviewTimeline([]);
    setExpandedTaskId(null);

    addLog('Running dry-run preview...', 'info', 'preview');

    window.moleDesktop.optimize.onStdout((text) => {
      addLog(text, 'info', 'preview');
      parseTimelineFromLog(text, 'preview');
    });

    window.moleDesktop.optimize.onStderr((text) => {
      addLog(text, 'error', 'preview');
    });

    try {
      const result = await window.moleDesktop.optimize.execute({ dryRun: true });
      const isCurrentRun = activeRunRef.current?.id === runId;

      if (cancelledRunIdsRef.current.has(runId) || result.killed) {
        addLog('Preview cancelled', 'error', 'preview');
        if (isCurrentRun) setStage('idle');
      } else if (!isCurrentRun) {
        return;
      } else if (result.ok || result.exitCode === 0) {
        setPreviewTimeline((prev) => completeTimeline(prev, { pruneEmpty: true }));
        addLog('Dry-run complete — no changes were made', 'success', 'preview');
        setStage('preview-results');
      } else {
        addLog(`Preview failed: ${result.stderr}`, 'error', 'preview');
        setStage('preview-results');
      }
    } catch (error) {
      if (cancelledRunIdsRef.current.has(runId)) {
        if (activeRunRef.current?.id === runId) setStage('idle');
        return;
      }
      if (activeRunRef.current?.id !== runId) {
        return;
      }
      addLog(`Error: ${error}`, 'error', 'preview');
      setStage('preview-results');
    } finally {
      if (activeRunRef.current?.id === runId) {
        activeRunRef.current = null;
      }
      cancelledRunIdsRef.current.delete(runId);
      window.moleDesktop.optimize.removeListeners();
    }
  };

  // ─── Real optimization ───────────────────────────────────────────────────────

  const startOptimization = async () => {
    if (!requireSubscription('Optimize')) return;
    const taskNames = stage === 'preview-results'
      ? previewTimeline.filter(isTimelineStageSelected).map((timelineStage) => timelineStage.name)
      : undefined;

    if (stage === 'preview-results' && previewTimeline.length > 0 && taskNames?.length === 0) return;
    if (stage === 'preview-results' && noOptimizationsFound) return;

    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    activeRunRef.current = { id: runId, context: 'main' };
    setStage('optimizing');
    setLogs([]);
    setTimeline([]);
    setExpandedTaskId(null);

    addLog('Starting system optimization...', 'info');

    window.moleDesktop.optimize.onStdout((text) => {
      addLog(text, 'info');
      parseTimelineFromLog(text);
    });

    window.moleDesktop.optimize.onStderr((text) => {
      addLog(text, 'error');
    });

    try {
      const result = await window.moleDesktop.optimize.execute({ dryRun: false, taskNames });
      const isCurrentRun = activeRunRef.current?.id === runId;

      if (cancelledRunIdsRef.current.has(runId) || result.killed) {
        addLog('Optimization was cancelled', 'error');
        if (isCurrentRun) setStage('idle');
      } else if (!isCurrentRun) {
        return;
      } else if (result.ok) {
        setTimeline((prev) => completeTimeline(prev));
        addLog('System optimization completed successfully!', 'success');
        setStage('complete');
      } else {
        addLog(`Optimization failed: ${result.stderr}`, 'error');
        setStage('error');
      }
    } catch (error) {
      if (cancelledRunIdsRef.current.has(runId)) {
        if (activeRunRef.current?.id === runId) setStage('idle');
        return;
      }
      if (activeRunRef.current?.id !== runId) {
        return;
      }
      addLog(`Error: ${error}`, 'error');
      setStage('error');
    } finally {
      if (activeRunRef.current?.id === runId) {
        activeRunRef.current = null;
      }
      cancelledRunIdsRef.current.delete(runId);
      window.moleDesktop.optimize.removeListeners();
    }
  };

  const reset = () => {
    window.moleDesktop.optimize.removeListeners();
    setStage('idle');
    setLogs([]);
    setPreviewLogs([]);
    setTimeline([]);
    setPreviewTimeline([]);
    setExpandedTaskId(null);
  };

  const activeTimeline = stage === 'previewing' || stage === 'preview-results' ? previewTimeline : timeline;
  const activeLogs = stage === 'previewing' || stage === 'preview-results' ? previewLogs : logs;
  const activeStats = useMemo(() => timelineStats(activeTimeline), [activeTimeline]);
  const selectedPreviewTaskCount = useMemo(() => previewTimeline.filter(isTimelineStageSelected).length, [previewTimeline]);
  const fallbackExpandedTaskId = activeStats.activeStage?.id ?? activeTimeline.find((timelineStage) => timelineStage.items.length > 0)?.id ?? activeTimeline[0]?.id ?? null;
  const selectedExpandedTaskId = expandedTaskId === NO_EXPANDED_TASK
    ? null
    : activeTimeline.some((timelineStage) => timelineStage.id === expandedTaskId)
      ? expandedTaskId
      : fallbackExpandedTaskId;
  const selectedTimeline = useMemo(
    () => (stage === 'preview-results' ? previewTimeline.filter(isTimelineStageSelected) : activeTimeline),
    [activeTimeline, previewTimeline, stage],
  );
  const selectedTaskCount = selectedTimeline.length;
  const availableActionItemCount = actionableOptimizationItemCount(activeTimeline);
  const selectedActionItemCount = actionableOptimizationItemCount(selectedTimeline);
  const noOptimizationsFound = hasNoOptimizationsOutput(activeLogs) || (stage === 'preview-results' && (activeTimeline.length === 0 || availableActionItemCount === 0));
  const attentionTaskCount = selectedTimeline.filter((timelineStage) => {
    const badge = getTaskBadge(timelineStage, stage);
    return badge.tone === 'attention' || badge.tone === 'high';
  }).length;

  const renderOptimizationPlan = () => {
    const readyTaskCount = stage === 'preview-results' ? selectedTaskCount : activeTimeline.length;
    const readyItemCount = noOptimizationsFound ? 0 : stage === 'preview-results' ? selectedActionItemCount : activeStats.totalItems;
    const completedTimelineCount = activeStats.completedStages.length;
    const appliedTimelineCount = stage === 'optimizing' ? completedTimelineCount : 0;
    const expectedApplyCount = Math.max(selectedPreviewTaskCount, activeTimeline.length, 1);
    const impactScores = getImpactScores(selectedTimeline, attentionTaskCount, noOptimizationsFound);
    const readyPlanCount = noOptimizationsFound ? 0 : readyItemCount > 0 ? readyItemCount : readyTaskCount;
    const activeStageName = activeStats.activeStage?.name;
    const activeStageItems = activeStats.activeStage?.items.length ?? 0;
    const taskSummaryTitle = noOptimizationsFound
      ? 'No tweaks ready'
      : stage === 'previewing'
      ? 'Scanning tweaks'
      : stage === 'optimizing'
        ? `${readyPlanCount} ${readyPlanCount === 1 ? 'tweak' : 'tweaks'} applying`
        : `${readyPlanCount} ${readyPlanCount === 1 ? 'tweak' : 'tweaks'} ready`;
    const taskSummaryDescription = noOptimizationsFound
      ? 'Preview complete'
      : stage === 'preview-results'
      ? 'Preview complete'
      : stage === 'optimizing'
        ? `${readyItemCount} ${readyItemCount === 1 ? 'change' : 'changes'} in progress`
        : 'Checking system paths';
    const safetyTitle = attentionTaskCount > 0 ? 'Review first' : stage === 'optimizing' ? 'Applying safely' : 'Safe to apply';
    const safetyDescription = attentionTaskCount > 0
      ? `${attentionTaskCount} ${attentionTaskCount === 1 ? 'tweak needs' : 'tweaks need'} attention`
      : 'No risky changes detected';
    const planSteps = [
      {
        number: '01',
        title: 'Analyze',
        description: stage === 'previewing'
          ? activeStageName ? `Scanning ${activeStageName}` : 'Scanning system health'
          : `${Math.max(previewTimeline.length, completedTimelineCount)} checks complete`,
        icon: Search,
        state: stage === 'previewing' ? 'active' : 'complete',
        className: 'left-1/2 top-[2%] w-[43.2%] -translate-x-1/2',
      },
      {
        number: '02',
        title: 'Tune',
        description: stage === 'preview-results'
          ? noOptimizationsFound ? 'No tune-up needed' : `${selectedPreviewTaskCount}/${Math.max(previewTimeline.length, selectedPreviewTaskCount)} tweaks selected`
          : stage === 'optimizing'
            ? 'Tune plan locked'
            : activeStageItems > 0 ? `${activeStageItems} findings grouped` : 'Optimizing settings and resources',
        icon: SlidersHorizontal,
        state: stage === 'previewing' ? 'queued' : stage === 'preview-results' ? 'active' : 'complete',
        className: 'left-1/2 top-[34%] w-[43.2%] -translate-x-1/2',
      },
      {
        number: '03',
        title: 'Apply',
        description: stage === 'optimizing'
          ? `${appliedTimelineCount}/${expectedApplyCount} tweaks applied`
          : noOptimizationsFound ? 'Nothing to apply' : `${selectedPreviewTaskCount || readyTaskCount} safe tweaks queued`,
        icon: ShieldCheck,
        state: stage === 'optimizing' ? 'active' : 'queued',
        className: 'left-1/2 top-[68%] w-[43.2%] -translate-x-1/2',
      },
    ];
    const impactMetrics = [
      { label: 'Performance', icon: Rocket, score: impactScores.performance, tone: 'bg-[var(--page-accent)]' },
      { label: 'Responsiveness', icon: Zap, score: impactScores.responsiveness, tone: 'bg-[var(--page-accent-hover)]' },
      { label: 'Stability', icon: Shield, score: impactScores.stability, tone: 'bg-[rgba(var(--page-accent-rgb),0.42)]' },
      { label: 'Battery', icon: BatteryCharging, score: impactScores.battery, tone: 'bg-[rgba(var(--page-accent-rgb),0.42)]' },
    ];

    return (
      <section className="flex min-h-0 min-w-0 flex-col justify-center pt-[clamp(0.4rem,1.65vw,2rem)]">
        <div className="relative mx-auto flex h-[clamp(500px,62vh,650px)] w-full max-w-[720px] flex-col overflow-visible">

          <div className="relative z-10 min-h-[0] flex-1">
            <div className="absolute left-[6%] top-[9%] h-[65%] w-[31%] rounded-[50%] border border-dashed border-[rgba(var(--page-accent-rgb),0.34)]" aria-hidden="true" />
            <div className="absolute left-[19%] top-[4%] h-[74%] w-[68%] rounded-full border border-dashed border-[rgba(var(--page-accent-rgb),0.38)]" aria-hidden="true" />
            <div className="absolute left-[31%] top-[8%] h-[64%] w-[56%] rounded-full border border-dashed border-[rgba(var(--page-accent-rgb),0.24)]" aria-hidden="true" />

            {planSteps.map((step) => {
              const isActive = step.state === 'active';
              const isComplete = step.state === 'complete';
              const hasLoadingRing = isActive && (step.title === 'Analyze' || step.title === 'Apply');
              const hasPulseBackdrop = isActive && step.title === 'Tune';
              const StepIcon = step.icon;

              return (
                <div
                  key={step.number}
                  aria-current={isActive ? 'step' : undefined}
                  className={`absolute z-20 flex min-h-[clamp(5.85rem,9.5vh,7rem)] min-w-0 items-center gap-[clamp(0.85rem,1.15vw,1.1rem)] rounded-[2.15rem] border px-[clamp(0.85rem,1.2vw,1.15rem)] py-3 shadow-[0_18px_58px_rgba(83,76,148,0.12)] backdrop-blur-2xl transition-all duration-500 ${
                    isActive
                      ? 'z-30 scale-[1.08] border-[rgba(var(--page-accent-rgb),0.24)] bg-white/88 shadow-[0_20px_66px_var(--page-accent-glow),0_0_0_6px_rgba(var(--page-accent-rgb),0.05)]'
                      : isComplete
                        ? 'border-emerald-100/80 bg-white/78'
                        : 'border-white/62 bg-white/58 opacity-70'
                  } ${step.className}`}
                >
                  <span className="relative flex shrink-0 items-center justify-center">
                    {hasPulseBackdrop && (
                      <span className="absolute inset-[-0.45rem] rounded-full bg-[rgba(var(--page-accent-rgb),0.25)] blur-sm animate-ping" aria-hidden="true" />
                    )}
                    {hasLoadingRing && (
                      <span className="absolute inset-[-0.32rem] rounded-full border-2 border-[rgba(var(--page-accent-rgb),0.22)] border-r-[var(--page-accent)] border-t-[var(--page-accent-hover)] animate-spin" aria-hidden="true" />
                    )}
                    <span className={`relative z-10 flex h-[clamp(2rem,2.8vw,2.35rem)] w-[clamp(2rem,2.8vw,2.35rem)] items-center justify-center rounded-full text-[clamp(0.78rem,1vw,0.95rem)] font-black ${
                      isActive
                        ? 'bg-[var(--page-accent)] text-white shadow-[0_8px_24px_var(--page-accent-glow)]'
                        : isComplete
                          ? 'bg-emerald-50 text-emerald-500 shadow-[0_8px_20px_rgba(34,197,94,0.12)]'
                        : 'bg-[rgba(var(--page-accent-rgb),0.10)] text-[var(--page-accent)] shadow-[0_8px_20px_rgba(var(--page-accent-rgb),0.16)]'
                    }`}>
                      {isComplete ? <Check className="h-[58%] w-[58%]" strokeWidth={3} /> : step.number}
                    </span>
                  </span>
                  <div className="min-w-0">
                    <h3 className="flex items-center gap-2 truncate text-[clamp(1rem,1.35vw,1.18rem)] font-black leading-tight text-slate-700">
                      <StepIcon className={`h-[0.95em] w-[0.95em] shrink-0 ${isActive ? 'text-[var(--page-accent)]' : isComplete ? 'text-emerald-500' : 'text-[rgba(var(--page-accent-rgb),0.38)]'}`} />
                      <span className="truncate">{step.title}</span>
                    </h3>
                    <p className="mt-2 max-w-[8.5rem] text-[clamp(0.72rem,0.9vw,0.82rem)] font-semibold leading-snug text-slate-500">{step.description}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="relative z-10 overflow-hidden rounded-[1.35rem] border border-[rgba(var(--page-accent-rgb),0.14)] bg-white/76 shadow-[0_18px_54px_rgba(83,76,148,0.10)] backdrop-blur-2xl">

            <div className="grid grid-cols-2 divide-x divide-slate-900/[0.06]">
              <div className="flex min-w-0 items-center gap-4 p-[clamp(0.9rem,1.25vw,1.15rem)]">
                <div className="flex h-[clamp(3rem,4vw,3.5rem)] w-[clamp(3rem,4vw,3.5rem)] shrink-0 items-center justify-center rounded-full bg-[rgba(var(--page-accent-rgb),0.10)] text-[var(--page-accent)]">
                  <ListChecks className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[clamp(0.9rem,1.08vw,1rem)] font-black text-slate-950">{taskSummaryTitle}</div>
                  <div className="mt-1 truncate text-[clamp(0.72rem,0.88vw,0.82rem)] font-semibold text-slate-500">{taskSummaryDescription}</div>
                </div>
              </div>

              <div className="flex min-w-0 items-center gap-4 p-[clamp(0.9rem,1.25vw,1.15rem)]">
                <div className={`flex h-[clamp(3rem,4vw,3.5rem)] w-[clamp(3rem,4vw,3.5rem)] shrink-0 items-center justify-center rounded-full ${
                  attentionTaskCount > 0 ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-500'
                }`}>
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[clamp(0.9rem,1.08vw,1rem)] font-black text-slate-950">{safetyTitle}</div>
                  <div className="mt-1 truncate text-[clamp(0.72rem,0.88vw,0.82rem)] font-semibold text-slate-500">{safetyDescription}</div>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-900/[0.06] p-[clamp(0.9rem,1.25vw,1.15rem)]">
              <div className="mb-3 flex items-center gap-2 text-[clamp(0.82rem,1vw,0.95rem)] font-black text-slate-600">
                System impact preview
                <AlertCircle className="h-4 w-4 text-slate-400" />
              </div>
              <div className="grid grid-cols-4 gap-4">
                {impactMetrics.map((metric) => {
                  const MetricIcon = metric.icon;

                  return (
                    <div key={metric.label} className="min-w-0">
                      <div className="mb-2 flex min-w-0 items-center gap-2">
                        <MetricIcon className="h-4 w-4 shrink-0 text-[var(--page-accent)]" />
                        <span className="truncate text-[0.68rem] font-black text-slate-500">{metric.label}</span>
                      </div>
                      <div
                        className="grid grid-cols-10 gap-1"
                        role="meter"
                        aria-label={`${metric.label} impact`}
                        aria-valuemin={0}
                        aria-valuemax={10}
                        aria-valuenow={metric.score}
                      >
                        {Array.from({ length: 10 }, (_, index) => (
                          <span
                            key={`${metric.label}-${index}`}
                            aria-hidden="true"
                            className={`h-2 rounded-full ${index < metric.score ? metric.tone : 'bg-[rgba(var(--page-accent-rgb),0.10)]'}`}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  };

  const renderTimelineCard = (timelineStage: TimelineStage) => {
    const isExpanded = selectedExpandedTaskId === timelineStage.id;
    const isActive = timelineStage.status === 'active';
    const isError = timelineStage.status === 'error';
    const canSelect = stage === 'preview-results';
    const isSelected = isTimelineStageSelected(timelineStage);
    const visualMeta = getTaskVisualMeta(timelineStage.name);
    const TaskIcon = visualMeta.icon;
    const taskBadge = canSelect && !isSelected ? { label: 'Excluded', tone: 'queued' as const } : getTaskBadge(timelineStage, stage);
    const visibleItems = timelineStage.items.slice(0, 8);
    const hiddenItemCount = Math.max(0, timelineStage.items.length - visibleItems.length);
    const detailsId = `optimize-task-${timelineStage.id.replace(/[^a-zA-Z0-9_-]/g, '-')}`;

    return (
      <section
        key={timelineStage.id}
        className={`relative border-b border-slate-900/[0.07] transition-colors duration-300 first:rounded-t-[1.55rem] last:border-b-0 last:rounded-b-[1.55rem] ${
          isError ? 'bg-rose-50/28' : isActive ? 'bg-[rgba(var(--page-accent-rgb),0.08)] animate-clean-card-pulse' : 'hover:bg-white/38'
        } ${canSelect && isSelected ? 'shadow-[inset_5px_0_0_rgba(var(--page-accent-rgb),0.32)]' : ''} ${canSelect && !isSelected ? 'opacity-70' : ''}`}
      >
        <div className="group flex w-full items-center gap-[clamp(0.8rem,1.15vw,1.25rem)] px-[clamp(0.8rem,1.35vw,1.35rem)] py-[clamp(0.85rem,1.2vw,1.2rem)] text-left transition">
          {canSelect && (
            <button
              type="button"
              onClick={() => toggleTaskSelected(timelineStage.id)}
              aria-label={`${isSelected ? 'Deselect' : 'Select'} ${timelineStage.name}`}
              aria-pressed={isSelected}
              className={`flex h-[clamp(1.35rem,1.75vw,1.7rem)] w-[clamp(1.35rem,1.75vw,1.7rem)] shrink-0 items-center justify-center rounded-full border transition-all ${
                isSelected
                  ? 'border-[var(--page-accent)] bg-[var(--page-accent)] text-white shadow-[0_8px_18px_var(--page-accent-glow),0_0_0_5px_rgba(var(--page-accent-rgb),0.10)]'
                  : 'border-slate-300 bg-white/76 text-transparent shadow-[0_6px_14px_rgba(83,76,148,0.06)] hover:border-[rgba(var(--page-accent-rgb),0.45)] hover:text-[rgba(var(--page-accent-rgb),0.55)]'
              }`}
            >
              <Check className="h-[clamp(0.8rem,1vw,1rem)] w-[clamp(0.8rem,1vw,1rem)]" strokeWidth={3} />
            </button>
          )}

          <button
            type="button"
            aria-controls={detailsId}
            aria-expanded={isExpanded}
            onClick={() => setExpandedTaskId(isExpanded ? NO_EXPANDED_TASK : timelineStage.id)}
            className="flex min-w-0 flex-1 items-center gap-[clamp(0.8rem,1.15vw,1.25rem)] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--page-accent-rgb),0.45)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#fbf9ff]"
          >
            <div
              className={`flex h-[clamp(2.75rem,3.7vw,4.05rem)] w-[clamp(2.75rem,3.7vw,4.05rem)] shrink-0 items-center justify-center rounded-[1.05rem] border bg-white/76 backdrop-blur-xl ${
                isActive
                  ? 'border-[rgba(var(--page-accent-rgb),0.24)] text-[var(--page-accent)]'
                  : isError
                    ? 'border-rose-200/90 text-rose-500'
                    : 'border-[rgba(var(--page-accent-rgb),0.14)] text-[var(--page-accent)]'
              }`}
            >
              <TaskIcon className="h-[clamp(1.25rem,1.65vw,1.65rem)] w-[clamp(1.25rem,1.65vw,1.65rem)]" strokeWidth={2.15} />
            </div>

            <div className="min-w-0 flex-1">
              <h3 className="truncate text-[clamp(0.92rem,1.12vw,1.15rem)] font-black leading-tight text-slate-950">{timelineStage.name}</h3>
              <p className="mt-[clamp(0.25rem,0.45vw,0.4rem)] truncate text-[clamp(0.74rem,0.92vw,0.92rem)] font-semibold leading-snug text-slate-500">{visualMeta.description}</p>
            </div>
          </button>

          <span className={`hidden shrink-0 rounded-full px-[clamp(0.65rem,0.9vw,0.8rem)] py-[clamp(0.3rem,0.45vw,0.4rem)] text-[clamp(0.68rem,0.84vw,0.8rem)] font-black leading-none sm:inline-flex ${taskBadgeClassByTone[taskBadge.tone]}`}>
            {taskBadge.label}
          </span>

          <span className="shrink-0 whitespace-nowrap text-[clamp(0.72rem,0.9vw,0.86rem)] font-black text-slate-500">
            {taskCountLabel(timelineStage.items.length)}
          </span>

          <button
            type="button"
            aria-controls={detailsId}
            aria-expanded={isExpanded}
            onClick={() => setExpandedTaskId(isExpanded ? NO_EXPANDED_TASK : timelineStage.id)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-white/62 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--page-accent-rgb),0.45)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#fbf9ff]"
            aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${timelineStage.name}`}
          >
            {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </button>
        </div>

        {isExpanded && (
          <div id={detailsId} className="px-[clamp(0.8rem,1.35vw,1.35rem)] pb-[clamp(0.8rem,1.2vw,1.2rem)]">
            <div className="ml-[clamp(3.55rem,4.9vw,5.25rem)] overflow-hidden rounded-[1.1rem] border border-[rgba(var(--page-accent-rgb),0.14)] bg-white/54 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)] backdrop-blur-xl">
              {visibleItems.length > 0 ? (
                <>
                  {visibleItems.map((item, index) => {
                    const itemBadge = getTaskItemBadge(item, taskBadge);

                    return (
                      <div
                        key={`${timelineStage.id}-${index}-${item}`}
                        className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_1.35rem] items-center gap-[clamp(0.55rem,0.95vw,0.9rem)] border-b border-slate-900/[0.06] px-[clamp(0.75rem,1.15vw,1rem)] py-[clamp(0.65rem,0.95vw,0.85rem)] last:border-b-0"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--page-accent)] shadow-[0_0_0_4px_rgba(var(--page-accent-rgb),0.11)]" />
                          <span className="truncate text-[clamp(0.75rem,0.9vw,0.88rem)] font-bold text-slate-700">{item}</span>
                        </div>
                        <span className={`shrink-0 rounded-full px-[clamp(0.55rem,0.8vw,0.7rem)] py-[clamp(0.28rem,0.42vw,0.36rem)] text-[clamp(0.64rem,0.78vw,0.76rem)] font-black leading-none ${taskBadgeClassByTone[itemBadge.tone]}`}>
                          {itemBadge.label}
                        </span>
                        <ChevronRight className="h-5 w-5 shrink-0 text-slate-300" />
                      </div>
                    );
                  })}

                  {hiddenItemCount > 0 && (
                    <div className="border-t border-slate-900/[0.06] px-[clamp(0.75rem,1.15vw,1rem)] py-2 text-center text-[clamp(0.68rem,0.82vw,0.78rem)] font-black text-slate-400">
                      +{hiddenItemCount} more {hiddenItemCount === 1 ? 'item' : 'items'}
                    </div>
                  )}
                </>
              ) : (
                <div className="flex min-w-0 items-center gap-3 px-[clamp(0.75rem,1.15vw,1rem)] py-[clamp(0.75rem,1vw,0.95rem)]">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--page-accent)] shadow-[0_0_0_4px_rgba(var(--page-accent-rgb),0.11)]" />
                  <span className="truncate text-[clamp(0.75rem,0.9vw,0.88rem)] font-bold text-slate-500">Waiting for optimizer output...</span>
                  {isActive && <Loader2 className="ml-auto h-4 w-4 shrink-0 animate-spin text-[var(--page-accent)]" />}
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    );
  };

  const renderTaskPanel = () => {
    const panelTitle = stage === 'previewing'
      ? 'Optimization Preview'
      : stage === 'preview-results'
        ? 'Performance Tweaks'
        : 'Optimization Progress';
    const emptyTitle = noOptimizationsFound
      ? 'No optimizations found'
      : stage === 'preview-results' ? 'System already optimized' : 'Preparing optimization checks';
    const emptyDescription = noOptimizationsFound
      ? 'Mole checked your system and did not find valid optimization tweaks to apply.'
      : stage === 'preview-results'
      ? 'No significant optimizations were found in the preview.'
      : 'Tweaks will appear here as Mole reads actionable optimizer output.';

    return (
      <section className="flex min-h-0 min-w-0 flex-col pt-[clamp(0.4rem,1.65vw,2rem)]">
        <div className="mb-[clamp(0.6rem,1vw,1rem)] flex items-center justify-between gap-3">
          <h2 className="text-[clamp(0.95rem,1.3vw,1.25rem)] font-black text-slate-600">{panelTitle}</h2>
          <div className="rounded-full bg-white/70 px-3 py-1 text-[clamp(0.72rem,0.88vw,0.82rem)] font-black text-[var(--page-accent)] shadow-[0_8px_24px_rgba(83,76,148,0.06)]">
            {taskCountLabel(activeStats.totalItems)}
          </div>
        </div>

        <div className="relative min-h-0 flex-1 overflow-hidden rounded-[1.55rem]">
          <div ref={taskListRef} onScroll={updateTaskScrollShadow} className="h-full min-h-0 overflow-auto pr-2 custom-scrollbar">
            <div>
              {activeTimeline.length > 0 && !noOptimizationsFound && (
                <div className="overflow-hidden rounded-[1.55rem] border border-[rgba(var(--page-accent-rgb),0.14)] bg-white/58 backdrop-blur-2xl">
                  {activeTimeline.map(renderTimelineCard)}
                </div>
              )}

              {(activeTimeline.length === 0 || noOptimizationsFound) && (
                <div className="rounded-[1.15rem] border border-[rgba(var(--page-accent-rgb),0.14)] bg-white/62 p-8 text-center">
                  <Gauge className="mx-auto h-10 w-10 text-[var(--page-accent)]" />
                  <h3 className="mt-3 text-xl font-black text-slate-950">{emptyTitle}</h3>
                  <p className="mx-auto mt-2 max-w-md text-sm font-semibold leading-relaxed text-slate-500">{emptyDescription}</p>
                  {noOptimizationsFound && (
                    <div className="mx-auto mt-4 inline-flex rounded-full border border-emerald-100 bg-emerald-50/78 px-4 py-2 text-sm font-black text-emerald-600">
                      System already optimized
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          {taskScrollShadow.top && <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-10 rounded-t-[1.55rem] bg-[linear-gradient(to_bottom,rgba(67,56,122,0.14),rgba(67,56,122,0))]" />}
          {taskScrollShadow.bottom && <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-10 rounded-b-[1.55rem] bg-[linear-gradient(to_top,rgba(67,56,122,0.14),rgba(67,56,122,0))]" />}
        </div>
      </section>
    );
  };

  const renderFooter = () => (
    <footer className="mt-[clamp(0.7rem,1.6vw,1.5rem)] flex shrink-0 flex-col items-center gap-[clamp(0.55rem,1vw,0.75rem)]">
      {stage === 'preview-results' ? (
        <div className="flex w-full justify-center">
          <Button
            icon={Play}
            onClick={startOptimization}
            disabled={selectedPreviewTaskCount === 0 || noOptimizationsFound}
            className="min-w-[min(370px,42vw)] rounded-full bg-[var(--page-accent)] px-[clamp(2rem,3vw,2.5rem)] py-[clamp(0.85rem,1.25vw,1rem)] text-[clamp(0.95rem,1.25vw,1.25rem)] shadow-[0_18px_50px_var(--page-accent-glow)] hover:bg-[var(--page-accent-hover)] [&_svg]:h-[clamp(1rem,1.35vw,1.25rem)] [&_svg]:w-[clamp(1rem,1.35vw,1.25rem)]"
          >
            Apply Optimizations
          </Button>
        </div>
      ) : (
        <Button
          icon={stage === 'previewing' ? X : Loader2}
          onClick={() => stopProcess(stage === 'previewing' ? 'preview' : 'main')}
          size="lg"
          className="min-w-[min(450px,42vw)] rounded-full bg-[var(--page-accent)] px-[clamp(2rem,3vw,2.5rem)] py-[clamp(0.85rem,1.25vw,1rem)] text-[clamp(0.95rem,1.25vw,1.25rem)] shadow-[0_18px_50px_var(--page-accent-glow)] hover:bg-[var(--page-accent-hover)] [&_svg]:h-[clamp(1rem,1.35vw,1.25rem)] [&_svg]:w-[clamp(1rem,1.35vw,1.25rem)]"
        >
          {stage === 'previewing' ? 'Cancel Preview' : 'Stop Optimization'}
        </Button>
      )}

      <div className="flex items-center gap-2 text-[clamp(0.78rem,1vw,0.875rem)] font-bold text-slate-500">
        <ShieldCheck className="h-4 w-4" />
        A preview runs before any optimization changes
      </div>
    </footer>
  );

  const renderAlreadyOptimizedScreen = () => (
    <div className="relative h-full min-h-0 overflow-hidden bg-[#fbf9ff] px-[clamp(1.25rem,3vw,4rem)] pb-[clamp(0.85rem,1.65vw,1.75rem)] pt-[clamp(1.25rem,2.4vw,2.5rem)] text-slate-950" style={optimizeAccentStyle}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_26%_14%,rgba(var(--page-accent-rgb),0.08),transparent_28%),radial-gradient(circle_at_80%_12%,rgba(109,93,252,0.08),transparent_28%),linear-gradient(135deg,rgba(255,255,255,0.78),rgba(247,243,255,0.58))]" />

      <div className="relative flex h-full min-h-0 items-center justify-center text-center">
        <main className="flex max-w-[42rem] flex-col items-center">
          <div className="flex h-[clamp(5rem,8vw,6.5rem)] w-[clamp(5rem,8vw,6.5rem)] items-center justify-center rounded-full bg-white/78 text-emerald-500 shadow-[0_24px_76px_rgba(83,76,148,0.14),0_0_0_10px_rgba(34,197,94,0.08)] backdrop-blur-2xl">
            <Check className="h-[46%] w-[46%]" strokeWidth={3} />
          </div>

          <h1 className="mt-7 text-[clamp(2.6rem,5.8vw,5.6rem)] font-black leading-[0.9] tracking-[-0.06em] text-slate-950">
            System is clean.
          </h1>
          <p className="mt-5 text-[clamp(1.05rem,1.55vw,1.35rem)] font-semibold leading-relaxed text-slate-500">
            There is nothing to optimize.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button icon={Check} onClick={reset} size="lg" className="min-w-[min(260px,42vw)] rounded-full bg-[var(--page-accent)] px-[clamp(2rem,3vw,2.5rem)] py-[clamp(0.85rem,1.25vw,1rem)] text-[clamp(0.95rem,1.25vw,1.25rem)] shadow-[0_18px_50px_var(--page-accent-glow)] hover:bg-[var(--page-accent-hover)] [&_svg]:h-[clamp(1rem,1.35vw,1.25rem)] [&_svg]:w-[clamp(1rem,1.35vw,1.25rem)]">
              Done
            </Button>
            <Button variant="secondary" icon={RefreshCcw} onClick={startPreview} size="lg" className="min-w-[min(260px,42vw)] rounded-full border border-white/70 bg-white/70 px-[clamp(2rem,3vw,2.5rem)] py-[clamp(0.85rem,1.25vw,1rem)] text-[clamp(0.95rem,1.25vw,1.25rem)] text-slate-600 shadow-[0_10px_30px_rgba(83,76,148,0.08)] hover:bg-white [&_svg]:h-[clamp(1rem,1.35vw,1.25rem)] [&_svg]:w-[clamp(1rem,1.35vw,1.25rem)]">
              Scan Again
            </Button>
          </div>
        </main>
      </div>
    </div>
  );

  // ─── Idle ────────────────────────────────────────────────────────────────────

  const viewKey = stage === 'idle' ? 'start' : 'working';

  const renderStage = () => {
  if (stage === 'idle') {
    return <StartScreen config={config} onStart={startPreview} variant="feature" />;
  }

  if (stage === 'preview-results' && noOptimizationsFound) {
    return renderAlreadyOptimizedScreen();
  }

  // ─── Previewing (dry-run) ────────────────────────────────────────────────────

  if (stage === 'previewing' || stage === 'preview-results' || stage === 'optimizing') {
    const header = stageCopy[stage];
    const backHandler = () => {
      if (stage === 'previewing') {
        void stopProcess('preview');
        return;
      }
      if (stage === 'optimizing') {
        void stopProcess('main');
        return;
      }
      reset();
    };

    return (
      <div className="relative h-full min-h-0 overflow-hidden bg-[#fbf9ff] px-[clamp(1.25rem,3vw,4rem)] pb-[clamp(0.85rem,1.65vw,1.75rem)] pt-[clamp(1.25rem,2.4vw,2.5rem)] text-slate-950" style={optimizeAccentStyle}>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_26%_14%,rgba(var(--page-accent-rgb),0.08),transparent_28%),radial-gradient(circle_at_80%_12%,rgba(109,93,252,0.08),transparent_28%),linear-gradient(135deg,rgba(255,255,255,0.78),rgba(247,243,255,0.58))]" />

        <div className="relative flex h-full min-h-0 flex-col">
          <header className="flex shrink-0 items-start justify-between gap-4">
            <div>
              <h1 className="text-[clamp(1.65rem,2.65vw,3.15rem)] font-black leading-none text-slate-950">{header.title}</h1>
              <p className="mt-[clamp(0.65rem,1.15vw,1rem)] max-w-[34rem] text-[clamp(0.88rem,1.15vw,1rem)] font-semibold leading-relaxed text-slate-500">{header.description}</p>
            </div>

            <div className="flex shrink-0 items-center gap-3">
              <Button variant="secondary" icon={ArrowLeft} onClick={backHandler} className="rounded-full border border-white/70 bg-white/70 px-[clamp(1rem,1.45vw,1.25rem)] py-[clamp(0.65rem,0.95vw,0.75rem)] text-[clamp(0.88rem,1.1vw,1rem)] text-slate-600 shadow-[0_10px_30px_rgba(83,76,148,0.08)] hover:bg-white [&_svg]:h-[clamp(1rem,1.25vw,1.25rem)] [&_svg]:w-[clamp(1rem,1.25vw,1.25rem)]">
                Back
              </Button>
              {stage === 'preview-results' && (
                <Button variant="secondary" icon={RefreshCcw} onClick={startPreview} className="rounded-full border border-white/70 bg-white/70 px-[clamp(1rem,1.45vw,1.25rem)] py-[clamp(0.65rem,0.95vw,0.75rem)] text-[clamp(0.88rem,1.1vw,1rem)] text-[var(--page-accent)] shadow-[0_10px_30px_rgba(83,76,148,0.08)] hover:bg-white [&_svg]:h-[clamp(1rem,1.25vw,1.25rem)] [&_svg]:w-[clamp(1rem,1.25vw,1.25rem)]">
                  Scan Again
                </Button>
              )}
            </div>
          </header>

          <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,0.96fr)_minmax(0,1fr)] gap-[clamp(1.25rem,3vw,4rem)]">
            {renderOptimizationPlan()}
            {renderTaskPanel()}
          </div>

          {renderFooter()}
        </div>
      </div>
    );
  }

  if (stage === 'complete') {
    const { completedStages, totalItems } = timelineStats(timeline);

    return (
      <div className="relative h-full min-h-0 overflow-hidden bg-[#fbf9ff] p-7" style={optimizeAccentStyle}>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(var(--page-accent-rgb),0.12),transparent_36%),radial-gradient(circle_at_16%_88%,rgba(34,197,94,0.12),transparent_34%)]" />
        <div className="relative flex h-full items-center justify-center">
          <div className="w-full max-w-xl rounded-[1.4rem] border border-white/80 bg-white/70 p-8 text-center shadow-[0_24px_80px_rgba(83,76,148,0.16)] backdrop-blur-2xl">
            <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-500 shadow-[0_18px_45px_rgba(34,197,94,0.16)]">
              <Check className="h-10 w-10" />
            </div>
            <h2 className="text-3xl font-black text-slate-950">Optimization Complete!</h2>
            <p className="mt-2 text-sm font-semibold text-slate-500">Mole completed {completedStages.length} performance tweaks and processed {totalItems} optimization actions.</p>

            {completedStages.length > 0 && (
              <div className="mt-6 rounded-[1.15rem] border border-emerald-100 bg-emerald-50/55 p-4 text-left">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-black text-emerald-700">
                  <Zap className="h-4 w-4" />
                  Completed Tweaks
                </h3>
                <div className="space-y-2">
                  {completedStages.slice(0, 5).map((completedStage) => (
                    <div key={completedStage.id} className="flex items-center gap-3">
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-500">
                        <CheckCircle2 className="h-3 w-3" />
                      </div>
                      <span className="text-sm font-semibold text-slate-600">{completedStage.name}</span>
                      {completedStage.startTime && completedStage.endTime && (
                        <span className="ml-auto text-xs font-bold text-slate-400">
                          {((completedStage.endTime - completedStage.startTime) / 1000).toFixed(1)}s
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Button icon={Check} onClick={reset} size="lg" className="mt-8 rounded-full bg-[var(--page-accent)] px-8 shadow-[0_18px_44px_var(--page-accent-glow)] hover:bg-[var(--page-accent-hover)]">
              Done
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Error ───────────────────────────────────────────────────────────────────

  if (stage === 'error') {
    return (
      <div className="relative h-full min-h-0 overflow-hidden bg-[#fbf9ff] p-7" style={optimizeAccentStyle}>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(239,35,60,0.14),transparent_36%),linear-gradient(135deg,rgba(255,255,255,0.78),rgba(247,243,255,0.58))]" />
        <div className="relative flex h-full items-center justify-center">
          <div className="w-full max-w-xl rounded-[1.4rem] border border-white/80 bg-white/70 p-8 text-center shadow-[0_24px_80px_rgba(83,76,148,0.16)] backdrop-blur-2xl">
            <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-rose-100 text-rose-500 shadow-[0_18px_45px_rgba(239,35,60,0.16)]">
              <AlertCircle className="h-10 w-10" />
            </div>
            <h2 className="text-3xl font-black text-slate-950">Optimization Failed</h2>
            <p className="mt-2 text-sm font-semibold text-slate-500">Some tweaks encountered errors. Check the details below, then try the tune-up again.</p>

            {logs.filter((log) => log.type === 'error').length > 0 && (
              <div className="mt-6 rounded-[1.15rem] border border-rose-100 bg-rose-50/55 p-4 text-left">
                <h3 className="mb-3 text-sm font-black text-rose-700">Error Details</h3>
                <div className="max-h-40 space-y-1 overflow-y-auto font-mono text-xs custom-scrollbar">
                  {logs
                    .filter((log) => log.type === 'error')
                    .map((log, index) => (
                      <div key={`${log.timestamp}-${index}`} className="text-rose-500">
                        {log.text}
                      </div>
                    ))}
                </div>
              </div>
            )}

            <div className="mt-8 flex justify-center gap-4">
              <Button variant="secondary" onClick={reset} className="rounded-full border border-white/70 bg-white/70 px-8 text-slate-600 shadow-[0_10px_30px_rgba(83,76,148,0.08)] hover:bg-white">
                Back
              </Button>
              <Button icon={Zap} onClick={startOptimization} className="rounded-full bg-[var(--page-accent)] px-8 shadow-[0_18px_44px_var(--page-accent-glow)] hover:bg-[var(--page-accent-hover)]">
                Try Again
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
  };

  return (
    <StageTransition viewKey={viewKey}>
      {renderStage()}
    </StageTransition>
  );
}
