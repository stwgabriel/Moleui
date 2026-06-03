import { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, Clock, Play, RotateCcw, Terminal, XCircle } from 'lucide-react';
import type { CliMonitorEvent } from '@/types';

const MAX_RENDERED_EVENTS = 1200;

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatDuration(ms?: number) {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) return '';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(ms < 10000 ? 1 : 0)}s`;
}

function eventTone(type: CliMonitorEvent['type'], ok?: boolean) {
  if (type === 'stderr' || type === 'error' || ok === false) return 'text-rose-500 bg-rose-50 ring-rose-100';
  if (type === 'close' || ok === true) return 'text-emerald-600 bg-emerald-50 ring-emerald-100';
  if (type === 'cancel') return 'text-amber-600 bg-amber-50 ring-amber-100';
  if (type === 'stdout') return 'text-blue-600 bg-blue-50 ring-blue-100';
  return 'text-violet-600 bg-violet-50 ring-violet-100';
}

function EventIcon({ event }: { event: CliMonitorEvent }) {
  if (event.type === 'start') return <Play className="h-4 w-4" />;
  if (event.type === 'stderr' || event.type === 'error') return <AlertTriangle className="h-4 w-4" />;
  if (event.type === 'cancel') return <XCircle className="h-4 w-4" />;
  if (event.type === 'close') return event.ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />;
  return <Terminal className="h-4 w-4" />;
}

function eventTitle(event: CliMonitorEvent) {
  if (event.type === 'start') return 'Started';
  if (event.type === 'stdout') return 'stdout';
  if (event.type === 'stderr') return 'stderr';
  if (event.type === 'close') return event.ok ? 'Completed' : `Exited ${event.exitCode ?? 'unknown'}`;
  if (event.type === 'cancel') return 'Cancelled';
  if (event.type === 'clear') return 'Cleared';
  return 'Error';
}

export function CliMonitorWindow() {
  const [events, setEvents] = useState<CliMonitorEvent[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let mounted = true;

    window.moleDesktop.developer?.getCliEvents().then((initialEvents) => {
      if (!mounted) return;
      setEvents(initialEvents.slice(-MAX_RENDERED_EVENTS));
      const lastRun = [...initialEvents].reverse().find((event) => typeof event.runId === 'number');
      if (lastRun?.runId) setSelectedRunId(lastRun.runId);
    });

    window.moleDesktop.developer?.onCliEvent((event) => {
      setEvents((previous) => [...previous, event].slice(-MAX_RENDERED_EVENTS));
      if (typeof event.runId === 'number') setSelectedRunId((current) => current ?? event.runId ?? null);
    });

    return () => {
      mounted = false;
      window.moleDesktop.developer?.removeListeners();
    };
  }, []);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    element.scrollTop = element.scrollHeight;
  }, [events.length, selectedRunId]);

  const runs = useMemo(() => {
    const byRun = new Map<number, CliMonitorEvent[]>();
    for (const event of events) {
      if (typeof event.runId !== 'number') continue;
      const current = byRun.get(event.runId) ?? [];
      current.push(event);
      byRun.set(event.runId, current);
    }

    return [...byRun.entries()].map(([runId, runEvents]) => {
      const start = runEvents.find((event) => event.type === 'start') ?? runEvents[0];
      const end = [...runEvents].reverse().find((event) => ['close', 'cancel', 'error'].includes(event.type));
      const stderrCount = runEvents.filter((event) => event.type === 'stderr' || event.type === 'error').length;
      const stdoutCount = runEvents.filter((event) => event.type === 'stdout').length;
      return {
        runId,
        command: start.command,
        startedAt: start.at,
        end,
        stderrCount,
        stdoutCount,
        events: runEvents,
      };
    }).sort((a, b) => b.runId - a.runId);
  }, [events]);

  const activeRuns = runs.filter((run) => !run.end).length;
  const selectedRun = runs.find((run) => run.runId === selectedRunId) ?? runs[0];

  const clearEvents = async () => {
    await window.moleDesktop.developer?.clearCliEvents();
    setSelectedRunId(null);
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#080b14] text-slate-100">
      <div className="window-drag-region h-8 shrink-0" aria-hidden="true" />
      <header className="flex shrink-0 items-center justify-between border-b border-white/10 px-6 pb-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-500/18 text-violet-200 ring-1 ring-violet-300/20">
              <Activity className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-xl font-black tracking-tight">CLI Monitor</h1>
              <p className="text-sm font-semibold text-slate-400">Real-time Mole CLI lifecycle, stdout, stderr, and completion events.</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-white/7 px-3 py-1.5 text-xs font-black text-slate-300 ring-1 ring-white/10">{runs.length} runs</span>
          <span className="rounded-full bg-emerald-400/10 px-3 py-1.5 text-xs font-black text-emerald-300 ring-1 ring-emerald-300/15">{activeRuns} active</span>
          <button type="button" onClick={clearEvents} className="inline-flex items-center gap-2 rounded-full bg-white/8 px-3 py-1.5 text-xs font-black text-slate-200 ring-1 ring-white/12 transition hover:bg-white/12">
            <RotateCcw className="h-3.5 w-3.5" />
            Clear
          </button>
        </div>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-[380px_minmax(0,1fr)] gap-0">
        <aside className="min-h-0 overflow-y-auto border-r border-white/10 p-4">
          {runs.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-white/14 p-5 text-sm font-semibold text-slate-400">No CLI events yet. Run Cleanup, Optimize, Analyze, Uninstall, My Mac, or Touch ID to see events here.</div>
          ) : (
            <div className="space-y-2">
              {runs.map((run) => {
                const selected = selectedRun?.runId === run.runId;
                const tone = run.end?.ok === false || run.stderrCount > 0 ? 'rose' : run.end ? 'emerald' : 'violet';
                return (
                  <button
                    key={run.runId}
                    type="button"
                    onClick={() => setSelectedRunId(run.runId)}
                    className={`w-full rounded-2xl border p-3 text-left transition ${selected ? 'border-violet-300/40 bg-violet-400/12' : 'border-white/8 bg-white/[0.035] hover:bg-white/[0.06]'}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className={`rounded-full px-2 py-0.5 text-[0.68rem] font-black uppercase tracking-wide ${tone === 'rose' ? 'bg-rose-400/12 text-rose-300' : tone === 'emerald' ? 'bg-emerald-400/12 text-emerald-300' : 'bg-violet-400/12 text-violet-300'}`}>#{run.runId}</span>
                      <span className="text-[0.7rem] font-bold text-slate-500">{formatTime(run.startedAt)}</span>
                    </div>
                    <div className="mt-2 truncate font-mono text-xs font-bold text-slate-200">{run.command}</div>
                    <div className="mt-2 flex items-center gap-2 text-[0.72rem] font-bold text-slate-500">
                      <span>{run.stdoutCount} stdout</span>
                      <span className="h-1 w-1 rounded-full bg-slate-700" />
                      <span>{run.stderrCount} stderr</span>
                      {run.end?.durationMs != null && <span className="ml-auto inline-flex items-center gap-1"><Clock className="h-3 w-3" />{formatDuration(run.end.durationMs)}</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </aside>

        <section className="flex min-h-0 flex-col">
          {selectedRun ? (
            <>
              <div className="shrink-0 border-b border-white/10 px-5 py-4">
                <div className="text-xs font-black uppercase tracking-[0.18em] text-violet-300">Run #{selectedRun.runId}</div>
                <div className="mt-1 break-all font-mono text-sm font-bold text-slate-100">{selectedRun.command}</div>
              </div>
              <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto p-5">
                <div className="space-y-3">
                  {selectedRun.events.map((event) => (
                    <article key={event.id} className="rounded-2xl border border-white/8 bg-white/[0.035] p-4 shadow-[0_12px_42px_rgba(0,0,0,0.18)]">
                      <div className="flex items-center gap-3">
                        <span className={`flex h-8 w-8 items-center justify-center rounded-xl ring-1 ${eventTone(event.type, event.ok)}`}>
                          <EventIcon event={event} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-black text-slate-100">{eventTitle(event)}</div>
                          <div className="text-xs font-bold text-slate-500">{formatTime(event.at)} {event.durationMs != null ? `· ${formatDuration(event.durationMs)}` : ''}</div>
                        </div>
                        {event.exitCode != null && <span className="rounded-full bg-white/7 px-2.5 py-1 text-xs font-black text-slate-300 ring-1 ring-white/10">exit {event.exitCode}</span>}
                      </div>
                      {event.text && (
                        <pre className="mt-3 max-h-[360px] overflow-auto whitespace-pre-wrap rounded-xl bg-black/35 p-3 font-mono text-xs leading-relaxed text-slate-300 ring-1 ring-white/7">{event.text}</pre>
                      )}
                    </article>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="flex h-full items-center justify-center p-8 text-center text-sm font-semibold text-slate-500">Select a CLI run to inspect its events.</div>
          )}
        </section>
      </main>
    </div>
  );
}
