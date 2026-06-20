import { memo, useEffect, useRef, useState } from 'react';
import { forceCollide, forceSimulation, forceX, forceY } from 'd3-force';
import type { SimulationNodeDatum } from 'd3-force';
import { AnimatePresence, motion } from 'motion/react';
import {
  CheckCircle, AlertTriangle, Loader, ArrowLeft, X, Trash2,
  Package, Folder, Info, AlertCircle, Check, Search, ArrowUpDown, RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StartScreen } from '@/components/common/StartScreen';
import { StageTransition } from '@/components/common/StageTransition';
import { featureAccentVars } from '@/lib/featureAccents';
import { usePersistentState } from '@/utils/persistentState';
import { formatBytes } from '@/utils/format';
import { usePaywall } from '@/hooks/usePaywall';
import type { PageConfig } from '@/types';

type Stage = 'idle' | 'loading' | 'selection' | 'confirmation' | 'executing' | 'results' | 'error';

const uninstallAccentStyle = featureAccentVars('uninstall');

interface App {
  name: string;
  bundle_id: string;
  source: string;
  uninstall_name: string;
  path: string;
  size: string;
  icon?: string;
}

interface CommandResult {
  ok: boolean;
  command: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
}

interface BubbleLayoutItem {
  x: number;
  y: number;
  size: number;
}

interface BubbleNode extends SimulationNodeDatum {
  id: string;
  kind: 'center' | 'app';
  radius: number;
  fx?: number | null;
  fy?: number | null;
}

const GLASS_CARD = 'bg-white/45 border border-white/55 shadow-[0_24px_80px_rgba(109,93,252,0.12),inset_0_1px_0_rgba(255,255,255,0.72)] backdrop-blur-2xl';
const SOFT_CARD = 'rounded-[1.75rem] border border-white/55 bg-white/35  backdrop-blur-2xl';
const UNINSTALL_SHELL = 'relative h-full min-h-0 overflow-hidden p-2';
const UNINSTALL_ACCENT_BG = 'pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_88%_16%,rgba(var(--page-accent-rgb),0.16),transparent_34%),radial-gradient(circle_at_16%_88%,rgba(109,93,252,0.12),transparent_38%)]';
const LIST_CARD = `relative overflow-hidden rounded-[1.5rem] p-4 ${SOFT_CARD}`;
const APP_SELECTION_CARD = `relative overflow-hidden rounded-[1.25rem] p-3 ${SOFT_CARD}`;
const PILL_INPUT = 'rounded-full border border-white/60 bg-white/45 text-slate-950 shadow-inner shadow-white/40 backdrop-blur-xl placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[rgba(var(--page-accent-rgb),0.35)] focus:border-[rgba(var(--page-accent-rgb),0.35)] transition-all';
const MUTED_PILL = 'rounded-full border border-white/60 bg-white/35 shadow-inner shadow-white/30 backdrop-blur-xl';

function getScrollShadows(element: HTMLDivElement | null) {
  if (!element) return { top: false, bottom: false };

  const hasOverflow = element.scrollHeight > element.clientHeight + 1;

  return {
    top: hasOverflow && element.scrollTop > 1,
    bottom: hasOverflow && element.scrollTop + element.clientHeight < element.scrollHeight - 1,
  };
}

function stripPersistedIcon(app: App) {
  if (!app.icon) return app;

  const appWithoutIcon = { ...app };
  delete appWithoutIcon.icon;
  return appWithoutIcon;
}

