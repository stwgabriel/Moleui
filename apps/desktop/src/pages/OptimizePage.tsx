import { useEffect, useRef } from 'react';
import { Zap, Check, X, Clock, CheckCircle2, Loader2, AlertCircle, Gauge, Eye, Play } from 'lucide-react';
import { StartScreen } from '@/components/common/StartScreen';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { stripAnsi } from '@/utils/format';
import { usePersistentState } from '@/utils/persistentState';
import type { PageConfig } from '@/types';

type Stage = 'idle' | 'previewing' | 'preview-results' | 'optimizing' | 'complete' | 'error';

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
  startTime?: number;
  endTime?: number;
}

const config: PageConfig = {
  title: 'Optimize',
  description: "Fine-tune your Mac's performance with system optimization and maintenance tasks.",
  icon: 'Zap',
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

export function OptimizePage() {
  const [stage, setStage] = usePersistentState<Stage>('mole-optimize-stage', 'idle');
  const [logs, setLogs] = usePersistentState<LogEntry[]>('mole-optimize-logs', []);
  const [previewLogs, setPreviewLogs] = usePersistentState<LogEntry[]>('mole-optimize-preview-logs', []);
  const [timeline, setTimeline] = usePersistentState<TimelineStage[]>('mole-optimize-timeline', []);
  const [previewTimeline, setPreviewTimeline] = usePersistentState<TimelineStage[]>('mole-optimize-preview-timeline', []);
  const logEndRef = useRef<HTMLDivElement>(null);
  const previewLogEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

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

  const parseTimelineFromLog = (
    text: string,
    target: 'main' | 'preview' = 'main'
  ) => {
    const cleanText = stripAnsi(text).trim();
    const setter = target === 'preview' ? setPreviewTimeline : setTimeline;

    // Detect section headers (→ or ▸)
    const sectionMatch = cleanText.match(/[→▸]\s+(.+?)$/);
    if (sectionMatch) {
      const sectionName = sectionMatch[1].trim();
      setter((prev) => {
        const updated = prev.map((s) =>
          s.status === 'active' ? { ...s, status: 'complete' as const, endTime: Date.now() } : s
        );
        const existingIndex = updated.findIndex((s) => s.name === sectionName);
        if (existingIndex >= 0) {
          updated[existingIndex] = { ...updated[existingIndex], status: 'active', startTime: Date.now() };
          return updated;
        }
        return [
          ...updated,
          { id: `stage-${Date.now()}`, name: sectionName, status: 'active', items: [], startTime: Date.now() },
        ];
      });
      return;
    }

    // Detect completed / dry-run items
    if (cleanText.includes('✓') || cleanText.includes('✔') || cleanText.includes('🔍')) {
      setter((prev) => {
        const activeIndex = prev.findIndex((s) => s.status === 'active');
        if (activeIndex >= 0) {
          const updated = [...prev];
          updated[activeIndex] = {
            ...updated[activeIndex],
            items: [...updated[activeIndex].items, cleanText],
          };
          return updated;
        }
        return prev;
      });
    }
  };

  const stopProcess = async (context: 'preview' | 'main') => {
    addLog('Stopping...', 'info', context);
    const result = await window.moleDesktop.optimize.kill();
    if (result.ok) {
      addLog(context === 'preview' ? 'Preview cancelled' : 'Optimization stopped by user', 'error', context);
    }
  };

  // ─── Dry-run preview ────────────────────────────────────────────────────────

  const startPreview = async () => {
    setStage('previewing');
    setPreviewLogs([]);
    setPreviewTimeline([]);

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

      if (result.killed) {
        addLog('Preview cancelled', 'error', 'preview');
        setStage('idle');
      } else if (result.ok || result.exitCode === 0) {
        setPreviewTimeline((prev) =>
          prev.map((s) =>
            s.status === 'active' ? { ...s, status: 'complete', endTime: Date.now() } : s
          )
        );
        addLog('Dry-run complete — no changes were made', 'success', 'preview');
        setStage('preview-results');
      } else {
        addLog(`Preview failed: ${result.stderr}`, 'error', 'preview');
        setStage('preview-results');
      }
    } catch (error) {
      addLog(`Error: ${error}`, 'error', 'preview');
      setStage('preview-results');
    } finally {
      window.moleDesktop.optimize.removeListeners();
    }
  };

  // ─── Real optimization ───────────────────────────────────────────────────────

  const startOptimization = async () => {
    setStage('optimizing');
    setLogs([]);
    setTimeline([]);

    addLog('Starting system optimization...', 'info');

    window.moleDesktop.optimize.onStdout((text) => {
      addLog(text, 'info');
      parseTimelineFromLog(text);
    });

    window.moleDesktop.optimize.onStderr((text) => {
      addLog(text, 'error');
    });

    try {
      const result = await window.moleDesktop.optimize.execute({ dryRun: false });

      if (result.killed) {
        addLog('Optimization was cancelled', 'error');
        setStage('idle');
      } else if (result.ok) {
        setTimeline((prev) =>
          prev.map((s) =>
            s.status === 'active' ? { ...s, status: 'complete', endTime: Date.now() } : s
          )
        );
        addLog('System optimization completed successfully!', 'success');
        setStage('complete');
      } else {
        addLog(`Optimization failed: ${result.stderr}`, 'error');
        setStage('error');
      }
    } catch (error) {
      addLog(`Error: ${error}`, 'error');
      setStage('error');
    } finally {
      window.moleDesktop.optimize.removeListeners();
    }
  };

  const reset = () => {
    setStage('idle');
    setLogs([]);
    setPreviewLogs([]);
    setTimeline([]);
    setPreviewTimeline([]);
  };

  // ─── Idle ────────────────────────────────────────────────────────────────────

  if (stage === 'idle') {
    return <StartScreen config={config} onStart={startPreview} />;
  }

  // ─── Shared timeline renderer ────────────────────────────────────────────────

  const renderTimeline = (
    tl: TimelineStage[],
    title: string,
    runningText = 'Running...'
  ) => (
    <Card variant="glass" className="flex-1 p-6 overflow-y-auto custom-scrollbar">
      <h3 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
        <Gauge className="w-4 h-4" />
        {title}

      </h3>
      <div className="space-y-4">
        {tl.map((s, index) => (
          <div key={s.id} className="relative">
            {index < tl.length - 1 && (
              <div className="absolute left-4 top-10 bottom-0 w-0.5 bg-gradient-to-b from-optimize/30 to-transparent" />
            )}
            <div className="flex gap-3">
              <div className="relative z-10">
                {s.status === 'active' && (
                  <div className="w-8 h-8 rounded-full bg-optimize/20 flex items-center justify-center">
                    <Loader2 className="w-4 h-4 text-optimize animate-spin" />
                  </div>
                )}
                {s.status === 'complete' && (
                  <div className="w-8 h-8 rounded-full bg-accent-success/20 flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4 text-accent-success" />
                  </div>
                )}
                {s.status === 'error' && (
                  <div className="w-8 h-8 rounded-full bg-accent-danger/20 flex items-center justify-center">
                    <AlertCircle className="w-4 h-4 text-accent-danger" />
                  </div>
                )}
                {s.status === 'pending' && (
                  <div className="w-8 h-8 rounded-full bg-surface flex items-center justify-center">
                    <Clock className="w-4 h-4 text-text-tertiary" />
                  </div>
                )}
              </div>
              <div className="flex-1 pb-4">
                <h4 className="font-semibold text-text-primary mb-1">{s.name}</h4>
                {s.items.length > 0 && (
                  <div className="space-y-1 mt-2">
                    {s.items.slice(-3).map((item, i) => (
                      <div key={i} className="text-xs text-text-secondary font-mono">
                        {item}
                      </div>
                    ))}
                    {s.items.length > 3 && (
                      <div className="text-xs text-text-tertiary italic">
                        +{s.items.length - 3} more items
                      </div>
                    )}
                  </div>
                )}
                {s.status === 'active' && s.items.length === 0 && (
                  <div className="text-xs text-text-tertiary italic">{runningText}</div>
                )}
              </div>
            </div>
          </div>
        ))}
        {tl.length === 0 && (
          <div className="text-center text-text-tertiary py-8">
            <Gauge className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Initializing...</p>
          </div>
        )}
      </div>
    </Card>
  );

  // ─── Previewing (dry-run) ────────────────────────────────────────────────────

  if (stage === 'previewing') {
    return (
      <div className="h-full flex flex-col p-8">
        <div className="mb-6 text-center">
          <div className="flex justify-center mb-4">
            <div className="relative">
              <Spinner size="lg" />
              <Eye className="absolute inset-0 m-auto w-6 h-6 text-optimize" />
            </div>
          </div>
          <h2 className="text-2xl font-semibold text-text-primary">Previewing Optimizations...</h2>
          <p className="text-text-secondary mt-1">Analyzing what will be optimized on your system</p>
        </div>

        <div className="flex-1 flex gap-4 overflow-hidden mb-6">
          {renderTimeline(previewTimeline, 'What Will Be Optimized', 'Checking...')}
        </div>

        <Button variant="secondary" icon={X} onClick={() => stopProcess('preview')}>
          Cancel Preview
        </Button>
      </div>
    );
  }

  // ─── Preview results ─────────────────────────────────────────────────────────

  if (stage === 'preview-results') {
    const completedTasks = previewTimeline.filter((s) => s.status === 'complete');
    const totalItems = previewTimeline.reduce((sum, s) => sum + s.items.length, 0);

    return (
      <div className="h-full flex flex-col p-8 overflow-hidden">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-3xl font-bold text-text-primary">Preview Results</h2>
          </div>
          <p className="text-text-secondary">
            {completedTasks.length} optimization tasks ready to apply
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <Card variant="glass" className="p-6">
            <div className="text-3xl font-bold text-optimize mb-1">{completedTasks.length}</div>
            <div className="text-sm text-text-secondary">Tasks to Apply</div>
          </Card>
          <Card variant="glass" className="p-6">
            <div className="text-3xl font-bold text-accent-primary mb-1">{totalItems}</div>
            <div className="text-sm text-text-secondary">Actions Planned</div>
          </Card>
        </div>

        {completedTasks.length > 0 && (
          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 mb-6">
            {completedTasks.map((s) => (
              <Card key={s.id} variant="glass" className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-optimize/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Zap className="w-4 h-4 text-optimize" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-text-primary">{s.name}</h4>
                    {s.items.length > 0 && (
                      <div className="mt-1 space-y-0.5">
                        {s.items.slice(0, 3).map((item, i) => (
                          <div key={i} className="text-xs text-text-secondary font-mono truncate">
                            {item}
                          </div>
                        ))}
                        {s.items.length > 3 && (
                          <div className="text-xs text-text-tertiary italic">
                            +{s.items.length - 3} more
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {completedTasks.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-text-tertiary">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-accent-success opacity-60" />
              <p className="font-medium text-text-secondary">System already optimized</p>
              <p className="text-sm mt-1">No significant optimizations were found</p>
            </div>
          </div>
        )}

        <div className="flex gap-4">
          <Button variant="secondary" icon={X} onClick={reset}>
            Cancel
          </Button>
          <Button icon={Play} onClick={startOptimization} className="flex-1">
            Apply Optimizations
          </Button>
        </div>
      </div>
    );
  }

  // ─── Optimizing ──────────────────────────────────────────────────────────────

  if (stage === 'optimizing') {
    return (
      <div className="h-full flex flex-col p-8">
        <div className="mb-6 text-center">
          <div className="flex justify-center mb-4">
            <div className="relative">
              <Spinner size="lg" />
              <Zap className="absolute inset-0 m-auto w-6 h-6 text-optimize" />
            </div>
          </div>
          <h2 className="text-2xl font-semibold text-text-primary">Optimizing System...</h2>
          <p className="text-text-secondary mt-1">Running system maintenance and optimization tasks</p>
        </div>

        <div className="flex-1 flex gap-4 overflow-hidden mb-6">
          {renderTimeline(timeline, 'Optimization Progress', 'Running...')}
        </div>

        <Button variant="secondary" icon={X} onClick={() => stopProcess('main')}>
          Stop Optimization
        </Button>
      </div>
    );
  }

  if (stage === 'complete') {
    const completedStages = timeline.filter((s) => s.status === 'complete');
    const totalItems = timeline.reduce((sum, s) => sum + s.items.length, 0);

    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-8 max-w-md w-full">
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-full bg-accent-success/12 flex items-center justify-center">
              <Check className="w-10 h-10 text-accent-success" />
            </div>
          </div>
          <div>
            <h2 className="text-3xl font-bold text-text-primary mb-2">Optimization Complete!</h2>
            <p className="text-text-secondary">System maintenance tasks finished successfully</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Card variant="glass" className="p-6">
              <div className="text-3xl font-bold text-optimize mb-1">{completedStages.length}</div>
              <div className="text-sm text-text-secondary">Tasks Completed</div>
            </Card>
            <Card variant="glass" className="p-6">
              <div className="text-3xl font-bold text-accent-primary mb-1">{totalItems}</div>
              <div className="text-sm text-text-secondary">Items Processed</div>
            </Card>
          </div>

          {completedStages.length > 0 && (
            <Card variant="glass" className="p-4 text-left">
              <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
                <Zap className="w-4 h-4 text-optimize" />
                Completed Tasks
              </h3>
              <div className="space-y-2">
                {completedStages.map((s) => (
                  <div key={s.id} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-accent-success/20 flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 className="w-3 h-3 text-accent-success" />
                    </div>
                    <span className="text-sm text-text-secondary">{s.name}</span>
                    {s.startTime && s.endTime && (
                      <span className="text-xs text-text-tertiary ml-auto">
                        {((s.endTime - s.startTime) / 1000).toFixed(1)}s
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Button icon={Check} onClick={reset} size="lg">
            Done
          </Button>
        </div>
      </div>
    );
  }

  // ─── Error ───────────────────────────────────────────────────────────────────

  if (stage === 'error') {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-8 max-w-md w-full">
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-full bg-accent-danger/12 flex items-center justify-center">
              <AlertCircle className="w-10 h-10 text-accent-danger" />
            </div>
          </div>
          <div>
            <h2 className="text-3xl font-bold text-text-primary mb-2">Optimization Failed</h2>
            <p className="text-text-secondary">Some tasks encountered errors. Check the log for details.</p>
          </div>

          {logs.filter((l) => l.type === 'error').length > 0 && (
            <Card variant="glass" className="p-4 text-left">
              <h3 className="text-sm font-semibold text-text-primary mb-3">Error Details</h3>
              <div className="space-y-1 font-mono text-xs max-h-40 overflow-y-auto custom-scrollbar">
                {logs
                  .filter((l) => l.type === 'error')
                  .map((log, i) => (
                    <div key={i} className="text-red-400">
                      {log.text}
                    </div>
                  ))}
              </div>
            </Card>
          )}

          <div className="flex gap-4 justify-center">
            <Button variant="secondary" onClick={reset}>
              Back
            </Button>
            <Button icon={Zap} onClick={startOptimization}>
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