const AppIcon = memo(function AppIcon({ icon, size = 'md' }: { icon?: string; size?: 'sm' | 'md' | 'lg' }) {
  const [failed, setFailed] = useState(false);
  const iconClassName = size === 'sm' ? 'w-6 h-6 rounded-lg' : size === 'lg' ? 'w-16 h-16 rounded-[1.35rem]' : 'w-10 h-10 rounded-xl';
  const fallbackIconClassName = size === 'sm' ? 'w-3.5 h-3.5' : size === 'lg' ? 'w-8 h-8' : 'w-5 h-5';

  useEffect(() => {
    setFailed(false);
  }, [icon]);

  if (icon && !failed) {
    return (
      <img
        src={icon}
        alt=""
        className={`${iconClassName} object-contain flex-shrink-0 shadow-[0_10px_24px_rgba(15,23,42,0.10)]`}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div className={`${iconClassName} border border-rose-200/70 bg-rose-100/35 flex items-center justify-center flex-shrink-0 shadow-[0_10px_24px_rgba(244,63,94,0.14)] backdrop-blur-xl`}>
      <Package className={`${fallbackIconClassName} text-[var(--page-accent)]`} />
    </div>
  );
});

function AppRemovalAnimation({ progressPercent }: { progressPercent: number }) {
  return (
    <div
      className="relative mx-auto h-56 w-[25rem] max-w-full overflow-hidden"
      aria-hidden="true"
      data-testid="uninstall-removal-animation"
    >
      <div className="absolute bottom-7 left-1/2 h-5 w-72 -translate-x-1/2 rounded-full bg-slate-950/10 blur-xl" />
      <div className="uninstall-animation-removal-field absolute left-[7.4rem] top-[5.75rem] h-20 w-44 rotate-[8deg] rounded-full border border-rose-200/55 bg-[linear-gradient(90deg,rgba(255,255,255,0.08),rgba(244,63,94,0.18),rgba(255,255,255,0.04))] shadow-[0_0_42px_rgba(244,63,94,0.14)]" />

      <div className="absolute left-10 top-8 h-[5.6rem] w-40 animate-uninstall-source-card rounded-[1.55rem] border border-white/70 bg-white/85 p-3 shadow-[0_24px_64px_rgba(244,63,94,0.14)] backdrop-blur-2xl">
        <div className="absolute -inset-px rounded-[1.55rem] bg-[linear-gradient(135deg,rgba(255,255,255,0.8),transparent_52%,rgba(244,63,94,0.12))]" />
        <div className="relative flex h-full flex-col justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-rose-200/80 bg-rose-50/80 shadow-inner shadow-white/70">
              <Package className="h-[1.05rem] w-[1.05rem] text-[var(--page-accent)]" />
            </div>
            <div className="min-w-0 space-y-1.5">
              <div className="h-1.5 w-16 rounded-full bg-slate-200/85" />
              <div className="h-1.5 w-10 rounded-full bg-slate-100/95" />
            </div>
          </div>
          <div className="relative h-2 w-28 overflow-hidden rounded-full bg-gradient-to-r from-rose-100 via-red-100 to-transparent">
            <div className="animate-uninstall-card-scan h-full w-9 rounded-full bg-gradient-to-r from-transparent via-rose-400/80 to-transparent" />
          </div>
        </div>
      </div>

      <div className="absolute left-[6.7rem] top-[6.25rem] h-2 w-24 animate-uninstall-strip-into-receiver rounded-full bg-white/90 shadow-[0_8px_20px_rgba(244,63,94,0.18)]" style={{ animationDelay: '-1.86s' }} />
      <div className="absolute left-[6.9rem] top-[7.1rem] h-1.5 w-20 animate-uninstall-strip-into-receiver rounded-full bg-rose-200/90 shadow-[0_8px_18px_rgba(244,63,94,0.16)]" style={{ animationDelay: '-1.28s' }} />
      <div className="absolute left-[6.4rem] top-[7.85rem] h-1.5 w-16 animate-uninstall-strip-into-receiver rounded-full bg-slate-200/95 shadow-[0_8px_16px_rgba(15,23,42,0.08)]" style={{ animationDelay: '-0.7s' }} />
      <div className="absolute left-[7.25rem] top-[8.55rem] h-1.5 w-14 animate-uninstall-strip-into-receiver rounded-full bg-red-200/90 shadow-[0_8px_18px_rgba(248,113,113,0.16)]" style={{ animationDelay: '-0.14s' }} />

      <div className="absolute right-12 bottom-8 h-28 w-28">
        <div className="absolute left-1/2 top-2 h-4 w-[4.7rem] -translate-x-1/2 animate-uninstall-receiver-lid rounded-full border border-slate-400/40 bg-slate-800 shadow-[0_14px_24px_rgba(15,23,42,0.18)]" />
        <div className="absolute bottom-2 left-1/2 h-[5.7rem] w-[4.9rem] -translate-x-1/2 overflow-hidden rounded-[1.35rem] border border-slate-500/25 bg-slate-900/90 shadow-[0_26px_56px_rgba(15,23,42,0.24)]">
          <div className="absolute inset-x-2 top-2 h-3 rounded-full bg-white/[0.08]" />
          <div
            className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-red-500 via-rose-400 to-rose-200 opacity-95 transition-all duration-500"
            style={{ height: `${Math.max(10, progressPercent)}%` }}
          />
          <div className="absolute inset-x-4 top-6 space-y-2">
            <div className="h-1 rounded-full bg-white/[0.24]" />
            <div className="h-1 rounded-full bg-white/[0.18]" />
            <div className="h-1 rounded-full bg-white/[0.12]" />
          </div>
          <div className="absolute bottom-3 left-1/2 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full border border-white/10 bg-slate-950/35">
            <Trash2 className="h-4 w-4 text-white/70" />
          </div>
        </div>
        <div className="absolute bottom-0 left-1/2 h-2 w-24 -translate-x-1/2 rounded-full bg-slate-950/[0.12] blur-sm" />
      </div>
    </div>
  );
}

function parseAppSizeToBytes(sizeStr: string): number {
  const match = sizeStr.match(/^([\d.]+)\s*([A-Za-z]+)$/);
  if (!match) return 0;

  const value = parseFloat(match[1]);
  const unit = match[2].toUpperCase();
  const multipliers: { [key: string]: number } = {
    B: 1,
    KB: 1024,
    MB: 1024 * 1024,
    GB: 1024 * 1024 * 1024,
    TB: 1024 * 1024 * 1024 * 1024,
  };

  return value * (multipliers[unit] || 0);
}

function getCenterBubbleSize(count: number) {
  if (count === 0) return 202;
  if (count <= 8) return 142;
  if (count <= 18) return 136;
  return 128;
}

function getAppBubbleSize(count: number, stageWidth: number, stageHeight: number) {
  const available = Math.min(stageWidth, stageHeight);
  const target = count <= 1 ? 156 : count <= 3 ? 144 : count <= 6 ? 132 : count <= 10 ? 122 : count <= 16 ? 114 : count <= 24 ? 106 : 98;
  return Math.max(96, Math.min(target, available * 0.34));
}

function getBubbleStageHeight(count: number) {
  if (count <= 3) return 360;
  if (count <= 6) return 440;
  if (count <= 10) return 560;
  if (count <= 16) return 720;
  if (count <= 24) return 900;
  return 1080 + Math.ceil((count - 24) / 6) * 160;
}

function getPackedBubbleLayout(appIds: string[], stageWidth: number, stageHeight: number, previousLayout?: Record<string, BubbleLayoutItem>) {
  const count = appIds.length;
  const width = Math.max(stageWidth, 320);
  const height = Math.max(stageHeight, 352);
  const centerX = width / 2;
  const centerY = height / 2;
  const centerSize = getCenterBubbleSize(count);
  const appSize = getAppBubbleSize(count, width, height);
  const centerRadius = centerSize / 2;
  const appRadius = appSize / 2;
  const padding = count > 12 ? 2 : 4;
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const nodes: BubbleNode[] = [
    {
      id: 'center',
      kind: 'center',
      radius: centerRadius,
      x: centerX,
      y: centerY,
      fx: centerX,
      fy: centerY,
    },
  ];

  for (let position = 0; position < count; position += 1) {
    const id = appIds[position];
    const previousPosition = previousLayout?.[id];
    const angle = -Math.PI / 2 + position * goldenAngle;
    const seededRadius = centerRadius + appRadius + padding + Math.sqrt(position) * appRadius * 0.82;

    nodes.push({
      id,
      kind: 'app',
      radius: appRadius,
      x: previousPosition?.x ?? centerX + Math.cos(angle) * seededRadius,
      y: previousPosition?.y ?? centerY + Math.sin(angle) * seededRadius,
    });
  }

  const keepInsideBounds = () => {
    nodes.forEach(node => {
      if (node.kind === 'center') return;

      const radius = node.radius + padding;
      node.x = Math.max(radius, Math.min(width - radius, node.x ?? centerX));
      node.y = Math.max(radius, Math.min(height - radius, node.y ?? centerY));
    });
  };

  const simulation = forceSimulation(nodes)
    .force('x', forceX<BubbleNode>(centerX).strength(node => node.kind === 'center' ? 1 : 0.085))
    .force('y', forceY<BubbleNode>(centerY).strength(node => node.kind === 'center' ? 1 : 0.085))
    .force('collide', forceCollide<BubbleNode>().radius(node => node.radius + padding).strength(1).iterations(8))
    .force('bounds', () => keepInsideBounds())
    .stop();

  for (let tick = 0; tick < 140; tick += 1) simulation.tick();
  keepInsideBounds();

  return nodes.reduce<Record<string, BubbleLayoutItem>>((layout, node) => {
    layout[node.id] = {
      x: node.x ?? centerX,
      y: node.y ?? centerY,
      size: node.radius * 2,
    };
    return layout;
  }, {});
}

function SelectedAppBubbleCluster({
  apps,
  appIcons,
  selectedAppIndexes,
  onToggle,
}: {
  apps: App[];
  appIcons: Record<string, string>;
  selectedAppIndexes: number[];
  onToggle: (index: number) => void;
}) {
  const selectedAppItems = selectedAppIndexes
    .map(index => ({ index, app: apps[index] }))
    .filter((item): item is { index: number; app: App } => Boolean(item.app));
  const selectedCount = selectedAppItems.length;
  const selectedAppIds = selectedAppItems.map(({ app, index }) => `${app.path}-${index}`);
  const stageRef = useRef<HTMLDivElement>(null);
  const stageMinHeight = getBubbleStageHeight(selectedCount);
  const [stageSize, setStageSize] = useState({ width: 544, height: stageMinHeight });
  const layoutRef = useRef<Record<string, BubbleLayoutItem>>({});
  const [bubbleLayout, setBubbleLayout] = useState<Record<string, BubbleLayoutItem>>(() => getPackedBubbleLayout([], 544, 560));
  const isDense = selectedCount > 8;
  const selectedSize = selectedAppItems.reduce((total, { app }) => total + parseAppSizeToBytes(app.size), 0);
  const selectedSizeLabel = selectedCount === 0 ? 'No apps selected' : formatBytes(selectedSize);
  const selectedLayoutKey = selectedAppItems.map(({ app, index }) => `${index}:${app.path}:${app.size}`).join('|');
  const bubbleTransition = { type: 'spring', stiffness: 180, damping: 28, mass: 0.7 } as const;

  useEffect(() => {
    const element = stageRef.current;
    if (!element) return;

    const updateStageSize = () => {
      const rect = element.getBoundingClientRect();
      setStageSize(currentSize => {
        const nextWidth = Math.round(rect.width) || 544;
        const nextHeight = Math.round(rect.height) || stageMinHeight;

        return currentSize.width === nextWidth && currentSize.height === nextHeight
          ? currentSize
          : { width: nextWidth, height: nextHeight };
      });
    };

    updateStageSize();

    if (typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(updateStageSize);
    observer.observe(element);

    return () => observer.disconnect();
  }, [stageMinHeight]);

  useEffect(() => {
    setBubbleLayout(() => {
      const nextLayout = getPackedBubbleLayout(selectedAppIds, stageSize.width, stageSize.height, layoutRef.current);
      layoutRef.current = nextLayout;
      return nextLayout;
    });
  }, [selectedCount, selectedLayoutKey, stageSize.width, stageSize.height]);

  const centerLayout = bubbleLayout.center ?? getPackedBubbleLayout([], stageSize.width, stageSize.height).center;

  return (
    <div
      className="relative h-full min-h-[15rem] overflow-y-auto overflow-x-hidden custom-scrollbar"
      data-testid="selected-app-bubble-cluster"
    >
      <div
        ref={stageRef}
        className="relative mx-auto h-full w-full  overflow-hidden"
        data-testid="selected-app-orbit-stage"
        style={{ minHeight: stageMinHeight }}
      >
        <div className="pointer-events-none absolute w-full inset-6 rounded-full border border-white/30 opacity-50" />
        {selectedCount > 6 && (
          <div className="pointer-events-none absolute inset-1 rounded-[40%] border border-white/20 opacity-45" />
        )}
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/30 blur-3xl" />
        <motion.div
          className="uninstall-orbit-bubble absolute left-0 top-0 z-20 flex flex-col items-center justify-center gap-2 rounded-full px-4 text-center"
          data-testid="selected-app-center-bubble"
          style={{ width: centerLayout.size, height: centerLayout.size }}
          initial={{ x: centerLayout.x - centerLayout.size / 2, y: centerLayout.y - centerLayout.size / 2, scale: 0.94, opacity: 0 }}
          animate={{ x: centerLayout.x - centerLayout.size / 2, y: centerLayout.y - centerLayout.size / 2, scale: 1, opacity: 1 }}
          transition={bubbleTransition}
        >
          <Package className="h-9 w-9 text-slate-400/70" />
          <span className="relative text-xs font-black text-slate-950">
            {selectedCount === 0 ? 'Select apps' : `${selectedCount} selected`}
          </span>
          <span className="relative max-w-full truncate text-[11px] font-bold text-slate-500">
            {selectedSizeLabel}
          </span>
        </motion.div>
        <AnimatePresence initial={false}>
          {selectedCount > 0 && (
            <>
              {selectedAppItems.map(({ app, index }, position) => {
                const layout = bubbleLayout[`${app.path}-${index}`];
                if (!layout) return null;

                const iconSize = isDense ? 'sm' : selectedCount === 1 ? 'lg' : 'md';

                return (
                  <motion.button
                    key={`${app.path}-${index}`}
                    type="button"
                    className="uninstall-orbit-bubble group absolute left-0 top-0 z-10 flex aspect-square items-center justify-center rounded-full text-center outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--page-accent-rgb),0.45)]"
                    style={{
                      width: layout.size,
                      height: layout.size,
                    }}
                    initial={{ x: centerLayout.x - layout.size / 2, y: centerLayout.y - layout.size / 2, scale: 0.72, opacity: 0, filter: 'blur(6px)' }}
                    animate={{ x: layout.x - layout.size / 2, y: layout.y - layout.size / 2, scale: 1, opacity: 1, filter: 'blur(0px)' }}
                    exit={{ scale: [1, 1.08, 0.62], opacity: [1, 1, 0], filter: 'blur(7px)', transition: { duration: 0.22, ease: 'easeOut' } }}
                    transition={{ ...bubbleTransition, delay: Math.min(position * 0.018, 0.16) }}
                    whileHover={{ scale: 1.018 }}
                    whileTap={{ scale: 0.985 }}
                    onClick={() => onToggle(index)}
                    aria-label={`Deselect ${app.name}`}
                    data-testid="selected-app-bubble"
                  >
                    <span
                      className="relative flex h-full w-full flex-col items-center justify-center gap-2 rounded-full px-3"
                    >
                      <AppIcon icon={appIcons[app.path]} size={iconSize} />
                      <span className={`relative max-w-full truncate font-bold text-slate-950 drop-shadow-[0_1px_0_rgba(255,255,255,0.55)] ${isDense ? 'text-[10px]' : 'text-xs'}`}>
                        {app.name}
                      </span>
                      {!isDense && (
                        <span className="relative max-w-[86%] truncate text-[10px] font-semibold text-slate-500">
                          {app.size}
                        </span>
                      )}
                      <span className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full border border-rose-200/90 bg-white/95 text-rose-600 opacity-80 shadow-[0_8px_20px_rgba(244,63,94,0.24)] transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                        <X className="h-4 w-4" strokeWidth={2.8} />
                      </span>
                    </span>
                  </motion.button>
                );
              })}
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export function UninstallPage() {
  const { requireSubscription } = usePaywall();
  const [stage, setStage] = usePersistentState<Stage>('mole-uninstall-stage', 'idle');
  const [apps, setApps] = usePersistentState<App[]>('mole-uninstall-apps', []);
  const [appIcons, setAppIcons] = useState<Record<string, string>>(() => {
    const icons: Record<string, string> = {};
    apps.forEach(app => {
      if (app.path && app.icon) icons[app.path] = app.icon;
    });
    return icons;
  });
  const [selectedAppIndexes, setSelectedAppIndexes] = usePersistentState<number[]>('mole-uninstall-selected-apps', []);
  const [scanStatus, setScanStatus] = usePersistentState('mole-uninstall-scan-status', '');
  const [dryRunOutput, setDryRunOutput] = usePersistentState<string[]>('mole-uninstall-dry-run-output', []);
  const [executeOutput, setExecuteOutput] = usePersistentState<string[]>('mole-uninstall-execute-output', []);
  const [error, setError] = usePersistentState<{ title: string; message: string } | null>('mole-uninstall-error', null);
  const [result, setResult] = usePersistentState<CommandResult | null>('mole-uninstall-result', null);
  const [showAllApps, setShowAllApps] = usePersistentState('mole-uninstall-show-all-apps', false);
  const [analysisProgress, setAnalysisProgress] = usePersistentState('mole-uninstall-analysis-progress', 0);
  const [searchQuery, setSearchQuery] = usePersistentState('mole-uninstall-search-query', '');
  const [sortBy, setSortBy] = usePersistentState<'name' | 'size'>('mole-uninstall-sort-by', 'size');
  const [skipFinalConfirmation, setSkipFinalConfirmation] = usePersistentState('mole-uninstall-skip-final-confirmation', false);
  const [isRefreshingApps, setIsRefreshingApps] = useState(false);
  const [showFinalConfirmation, setShowFinalConfirmation] = useState(false);
  const [dontShowFinalConfirmationAgain, setDontShowFinalConfirmationAgain] = useState(false);
  const selectedApps = new Set(selectedAppIndexes);

  const dryRunListRef = useRef<HTMLDivElement>(null);
  const executeListRef = useRef<HTMLDivElement>(null);
  const appListRef = useRef<HTMLDivElement>(null);
  const scanCancelledRef = useRef(false);
  const iconLoadRunRef = useRef(0);
  const requestedIconsRef = useRef<Set<string>>(new Set());
  const [appListShadows, setAppListShadows] = useState({ top: false, bottom: false });

  useEffect(() => {
    if (stage !== 'selection') {
      setAppListShadows({ top: false, bottom: false });
      return;
    }

    const updateShadows = () => {
      const nextShadows = getScrollShadows(appListRef.current);
      setAppListShadows(previousShadows => previousShadows.top === nextShadows.top && previousShadows.bottom === nextShadows.bottom ? previousShadows : nextShadows);
    };

    const frame = requestAnimationFrame(updateShadows);
    window.addEventListener('resize', updateShadows);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', updateShadows);
    };
  }, [stage, apps.length, searchQuery, sortBy]);

  useEffect(() => {
    if (stage === 'loading') {
      setStage('idle');
      setScanStatus('');
    }
  }, []);

  useEffect(() => {
    if (!apps.some(app => app.icon)) return;

    setApps(currentApps => currentApps.map(stripPersistedIcon));
  }, []);

  // Setup stream listeners
  useEffect(() => {
    if (!window.moleDesktop) return;

    // List scan listeners
    const handleListStdout = () => {
      setScanStatus('Preparing application icons...');
    };

    const handleListStderr = (data: string) => {
      const cleanLine = stripAnsi(data).trim();
      if (cleanLine) setScanStatus(cleanLine);
    };

    // Dry-run listeners
    const handleDryRunStdout = (data: string) => {
      console.log('[DryRun stdout]:', data);
      setDryRunOutput(prev => [...prev, data]);
      if (dryRunListRef.current) {
        dryRunListRef.current.scrollTop = dryRunListRef.current.scrollHeight;
      }
    };

    const handleDryRunStderr = (data: string) => {
      console.log('[DryRun stderr]:', data);
      setDryRunOutput(prev => [...prev, data]);
    };

    // Execute listeners
    const handleExecuteStdout = (data: string) => {
      console.log('[Execute stdout]:', data);
      setExecuteOutput(prev => [...prev, data]);
      if (executeListRef.current) {
        executeListRef.current.scrollTop = executeListRef.current.scrollHeight;
      }
    };

    const handleExecuteStderr = (data: string) => {
      console.log('[Execute stderr]:', data);
      setExecuteOutput(prev => [...prev, data]);
    };

    window.moleDesktop.uninstall.onListStdout(handleListStdout);
    window.moleDesktop.uninstall.onListStderr(handleListStderr);
    window.moleDesktop.uninstall.onDryRunStdout(handleDryRunStdout);
    window.moleDesktop.uninstall.onDryRunStderr(handleDryRunStderr);
    window.moleDesktop.uninstall.onExecuteStdout(handleExecuteStdout);
    window.moleDesktop.uninstall.onExecuteStderr(handleExecuteStderr);

    return () => {
      window.moleDesktop.uninstall.removeListeners();
    };
  }, []);

  useEffect(() => {
    if (!['selection', 'confirmation'].includes(stage) || apps.length === 0) return;

    const appsWithoutIcons = apps.filter(app => app.path && !appIcons[app.path] && !requestedIconsRef.current.has(app.path));
    if (appsWithoutIcons.length === 0) return;

    appsWithoutIcons.forEach(app => requestedIconsRef.current.add(app.path));

    iconLoadRunRef.current += 1;
    loadAppIcons(appsWithoutIcons, iconLoadRunRef.current);
  }, [stage, apps, appIcons]);

  const refreshApps = async ({ showCached }: { showCached: boolean }) => {
    scanCancelledRef.current = false;
    iconLoadRunRef.current += 1;

    if (showCached && apps.length > 0) {
      setStage('selection');
      setIsRefreshingApps(true);
      setScanStatus('Refreshing applications in the background...');
    } else {
      setAppIcons({});
      setStage('loading');
      setScanStatus('Scanning applications...');
    }

    try {
      const moleDesktop = (window as any).moleDesktop;
      const result = await moleDesktop.uninstall.list();

      if (scanCancelledRef.current || result.killed) {
        if (!showCached) setStage('idle');
        setScanStatus('');
        return;
      }

      if (!result.ok) {
        if (!showCached) {
          setError({
            title: 'Failed to scan applications',
            message: result.stderr || 'Unknown error occurred'
          });
          setStage('error');
        }
        return;
      }

      // Parse JSON output
      try {
        const jsonOutput = result.stdout.trim();
        const parsedApps = JSON.parse(jsonOutput);

        if (!Array.isArray(parsedApps)) {
          setError({
            title: 'Invalid response format',
            message: 'Expected array of applications'
          });
          setStage('error');
          return;
        }

        requestedIconsRef.current.clear();
        setApps(parsedApps.map(stripPersistedIcon));
        setStage('selection');
        setScanStatus('');
      } catch (e: any) {
        if (!showCached) {
          setError({
            title: 'Failed to parse application list',
            message: `${e.message}\n\nOutput: ${result.stdout.substring(0, 200)}`
          });
          setStage('error');
        }
      }
    } catch (error: any) {
      if (!showCached) {
        setError({
          title: 'Scan failed',
          message: error.message
        });
        setStage('error');
      }
    } finally {
      setIsRefreshingApps(false);
    }
  };

  const startScan = async () => {
    if (!requireSubscription('Uninstall')) return;
    setSelectedAppIndexes([]);
    setDryRunOutput([]);
    setExecuteOutput([]);
    setError(null);
    setResult(null);
    setAnalysisProgress(0);
    await refreshApps({ showCached: apps.length > 0 });
  };

  const cancelScan = async () => {
    scanCancelledRef.current = true;
    iconLoadRunRef.current += 1;
    setScanStatus('Cancelling scan...');
    setStage('idle');
    setScanStatus('');
    try {
      await (window as any).moleDesktop.uninstall.killList();
    } catch (error) {
      console.error('[UninstallPage] Failed to cancel scan:', error);
    }
  };

  const loadAppIcons = async (appsToLoad: App[], runId: number) => {
    if (!window.moleDesktop) return;

    try {
      const result = await window.moleDesktop.uninstall.getAppIcons(appsToLoad.map(app => ({
        path: app.path,
        name: app.name,
        bundle_id: app.bundle_id,
        uninstall_name: app.uninstall_name,
        source: app.source,
      })));
      if (iconLoadRunRef.current !== runId || !result.ok) return;

      setAppIcons(currentIcons => ({ ...currentIcons, ...result.icons }));
    } catch {
      if (iconLoadRunRef.current !== runId) return;

      const icons = await Promise.all(appsToLoad.map(async app => {
        try {
          const result = await window.moleDesktop.uninstall.getAppIcon(app.path);
          return result.ok && result.icon ? { path: app.path, icon: result.icon } : null;
        } catch {
          return null;
        }
      }));

      if (iconLoadRunRef.current !== runId) return;

      setAppIcons(currentIcons => {
        const nextIcons = { ...currentIcons };
        icons.forEach(icon => {
          if (icon) nextIcons[icon.path] = icon.icon;
        });
        return nextIcons;
      });
    }
  };

  const toggleApp = (index: number) => {
    setSelectedAppIndexes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return Array.from(newSet);
    });
  };

  const selectAll = () => {
    setSelectedAppIndexes(apps.map((_, i) => i));
  };

  const deselectAll = () => {
    setSelectedAppIndexes([]);
  };

  const proceedToConfirmation = async () => {
    if (selectedApps.size === 0) return;

    setStage('confirmation');
    setDryRunOutput([]);
    setAnalysisProgress(0);

    const selectedAppNames = Array.from(selectedApps).map(i => apps[i].uninstall_name);

    console.log('[UninstallPage] Starting dry-run for:', selectedAppNames);

    // Simulate progress based on output updates
    const progressInterval = setInterval(() => {
      setAnalysisProgress(prev => {
        if (prev >= 90) return prev; // Cap at 90% until complete
        return prev + Math.random() * 15;
      });
    }, 300);

    try {
      const moleDesktop = (window as any).moleDesktop;
      const result = await moleDesktop.uninstall.dryRun(selectedAppNames);

      console.log('[UninstallPage] Dry-run result:', result);

      clearInterval(progressInterval);
      setAnalysisProgress(100);

      if (!result.ok) {
        console.error('[UninstallPage] Dry-run failed:', result.stderr);
        setError({
          title: 'Failed to analyze files',
          message: result.stderr || 'Unknown error occurred'
        });
        setStage('error');
      }
    } catch (error: any) {
      console.error('[UninstallPage] Dry-run error:', error);
      clearInterval(progressInterval);
      setError({
        title: 'Analysis failed',
        message: error.message
      });
      setStage('error');
    }
  };

  const executeUninstall = async () => {
    if (!requireSubscription('Uninstall')) return;
    setShowFinalConfirmation(false);
    setStage('executing');
    setExecuteOutput([]);
    setResult(null);

    const selectedAppNames = Array.from(selectedApps).map(i => apps[i].uninstall_name);

    try {
      const moleDesktop = (window as any).moleDesktop;
      const result = await moleDesktop.uninstall.execute(selectedAppNames);

      setResult(result);
      setStage('results');
    } catch (error: any) {
      setError({
        title: 'Uninstall failed',
        message: error.message
      });
      setStage('error');
    }
  };

  const requestExecuteUninstall = () => {
    if (skipFinalConfirmation) {
      executeUninstall();
      return;
    }

    setDontShowFinalConfirmationAgain(false);
    setShowFinalConfirmation(true);
  };

  const confirmExecuteUninstall = () => {
    if (dontShowFinalConfirmationAgain) {
      setSkipFinalConfirmation(true);
    }

    executeUninstall();
  };

  const cancelConfirmation = () => {
    setStage('selection');
    setDryRunOutput([]);
    setAnalysisProgress(0);
  };

  const reset = () => {
    iconLoadRunRef.current += 1;
    setStage('idle');
    setSelectedAppIndexes([]);
    setScanStatus('');
    setDryRunOutput([]);
    setExecuteOutput([]);
    setError(null);
    setResult(null);
    setShowAllApps(false);
    setShowFinalConfirmation(false);
    setDontShowFinalConfirmationAgain(false);
    setAnalysisProgress(0);
    setSearchQuery('');
    setSortBy('size');
    requestedIconsRef.current.clear();
  };

  // Parse size string to bytes for sorting
  const parseSizeToBytes = (sizeStr: string): number => {
    return parseAppSizeToBytes(sizeStr);
  };

  // Filter and sort apps
  const getFilteredAndSortedApps = () => {
    let filtered = apps;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = apps.filter(app =>
        app.name.toLowerCase().includes(query) ||
        app.path.toLowerCase().includes(query) ||
        app.source.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    const sorted = [...filtered];
    if (sortBy === 'size') {
      sorted.sort((a, b) => parseSizeToBytes(b.size) - parseSizeToBytes(a.size));
    } else {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    }

    return sorted;
  };

  const sortAppIndexesBySize = (indexes: number[]) => {
    return [...indexes].sort((a, b) => parseSizeToBytes(apps[b]?.size || '') - parseSizeToBytes(apps[a]?.size || ''));
  };

  const getAppByName = (name: string) => {
    return apps.find(app => app.name === name || app.uninstall_name === name);
  };

  const stripAnsi = (text: string) => {
    return text.replace(/\x1B\[[0-9;]*[A-Za-z]/g, '').replace(/\x1B\[K/g, '');
  };

  const sanitizeCliSummary = (text: string) => {
    return stripAnsi(text).replace(/\s*=+\s*$/g, '').trim();
  };

  const getCommandOutputLines = (text?: string) => {
    return text ? text.split(/\r?\n/).filter(line => line.trim()) : [];
  };

  const getStreamOutputLines = (output: string[]) => {
    return output.flatMap(chunk => chunk.split(/\r?\n/)).filter(line => line.trim());
  };

  // Parse dry-run output into structured data
  const parseDryRunOutput = (output: string[]) => {
    const apps: Array<{ name: string; size: string; files: Array<{ path: string; isSystem: boolean }> }> = [];
    let currentApp: { name: string; size: string; files: Array<{ path: string; isSystem: boolean }> } | null = null;
    let summary = '';

    getStreamOutputLines(output).forEach(line => {
      const cleanLine = stripAnsi(line).trim();
      if (!cleanLine) return;

      // Skip dry-run mode message
      if (cleanLine.includes('DRY RUN MODE') || cleanLine.includes('No app files or settings will be modified')) {
        return;
      }

      // Skip headers
      if (cleanLine === 'Files to be removed:') {
        return;
      }

      // App header: "◎ AppName , 303KB" or "✓ AppName, 512 MB"
      const appMatch = cleanLine.match(/^[✓✔☑◎]\s+(.+?)\s*,\s*(.+)$/);
      if (appMatch) {
        if (currentApp) apps.push(currentApp);
        currentApp = { name: appMatch[1].trim(), size: appMatch[2].trim(), files: [] };
        return;
      }

      // File path: "  ✓ /path/to/file"
      const fileMatch = cleanLine.match(/^[✓✔☑]\s+(.+)$/);
      if (fileMatch && currentApp) {
        currentApp.files.push({ path: fileMatch[1], isSystem: false });
        return;
      }

      // System file: "  ⚠ System: /path/to/file"
      const systemMatch = cleanLine.match(/^[⚠!]\s+System:\s+(.+)$/);
      if (systemMatch && currentApp) {
        currentApp.files.push({ path: systemMatch[1], isSystem: true });
        return;
      }

      // Summary: "→ DRY RUN - Would remove 1 app, 303KB"
      if (cleanLine.includes('Would remove') && !cleanLine.includes('DRY RUN MODE')) {
        summary = cleanLine.replace(/^[→\-]\s*(DRY RUN\s*[-–]\s*)?/i, '').trim();
      }
    });

    if (currentApp) apps.push(currentApp);
    apps.sort((a, b) => parseSizeToBytes(b.size) - parseSizeToBytes(a.size));
    return { apps, summary };
  };

  // Parse execute output into structured data
  const parseExecuteOutput = (output: string[]) => {
    const apps: Array<{ name: string; progress: string; files: string[]; completed: boolean }> = [];
    let currentApp: { name: string; progress: string; files: string[]; completed: boolean } | null = null;
    let summary = '';
    let currentProgress = { current: 0, total: 0 };

    getStreamOutputLines(output).forEach(line => {
      const cleanLine = stripAnsi(line).trim();
      if (!cleanLine) return;

      // Skip dry-run mode message and auto-confirm message
      if (cleanLine.includes('DRY RUN MODE') ||
        cleanLine.includes('No app files or settings will be modified') ||
        cleanLine.includes('Auto-confirming uninstallation')) {
        return;
      }

      // Progress: "[1/3] Uninstalling AppName..."
      const progressMatch = cleanLine.match(/^\[(\d+)\/(\d+)\]\s+Uninstalling\s+(.+?)(?:\[Brew\])?\.\.\./);
      if (progressMatch) {
        if (currentApp) apps.push(currentApp);
        currentProgress = { current: parseInt(progressMatch[1]), total: parseInt(progressMatch[2]) };
        currentApp = {
          name: progressMatch[3].trim(),
          progress: `${progressMatch[1]}/${progressMatch[2]}`,
          files: [],
          completed: false
        };
        return;
      }

      // File removed: "  ✓ /path/to/file"
      const fileMatch = cleanLine.match(/^[✓✔☑]\s+(\/.*|~\/.*)$/);
      if (fileMatch && currentApp) {
        currentApp.files.push(fileMatch[1]);
        return;
      }

      // Completed app: "✓ [1/3] AppName"
      const completedMatch = cleanLine.match(/^[✓✔☑]\s+(?:\[(\d+)\/(\d+)\]\s+)?(.+)$/);
      if (completedMatch) {
        const appName = completedMatch[3].trim();
        if (appName.startsWith('/') || appName.startsWith('~/')) return;

        if (currentApp && currentApp.name === appName) {
          currentApp.completed = true;
        } else if (!currentApp) {
          // App completed without seeing progress line
          currentApp = { name: appName, progress: '', files: [], completed: true };
        }
        return;
      }

      // Summary: "Removed X apps, freed Y MB"
      if (cleanLine.match(/Removed\s+\d+\s+apps?/i)) {
        summary = sanitizeCliSummary(cleanLine);
      }
    });

    if (currentApp) apps.push(currentApp);
    return { apps, summary, progress: currentProgress };
  };

  // Render stages
  const viewKey = stage === 'idle' ? 'start' : 'working';

  const renderStage = () => {
  if (stage === 'idle') {
    const config: PageConfig = {
      title: 'Uninstall',
      description: 'Completely remove applications and all their associated files from your system.',
      icon: 'PackageX',
      buttonText: 'Scan Applications',
      items: [
        {
          icon: 'Search',
          title: 'Deep Scan',
          description: 'Find all app-related files and folders',
        },
        {
          icon: 'Trash2',
          title: 'Complete Removal',
          description: 'Delete apps with all preferences and caches',
        },
        {
          icon: 'Shield',
          title: 'Safe Uninstall',
          description: 'Protected system files remain untouched',
        },
      ],
    };

    return <StartScreen config={config} onStart={startScan} variant="uninstall" />;
  }

  if (stage === 'loading') {
    return (
      <div className="relative h-full min-h-0 overflow-hidden bg-[#fbf9ff] px-[clamp(1.25rem,3vw,4rem)] pb-[clamp(0.85rem,1.65vw,1.75rem)] pt-[clamp(1.25rem,2.4vw,2.5rem)] text-slate-950" style={uninstallAccentStyle}>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_26%_14%,rgba(var(--page-accent-rgb),0.08),transparent_28%),radial-gradient(circle_at_80%_12%,rgba(109,93,252,0.08),transparent_28%),linear-gradient(135deg,rgba(255,255,255,0.78),rgba(247,243,255,0.58))]" />

        <div className="relative flex h-full min-h-0 items-center justify-center text-center">
          <main className="flex w-full max-w-[42rem] flex-col items-center">
            <div className="relative flex h-[clamp(5rem,8vw,6.5rem)] w-[clamp(5rem,8vw,6.5rem)] items-center justify-center rounded-full bg-white/78 text-[var(--page-accent)] shadow-[0_24px_76px_rgba(83,76,148,0.14),0_0_0_10px_rgba(var(--page-accent-rgb),0.08)] backdrop-blur-2xl">
              <span className="absolute inset-[-0.38rem] rounded-full border-2 border-[rgba(var(--page-accent-rgb),0.18)] border-r-[var(--page-accent)] border-t-[var(--page-accent-hover)] animate-spin" aria-hidden="true" />
              <Package className="relative h-[42%] w-[42%]" strokeWidth={2.6} />
            </div>

            <h1 className="mt-7 text-[clamp(2.6rem,5.8vw,5.6rem)] font-black leading-[0.9] tracking-[-0.06em] text-slate-950">
              Listing apps.
            </h1>
            <p className="mt-5 max-w-[34rem] text-[clamp(1.05rem,1.55vw,1.35rem)] font-semibold leading-relaxed text-slate-500">
              Mole is reading installed applications before you choose what to remove.
            </p>

            {scanStatus && (
              <div className="mt-7 inline-flex max-w-full items-center gap-3 rounded-full bg-white/70 px-4 py-2 text-sm font-black text-slate-500 shadow-[0_10px_30px_rgba(83,76,148,0.08)]">
                <Folder className="h-4 w-4 shrink-0 text-[var(--page-accent)]" />
                <span className="truncate">{scanStatus}</span>
              </div>
            )}

            <div className="mt-8">
              <Button variant="secondary" icon={X} onClick={cancelScan} size="lg" className="min-w-[min(260px,42vw)] rounded-full border border-white/70 bg-white/70 px-[clamp(2rem,3vw,2.5rem)] py-[clamp(0.85rem,1.25vw,1rem)] text-[clamp(0.95rem,1.25vw,1.25rem)] text-slate-600 shadow-[0_10px_30px_rgba(83,76,148,0.08)] hover:bg-white [&_svg]:h-[clamp(1rem,1.35vw,1.25rem)] [&_svg]:w-[clamp(1rem,1.35vw,1.25rem)]">
                Cancel
              </Button>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (stage === 'selection') {
    const filteredApps = getFilteredAndSortedApps();
    const filteredIndices = filteredApps.map(app => apps.indexOf(app));
    const RefreshIcon = isRefreshingApps ? Loader : RefreshCw;

    return (
      <div className={UNINSTALL_SHELL} style={uninstallAccentStyle}>
        <div className={UNINSTALL_ACCENT_BG} />
        <div className="relative flex h-full min-h-0 flex-col gap-2">
          <div className="px-4 pb-4 pt-3">
            <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <h2 className="max-w-xl text-3xl font-black tracking-[-0.045em] text-slate-950 mb-1">
                  Select Applications to Uninstall
                </h2>
                <div className="flex items-center gap-3">
                  <p className="text-sm font-semibold text-slate-500">
                    {selectedApps.size} of {apps.length} selected
                  </p>
                  {apps.length > 0 && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={selectAll}
                        className="text-xs font-bold text-[var(--page-accent)] hover:text-[var(--page-accent-hover)] transition-colors"
                      >
                        Select All
                      </button>
                      <span className="text-slate-300 text-xs">|</span>
                      <button
                        type="button"
                        onClick={deselectAll}
                        className="text-xs font-bold text-slate-500 hover:text-slate-600 transition-colors"
                      >
                        Deselect All
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-start gap-2 lg:justify-end">
                <Button
                  variant="secondary"
                  icon={ArrowLeft}
                  onClick={reset}
                  className="rounded-full border border-white/70 bg-white/70 px-[clamp(1rem,1.45vw,1.25rem)] py-[clamp(0.65rem,0.95vw,0.75rem)] text-[clamp(0.88rem,1.1vw,1rem)] text-slate-600 shadow-[0_10px_30px_rgba(83,76,148,0.08)] hover:bg-white [&_svg]:h-[clamp(1rem,1.25vw,1.25rem)] [&_svg]:w-[clamp(1rem,1.25vw,1.25rem)]"
                >
                  Back
                </Button>
                <Button
                  variant="secondary"
                  icon={RefreshIcon}
                  onClick={startScan}
                  disabled={isRefreshingApps}
                  aria-label={isRefreshingApps ? 'Refreshing applications' : 'Scan again'}
                  title={isRefreshingApps ? 'Refreshing applications' : 'Scan again'}
                  className={`rounded-full border border-white/70 bg-white/70 px-[clamp(1rem,1.45vw,1.25rem)] py-[clamp(0.65rem,0.95vw,0.75rem)] text-[clamp(0.88rem,1.1vw,1rem)] text-[var(--page-accent)] shadow-[0_10px_30px_rgba(83,76,148,0.08)] hover:bg-white [&_svg]:h-[clamp(1rem,1.25vw,1.25rem)] [&_svg]:w-[clamp(1rem,1.25vw,1.25rem)] ${isRefreshingApps ? '[&_svg]:animate-spin' : ''}`}
                >
                  Refresh
                </Button>
              </div>
            </div>

            {/* Search and Sort Controls */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search applications..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`w-full py-3 pl-11 pr-10 ${PILL_INPUT}`}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-900 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className={`flex items-center gap-2 px-4 py-3 ${MUTED_PILL}`}>
                <ArrowUpDown className="w-4 h-4 text-slate-400" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'name' | 'size')}
                  className="bg-transparent text-sm font-semibold text-slate-700 focus:outline-none cursor-pointer"
                >
                  <option value="size">Sort by Size</option>
                  <option value="name">Sort by Name</option>
                </select>
              </div>
            </div>

            {searchQuery && (
              <p className="text-sm font-medium text-slate-500 mt-3">
                Found {filteredApps.length} application{filteredApps.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>

          <div className="relative flex-1 min-h-0 overflow-hidden px-2 pb-2">
            <div className="grid h-full min-h-0 grid-cols-1 gap-3 grid-cols-[minmax(20rem,1.05fr)_minmax(20rem,0.95fr)]">
              <div className="flex min-h-0 flex-col gap-3">
                <div className="min-h-0 flex-1 overflow-hidden rounded-[1.75rem]">
                  <SelectedAppBubbleCluster
                    apps={apps}
                    appIcons={appIcons}
                    selectedAppIndexes={selectedAppIndexes}
                    onToggle={toggleApp}
                  />
                </div>
                <Button
                  onClick={proceedToConfirmation}
                  disabled={selectedApps.size === 0}
                  icon={Trash2}
                  className="mx-auto min-w-[min(370px,80%)] justify-center gap-3 rounded-full bg-[var(--page-accent)] px-[clamp(2rem,3vw,2.5rem)] py-[clamp(0.85rem,1.25vw,1rem)] text-[clamp(0.95rem,1.25vw,1.25rem)] font-black shadow-[0_18px_50px_var(--page-accent-glow)] hover:bg-[var(--page-accent-hover)] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-white/80 disabled:shadow-none [&_svg]:h-[clamp(1rem,1.35vw,1.25rem)] [&_svg]:w-[clamp(1rem,1.35vw,1.25rem)]"
                >
                  Uninstall Apps
                  <span className="rounded-full bg-white/20 px-2.5 py-1 text-xs font-black">
                    {selectedApps.size}
                  </span>
                </Button>
              </div>

              <div className="relative min-h-0 overflow-hidden rounded-[1.75rem] p-2">
                <div
                  ref={appListRef}
                  onScroll={(event) => {
                    const nextShadows = getScrollShadows(event.currentTarget);
                    setAppListShadows(previousShadows => previousShadows.top === nextShadows.top && previousShadows.bottom === nextShadows.bottom ? previousShadows : nextShadows);
                  }}
                  className="h-full overflow-hidden overflow-y-auto rounded-[1rem] p-3 custom-scrollbar"
                >
                  {filteredApps.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                      <div className="p-4 rounded-full border border-white/60 bg-white/35 shadow-inner shadow-white/30 mb-4 backdrop-blur-xl">
                        <Search className="w-8 h-8 text-slate-400" />
                      </div>
                      <h3 className="text-lg font-bold text-slate-950 mb-1">
                        No applications found
                      </h3>
                      <p className="text-sm font-medium text-slate-600">
                        Try adjusting your search query
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredApps.map((app, displayIndex) => {
                        const originalIndex = filteredIndices[displayIndex];
                        const isSelected = selectedApps.has(originalIndex);
                        return (
                          <Card
                            key={originalIndex}
                            role="button"
                            tabIndex={0}
                            aria-pressed={isSelected}
                            aria-label={`${isSelected ? 'Deselect' : 'Select'} ${app.name}`}
                            className={`${APP_SELECTION_CARD} shadow-sm cursor-pointer transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--page-accent-rgb),0.45)] ${isSelected ? 'ring-2 ring-[var(--page-accent)] bg-white/55' : ''
                              }`}
                            onClick={() => toggleApp(originalIndex)}
                            onKeyDown={(event) => {
                              if (event.key !== 'Enter' && event.key !== ' ') return;
                              event.preventDefault();
                              toggleApp(originalIndex);
                            }}
                          >
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleApp(originalIndex)}
                                className="sr-only"
                                onClick={(e) => e.stopPropagation()}
                              />
                              <AppIcon icon={appIcons[app.path]} size="sm" />
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-bold text-slate-950">{app.name}</div>
                                <div className="truncate text-xs font-medium text-slate-500">{app.path}</div>
                              </div>
                              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${app.source === 'Homebrew'
                                  ? 'bg-red-500/10 text-red-500'
                                  : 'bg-white/45 text-slate-600'
                                }`}>
                                {app.source}
                              </span>
                              <span className="min-w-[4rem] shrink-0 text-right text-xs font-bold text-slate-600">
                                {app.size}
                              </span>
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="pointer-events-none absolute inset-2 overflow-hidden rounded-[1.5rem]">
                  <div className={`absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-slate-950/12 to-transparent transition-opacity duration-200 ${appListShadows.top ? 'opacity-100' : 'opacity-0'}`} />
                  <div className={`absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-slate-950/14 to-transparent transition-opacity duration-200 ${appListShadows.bottom ? 'opacity-100' : 'opacity-0'}`} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (stage === 'confirmation') {
    const parsedDryRun = parseDryRunOutput(dryRunOutput);
    const isAnalyzing = dryRunOutput.length === 0 || !parsedDryRun.summary;

    const selectedAppsArray = sortAppIndexesBySize(Array.from(selectedApps));
    const hasMoreApps = selectedAppsArray.length > 3;
    const displayedApps = showAllApps ? selectedAppsArray : selectedAppsArray.slice(0, 3);

    return (
      <div className={UNINSTALL_SHELL} style={uninstallAccentStyle}>
        <div className={UNINSTALL_ACCENT_BG} />
        <div className="relative flex h-full min-h-0 flex-col gap-2">
          <div className="px-4 pb-4 pt-3">
            <div className="flex items-start gap-4 mb-4">
              <div className="p-3 rounded-2xl bg-amber-100/40">
                <AlertTriangle className="w-6 h-6 text-amber-500" />
              </div>
              <div className="flex-1">
                <h2 className="text-3xl font-black tracking-[-0.045em] text-slate-950 mb-1">
                  Confirm Uninstallation
                </h2>
                <p className="font-medium text-slate-600 mb-4">
                  The following applications and their associated files will be removed:
                </p>

                {/* Tags list for selected apps */}
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {displayedApps.map(index => {
                      const app = apps[index];
                      return (
                        <div
                          key={index}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-full border border-white/60 bg-white/40 shadow-inner shadow-white/30 backdrop-blur-xl transition-all hover:bg-white/55"
                        >
                          <AppIcon icon={appIcons[app.path]} size="sm" />
                          <span className="font-semibold text-slate-950 text-sm">{app.name}</span>
                          <span className="text-xs text-slate-400">•</span>
                          <span className="text-xs font-medium text-slate-500">{app.size}</span>
                          {app.source === 'Homebrew' && (
                            <>
                              <span className="text-xs text-slate-400">•</span>
                              <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 font-semibold">
                                Brew
                              </span>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {hasMoreApps && (
                    <button
                      onClick={() => setShowAllApps(!showAllApps)}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-full text-sm font-semibold text-[var(--page-accent)] hover:bg-[rgba(var(--page-accent-rgb),0.10)] transition-colors"
                    >
                      {showAllApps ? (
                        <>
                          Show less
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        </>
                      ) : (
                        <>
                          Show {selectedAppsArray.length - 3} more
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 rounded-[1.75rem] p-2 overflow-y-hidden">
            <div className="mb-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-slate-950">
                  {isAnalyzing ? 'Analyzing files...' : 'Files to be removed'}
                </h3>
                {isAnalyzing && (
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
                    <Loader className="w-4 h-4 animate-spin" />
                    <span>Scanning...</span>
                  </div>
                )}
              </div>

              {isAnalyzing && (
                <div className="space-y-2">
                  <div className="h-2 bg-white/45 rounded-full overflow-hidden shadow-inner shadow-white/40">
                    <div
                      className="h-full bg-gradient-to-r from-[rgba(var(--page-accent-rgb),0.70)] to-[var(--page-accent)] transition-all duration-300 ease-out"
                      style={{ width: `${analysisProgress}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                    <span>Scanning application files and dependencies...</span>
                    <span>{Math.round(analysisProgress)}%</span>
                  </div>
                </div>
              )}
              {parsedDryRun.summary && (
                <Card className={`${LIST_CARD} border-rose-200/60`}>
                  <div className="flex items-center gap-3">
                    <Info className="w-5 h-5 text-[var(--page-accent)]" />
                    <span className="text-sm font-medium text-slate-600">{parsedDryRun.summary}</span>
                  </div>
                </Card>
              )}
            </div>

            <div ref={dryRunListRef} className="space-y-4 max-h-full overflow-auto pb-[15rem]">
              {parsedDryRun.apps.map((app, appIndex) => {
                const selectedApp = getAppByName(app.name);
                return (
                  <Card key={appIndex} className={LIST_CARD}>
                    <div className="flex items-center gap-3 mb-3">
                      <AppIcon icon={selectedApp ? appIcons[selectedApp.path] : undefined} />
                      <div className="flex-1">
                        <div className="font-bold text-slate-950">{app.name}</div>
                        <div className="text-sm font-medium text-slate-500">{app.size}</div>
                      </div>
                      <CheckCircle className="w-5 h-5 text-accent-success" />
                    </div>

                    {app.files.length > 0 && (
                      <div className="space-y-1 ml-11">
                        {app.files.slice(0, 5).map((file, fileIndex) => (
                          <div
                            key={fileIndex}
                            className={`text-sm flex items-center gap-2 ${file.isSystem ? 'text-amber-500' : 'text-slate-500'
                              }`}
                          >
                            {file.isSystem ? (
                              <>
                                <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                                <span className="font-mono text-xs truncate">{file.path}</span>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 font-semibold">System</span>
                              </>
                            ) : (
                              <>
                                <Check className="w-3 h-3 flex-shrink-0" />
                                <span className="font-mono text-xs truncate">
                                  {file.path.replace(/^\/Users\/[^\/]+/, '~')}
                                </span>
                              </>
                            )}
                          </div>
                        ))}
                        {app.files.length > 5 && (
                          <div className="text-xs font-medium text-slate-500 ml-5">
                            + {app.files.length - 5} more files
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                );
              })}


            </div>
          </div>

          <div className="flex items-center justify-between px-4 py-4">
            <Button variant="ghost" onClick={cancelConfirmation} className="gap-2 rounded-full px-4 text-slate-500 hover:bg-red-500/10 hover:text-red-500">
              <X className="w-4 h-4" />
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={requestExecuteUninstall}
              disabled={isAnalyzing}
              className="gap-2 rounded-full bg-[var(--page-accent)] shadow-[0_18px_40px_var(--page-accent-glow)] hover:bg-[var(--page-accent-hover)]"
            >
              <Trash2 className="w-4 h-4" />
              Uninstall {selectedApps.size} App{selectedApps.size > 1 ? 's' : ''}
            </Button>
          </div>

          {showFinalConfirmation && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
              <Card className="w-full max-w-lg rounded-[2rem] border border-white/60 bg-white/90 p-6 shadow-[0_36px_120px_rgba(15,23,42,0.32),0_16px_48px_rgba(244,63,94,0.18),inset_0_1px_1px_rgba(255,255,255,0.85)]">
                <div className="flex items-start gap-4">
                  <div className="rounded-2xl border border-rose-200/70 bg-rose-100/40 p-3 shadow-[0_14px_32px_rgba(244,63,94,0.16)]">
                    <AlertTriangle className="h-6 w-6 text-[var(--page-accent)]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-2xl font-black tracking-[-0.04em] text-slate-950">
                      Are you sure?
                    </h3>
                    <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
                      Do you really want to do this? This action is irreversible and the selected applications and related files will be removed.
                    </p>
                  </div>
                </div>

                <label className="mt-6 flex cursor-pointer items-center gap-3 rounded-2xl border border-white/60 bg-white/45 px-4 py-3 shadow-inner shadow-white/30">
                  <input
                    type="checkbox"
                    checked={dontShowFinalConfirmationAgain}
                    onChange={(event) => setDontShowFinalConfirmationAgain(event.target.checked)}
                    className="sr-only"
                  />
                  <span className={`flex h-5 w-5 items-center justify-center rounded-md border transition-colors ${dontShowFinalConfirmationAgain
                      ? 'border-[var(--page-accent)] bg-[var(--page-accent)] text-white'
                      : 'border-slate-300 bg-white/70 text-transparent'
                    }`}>
                    <Check className="h-3.5 w-3.5" />
                  </span>
                  <span className="text-sm font-semibold text-slate-700">Don't show again</span>
                </label>

                <div className="mt-6 flex items-center justify-end gap-3">
                  <Button
                    variant="ghost"
                    onClick={() => setShowFinalConfirmation(false)}
                    className="rounded-full px-4 text-slate-500 hover:bg-red-500/10 hover:text-red-500"
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="danger"
                    onClick={confirmExecuteUninstall}
                    className="rounded-full bg-[var(--page-accent)] shadow-[0_18px_40px_var(--page-accent-glow)] hover:bg-[var(--page-accent-hover)]"
                  >
                    Uninstall
                  </Button>
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (stage === 'executing') {
    const parsedExecute = parseExecuteOutput(executeOutput);
    const { apps: executingApps, summary, progress } = parsedExecute;
    const activeApp = [...executingApps].reverse().find(app => !app.completed) || executingApps[executingApps.length - 1];
    const selectedAppNames = sortAppIndexesBySize(selectedAppIndexes)
      .map(index => apps[index]?.name)
      .filter(Boolean);
    const progressTotal = progress.total || selectedAppNames.length;
    const progressCurrent = progress.total
      ? progress.current
      : Math.min(executingApps.filter(app => app.completed).length + (activeApp && !summary ? 1 : 0), progressTotal);
    const progressPercent = progressTotal > 0
      ? Math.min(100, Math.max(4, (progressCurrent / progressTotal) * 100))
      : summary ? 100 : 8;

    return (
      <div className={UNINSTALL_SHELL} style={uninstallAccentStyle}>
        <div className={UNINSTALL_ACCENT_BG} />
        <div className="relative flex h-full min-h-0 flex-col gap-2">
          <div className="px-4 pb-4 pt-3">
            <h2 className="text-3xl font-black tracking-[-0.045em] text-slate-950 mb-1">
              Uninstalling Applications
            </h2>
            <p className="font-medium text-slate-600 mb-4">
              Removing selected applications and their files...
            </p>

            {progressTotal > 0 && (
              <div className="mb-4">
                <div className="flex items-center justify-between text-sm font-medium text-slate-600 mb-2">
                  <span>Progress</span>
                  <span>{progressCurrent} of {progressTotal}</span>
                </div>
                <div
                  className="h-2 bg-white/45 rounded-full overflow-hidden shadow-inner shadow-white/40"
                  role="progressbar"
                  aria-valuenow={Math.round(progressPercent)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Uninstall progress"
                >
                  <div
                    className="h-full bg-gradient-to-r from-[rgba(var(--page-accent-rgb),0.70)] to-[var(--page-accent)] transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 py-2">
              <Info className="w-5 h-5 text-amber-500" />
              <span className="text-sm font-medium text-slate-600">
                Do not close this window until the process completes
              </span>
            </div>
          </div>

          <div className="flex-1 rounded-[1.75rem] p-2 overflow-y-auto">
            <div ref={executeListRef} className="space-y-4">
              <div className="flex justify-center py-6">
                <AppRemovalAnimation progressPercent={progressPercent} />
              </div>

              {executingApps.map((app, appIndex) => (
                <Card key={appIndex} className={`${LIST_CARD} ${app.completed ? 'border-emerald-300/50' : ''}`}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`p-2 rounded-2xl border backdrop-blur-xl ${app.completed ? 'border-emerald-200/70 bg-emerald-100/35' : 'border-rose-200/70 bg-rose-100/35'
                      }`}>
                      {app.completed ? (
                        <CheckCircle className="w-5 h-5 text-emerald-500" />
                      ) : (
                        <Loader className="w-5 h-5 text-[var(--page-accent)] animate-spin" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="font-bold text-slate-950">{app.name}</div>
                      <div className="text-sm font-medium text-slate-500">
                        {app.completed ? 'Completed' : 'Removing files...'}
                        {app.progress && ` (${app.progress})`}
                      </div>
                    </div>
                  </div>

                  {app.files.length > 0 && (
                    <div className="space-y-1 ml-11">
                      {app.files.slice(-5).map((file, fileIndex) => (
                        <div key={fileIndex} className="text-sm flex items-center gap-2 text-slate-500">
                          <Check className="w-3 h-3 flex-shrink-0 text-emerald-500" />
                          <span className="font-mono text-xs truncate">
                            {file.replace(/^\/Users\/[^\/]+/, '~')}
                          </span>
                        </div>
                      ))}
                      {app.files.length > 5 && (
                        <div className="text-xs font-medium text-slate-500 ml-5">
                          {app.files.length} files removed
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              ))}

              {summary && (
                <div className="flex items-center gap-3 px-4 py-3">
                  <CheckCircle className="w-5 h-5 text-emerald-500" />
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="font-bold text-slate-950 mb-1">Uninstall Complete</div>
                      <div className="text-sm font-medium text-slate-600">{sanitizeCliSummary(summary)}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (stage === 'results') {
    const resultOutput = result ? (result.stdout || result.stderr) : '';
    const parsedResult = parseExecuteOutput(getCommandOutputLines(resultOutput));
    const resultSummary = result?.ok
      ? 'Selected applications have been successfully removed.'
      : sanitizeCliSummary(resultOutput) || 'An error occurred during uninstallation';

    return (
      <div className={UNINSTALL_SHELL} style={uninstallAccentStyle}>
        <div className={UNINSTALL_ACCENT_BG} />
        <div className="relative flex h-full items-center justify-center">
          <div className="w-full max-w-2xl p-8 text-center">
            <div className="space-y-6">
              <div className={`inline-flex rounded-full border p-6 shadow-[0_18px_48px_rgba(15,23,42,0.10)] backdrop-blur-xl ${result?.ok ? 'border-emerald-200/70 bg-emerald-100/35' : 'border-red-200/70 bg-red-100/35'
                }`}>
                {result?.ok ? (
                  <CheckCircle className="w-12 h-12 text-emerald-500" />
                ) : (
                  <AlertCircle className="w-12 h-12 text-red-500" />
                )}
              </div>
              <div>
                <h2 className="text-3xl font-black tracking-[-0.045em] text-slate-950 mb-2">
                  {result?.ok ? 'Uninstall Complete' : 'Uninstall Failed'}
                </h2>
                <p className="font-medium text-slate-600">
                  {resultSummary}
                </p>
              </div>
              {result?.ok && parsedResult.apps.length > 0 && (
                <div className="mx-auto max-h-[300px] max-w-xl space-y-2 overflow-auto text-left">
                  {parsedResult.apps.map((app, index) => (
                    <div key={`${app.name}-${index}`} className="flex items-start gap-3 px-2 py-2">
                      <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
                      <div className="min-w-0">
                        <div className="font-bold text-slate-950">{app.name}</div>
                        <div className="text-sm font-medium text-slate-500">
                          {app.files.length > 0 ? `${app.files.length} file${app.files.length === 1 ? '' : 's'} removed` : 'Removed'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {result && !result.ok && (
                <pre className="mx-auto max-h-[300px] max-w-xl overflow-auto whitespace-pre-wrap text-left font-mono text-sm text-slate-600">
                  {resultSummary}
                </pre>
              )}
              <Button onClick={reset} className="gap-2 rounded-full bg-[var(--page-accent)] shadow-[0_18px_40px_var(--page-accent-glow)] hover:bg-[var(--page-accent-hover)]">
                <Check className="w-4 h-4" />
                Done
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (stage === 'error') {
    return (
      <div className={UNINSTALL_SHELL} style={uninstallAccentStyle}>
        <div className={UNINSTALL_ACCENT_BG} />
        <div className="relative flex h-full items-center justify-center">
          <Card className={`w-full max-w-2xl overflow-hidden rounded-[2rem] p-8 text-center ${GLASS_CARD}`}>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(239,68,68,0.18),transparent_42%)]" />
            <div className="relative space-y-6">
              <div className="inline-flex rounded-full border border-red-200/70 bg-red-100/35 p-6 shadow-[0_18px_48px_rgba(239,68,68,0.16)] backdrop-blur-xl">
                <AlertCircle className="w-12 h-12 text-red-500" />
              </div>
              <div>
                <h2 className="text-3xl font-black tracking-[-0.045em] text-slate-950 mb-2">
                  {error?.title || 'Error'}
                </h2>
                <p className="font-medium text-slate-600">
                  {error?.message || 'An unknown error occurred'}
                </p>
              </div>
              <Button onClick={reset} className="rounded-full bg-[var(--page-accent)] shadow-[0_18px_40px_var(--page-accent-glow)] hover:bg-[var(--page-accent-hover)]">
                Try Again
              </Button>
            </div>
          </Card>
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
