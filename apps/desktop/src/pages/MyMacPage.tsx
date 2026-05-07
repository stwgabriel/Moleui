import { useState, useEffect, useCallback, useRef } from 'react';
import { Settings, RefreshCw, ArrowRight } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, Tooltip, YAxis, PieChart, Pie, Cell } from 'recharts';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { formatBytes } from '@/utils/format';
import { cn } from '@/utils/cn';
import type { PageId, SystemMetrics } from '@/types';
import { getMyMacMetrics, setMyMacMetrics } from '@/utils/storage';

const MAX_HISTORY = 30;

interface HistoryPoint {
  t: number;
  cpu: number;
  rx: number;
  tx: number;
  gpu: number;
}

interface MyMacPageProps {
  onNavigate: (page: PageId) => void;
}

function getHealthColor(score: number): string {
  if (score >= 80) return '#10b981';
  if (score >= 60) return '#f59e0b';
  return '#ef4444';
}

function getHeatColor(percent: number): string {
  if (percent < 50) return '#10b981';
  if (percent < 70) return '#84cc16';
  if (percent < 85) return '#f59e0b';
  return '#ef4444';
}

function GlowProgress({ value, size = 'md' }: { value: number; size?: 'sm' | 'md' | 'lg' }) {
  const percentage = Math.min(Math.max(value, 0), 100);
  const heightClass = size === 'sm' ? 'h-1.5' : size === 'lg' ? 'h-3' : 'h-2';
  const color = getHeatColor(percentage);
  
  return (
    <div className={cn('w-full bg-gray-200 rounded-full overflow-hidden', heightClass)}>
      <div
        className="h-full rounded-full transition-all duration-500 ease-smooth"
        style={{ 
          width: `${percentage}%`,
          backgroundColor: color,
          boxShadow: `0 0 8px ${color}40, 0 0 16px ${color}20`
        }}
      />
    </div>
  );
}

export function MyMacPage({ onNavigate }: MyMacPageProps) {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const mountedRef = useRef(true);

  const fetchMetrics = useCallback(async (isInitial = false) => {
    if (!isInitial) setIsRefreshing(true);
    
    try {
      setError(null);
      
      if (!window.moleDesktop?.runStatus) {
        throw new Error('Desktop API not available');
      }

      const result = await window.moleDesktop.runStatus();
      
      if (!result.ok) {
        throw new Error(result.stderr || 'Failed to fetch metrics');
      }
      
      const data = JSON.parse(result.stdout) as SystemMetrics;
      
      if (mountedRef.current) {
        setMetrics(data);
        setHistory(prev => {
          const point: HistoryPoint = {
            t: Date.now(),
            cpu: data.cpu.usage,
            rx: data.network?.[0]?.rx_rate_mbs ?? 0,
            tx: data.network?.[0]?.tx_rate_mbs ?? 0,
            gpu: data.gpu?.[0]?.usage ?? 0,
          };
          const next = [...prev, point];
          return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next;
        });
        await setMyMacMetrics(JSON.stringify(data), JSON.stringify(data.cpu.usage), '[]');
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        console.error('Failed to fetch metrics:', err);
      }
    } finally {
      if (mountedRef.current) {
        setIsRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    
    async function loadCachedData() {
      const cached = await getMyMacMetrics();
      if (cached && mountedRef.current) {
        try {
          const cachedMetrics = JSON.parse(cached.metrics);
          setMetrics(cachedMetrics);
        } catch {
          console.error('Failed to parse cached metrics');
        }
      }
      fetchMetrics(true);
    }
    
    loadCachedData();
    
    let interval: NodeJS.Timeout | null = null;
    if (autoRefresh) {
      interval = setInterval(() => fetchMetrics(false), 2000);
    }
    
    return () => {
      mountedRef.current = false;
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, fetchMetrics]);

  return (
    <div className="h-full">
      <div className="max-w-7xl mx-auto p-6 h-full flex flex-col">
        <div className="flex items-center justify-between mb-4 shrink-0">
          <div className="flex items-center gap-4">
            <button
              className="p-2 rounded-xl glass-surface hover:bg-surface-hover transition-all duration-200 hover:scale-105 active:scale-95"
              aria-label="Settings"
              title="Settings (Coming soon)"
              onClick={() => console.log('Settings clicked')}
            >
              <Settings className="w-5 h-5 text-text-secondary" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-text-primary">My Mac</h1>
              <p className="text-text-secondary mt-0.5">System dashboard and quick access</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isRefreshing && (
              <RefreshCw className="w-4 h-4 text-text-tertiary animate-spin" />
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={cn(autoRefresh && 'text-accent-primary')}
              title="Auto-refresh every 2 seconds"
            >
              {autoRefresh ? 'Live' : 'Paused'}
            </Button>
          </div>
        </div>

        {error && !metrics ? (
          <Card className="p-8 text-center">
            <p className="text-accent-danger mb-4">{error}</p>
            <Button onClick={() => fetchMetrics(true)}>Retry</Button>
          </Card>
        ) : metrics && (
          <div className="grid grid-cols-3 grid-rows-4 gap-4 flex-1">
            {/* Mac Info - Row 1-2, Col 1 */}
            <Card className="col-span-1 row-span-2 p-5 bg-white">
              <div className="flex flex-col h-full justify-between">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900">{metrics.host || 'My Mac'}</h2>
                  <div 
                    className="text-2xl font-bold"
                    style={{ color: getHealthColor(metrics.health_score) }}
                  >
                    {metrics.health_score}
                  </div>
                </div>
                <div className="space-y-2 text-sm text-gray-500">
                  <div className="flex justify-between py-1 border-b border-gray-200">
                    <span>Model</span>
                    <span className="text-gray-900 font-medium truncate max-w-[60%] text-right">{metrics.hardware?.model || 'Mac'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-gray-200">
                    <span>System</span>
                    <span className="text-gray-900 font-medium truncate max-w-[60%] text-right">{metrics.hardware?.os_version || 'macOS'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-gray-200">
                    <span>Uptime</span>
                    <span className="text-gray-900 font-medium">{metrics.uptime || '—'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-gray-200">
                    <span>Battery</span>
                    <span className="text-gray-900 font-medium">{metrics.batteries?.[0]?.health || 'Normal'}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span>Temperature</span>
                    <span className="text-gray-900 font-medium">
                      {metrics.thermal?.cpu_temp != null
                        ? `${metrics.thermal.cpu_temp.toFixed(0)}°C`
                        : metrics.cpu.temperature != null
                          ? `${metrics.cpu.temperature.toFixed(0)}°C`
                          : metrics.thermal?.system_power != null
                            ? `${metrics.thermal.system_power}W`
                            : '—'}
                    </span>
                  </div>
                </div>
              </div>
            </Card>

            {/* Clean - Row 3, Col 1 */}
            <button
              className="col-start-1 row-start-3 group relative flex flex-col justify-between rounded-2xl p-4 text-left overflow-hidden transition-all duration-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
              style={{ background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)', boxShadow: '0 4px 16px rgba(6,182,212,0.35)' }}
              onClick={() => onNavigate('clean')}
            >
              <div>
                <div className="text-xl font-bold text-white">Clean</div>
                <div className="text-xs text-cyan-100 mt-0.5">Free up space</div>
              </div>
              <div className="flex items-center justify-end">
                <ArrowRight className="w-4 h-4 text-white/70 transition-transform duration-200 group-hover:translate-x-1" />
              </div>
              {/* shine */}
              <div className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-200" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.12) 0%, transparent 60%)' }} />
            </button>

            {/* Uninstall - Row 4, Col 1 */}
            <button
              className="col-start-1 row-start-4 group relative flex flex-col justify-between rounded-2xl p-4 text-left overflow-hidden transition-all duration-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
              style={{ background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', boxShadow: '0 4px 16px rgba(239,68,68,0.35)' }}
              onClick={() => onNavigate('uninstall')}
            >
              <div>
                <div className="text-xl font-bold text-white">Uninstall</div>
                <div className="text-xs text-red-100 mt-0.5">Remove apps</div>
              </div>
              <div className="flex items-center justify-end">
                <ArrowRight className="w-4 h-4 text-white/70 transition-transform duration-200 group-hover:translate-x-1" />
              </div>
              <div className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-200" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.12) 0%, transparent 60%)' }} />
            </button>

            {/* Processor - Row 1, Col 2 */}
            <Card className="col-start-2 row-start-1 p-4 bg-white overflow-hidden">
              <div className="flex flex-col h-full">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-xl font-bold text-gray-900">Processor</div>
                  <div className="text-sm font-semibold" style={{ color: getHeatColor(metrics.cpu.usage) }}>
                    {metrics.cpu.usage.toFixed(0)}%
                  </div>
                </div>
                <div className="text-xs text-gray-400 mb-2">{metrics.cpu.core_count} cores</div>
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={history} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <YAxis domain={[0, 100]} hide />
                      <Tooltip
                        content={({ active, payload }) =>
                          active && payload?.length ? (
                            <div className="bg-white border border-gray-100 rounded-lg px-2 py-1 text-xs shadow-md">
                              {(payload[0].value as number).toFixed(1)}%
                            </div>
                          ) : null
                        }
                      />
                      <Area
                        type="monotone"
                        dataKey="cpu"
                        stroke="#8b5cf6"
                        strokeWidth={1.5}
                        fill="url(#cpuGrad)"
                        dot={false}
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </Card>

            {/* GPU - Row 2, Col 2 */}
            <Card className="col-start-2 row-start-2 p-4 bg-white overflow-hidden">
              <div className="flex flex-col h-full">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-xl font-bold text-gray-900">GPU</div>
                  <div className="text-sm font-semibold" style={{ color: getHeatColor(metrics.gpu?.[0]?.usage ?? 0) }}>
                    {(metrics.gpu?.[0]?.usage ?? 0).toFixed(0)}%
                  </div>
                </div>
                <div className="text-xs text-gray-400 mb-2 truncate">{metrics.gpu?.[0]?.name || 'Apple GPU'}</div>
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={history} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gpuGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ec4899" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#ec4899" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <YAxis domain={[0, 100]} hide />
                      <Tooltip
                        content={({ active, payload }) =>
                          active && payload?.length ? (
                            <div className="bg-white border border-gray-100 rounded-lg px-2 py-1 text-xs shadow-md">
                              {(payload[0].value as number).toFixed(1)}%
                            </div>
                          ) : null
                        }
                      />
                      <Area
                        type="monotone"
                        dataKey="gpu"
                        stroke="#ec4899"
                        strokeWidth={1.5}
                        fill="url(#gpuGrad)"
                        dot={false}
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </Card>

            {/* Optimize - Row 3, Col 2 */}
            <button
              className="col-start-2 row-start-3 group relative flex flex-col justify-between rounded-2xl p-4 text-left overflow-hidden transition-all duration-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
              style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)', boxShadow: '0 4px 16px rgba(139,92,246,0.35)' }}
              onClick={() => onNavigate('optimize')}
            >
              <div>
                <div className="text-xl font-bold text-white">Optimize</div>
                <div className="text-xs text-violet-100 mt-0.5">Boost performance</div>
              </div>
              <div className="flex items-center justify-end">
                <ArrowRight className="w-4 h-4 text-white/70 transition-transform duration-200 group-hover:translate-x-1" />
              </div>
              <div className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-200" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.12) 0%, transparent 60%)' }} />
            </button>

            {/* Analyze - Row 4, Col 2 */}
            <button
              className="col-start-2 row-start-4 group relative flex flex-col justify-between rounded-2xl p-4 text-left overflow-hidden transition-all duration-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-400"
              style={{ background: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)', boxShadow: '0 4px 16px rgba(236,72,153,0.35)' }}
              onClick={() => onNavigate('analyze')}
            >
              <div>
                <div className="text-xl font-bold text-white">Analyze</div>
                <div className="text-xs text-pink-100 mt-0.5">Disk insights</div>
              </div>
              <div className="flex items-center justify-end">
                <ArrowRight className="w-4 h-4 text-white/70 transition-transform duration-200 group-hover:translate-x-1" />
              </div>
              <div className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-200" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.12) 0%, transparent 60%)' }} />
            </button>

            {/* RAM + Storage - Row 1, Col 3 */}
            <div className="col-start-3 row-start-1 grid grid-cols-2 gap-4">
              {/* RAM */}
              <Card className="p-4 bg-white overflow-hidden">
                <div className="flex flex-col h-full">
                  <div className="text-xl font-bold text-gray-900 mb-1">RAM</div>
                  <div className="flex-1 flex items-center justify-center relative min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { value: metrics.memory.used_percent },
                            { value: 100 - metrics.memory.used_percent },
                          ]}
                          cx="50%"
                          cy="50%"
                          innerRadius="58%"
                          outerRadius="80%"
                          startAngle={90}
                          endAngle={-270}
                          dataKey="value"
                          strokeWidth={0}
                          isAnimationActive={false}
                        >
                          <Cell fill={getHeatColor(metrics.memory.used_percent)} />
                          <Cell fill="#f3f4f6" />
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    {/* Center label */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-base font-bold text-gray-900 leading-none">{metrics.memory.used_percent.toFixed(0)}%</span>
                    </div>
                  </div>
                  <div className="mt-1 space-y-0.5">
                    <div className="text-xs text-gray-500 text-center">{formatBytes(metrics.memory.used)} / {formatBytes(metrics.memory.total)}</div>
                    {metrics.memory.swap_total != null && metrics.memory.swap_total > 0 && (
                      <div className="text-xs text-amber-500 text-center">
                        swap {formatBytes(metrics.memory.swap_used ?? 0)}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
              {/* Storage */}
              <Card className="p-4 bg-white overflow-hidden">
                <div className="flex flex-col h-full">
                  <div className="text-xl font-bold text-gray-900 mb-1">Storage</div>
                  <div className="flex-1 flex items-center justify-center relative min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { value: metrics.disks?.[0]?.used_percent ?? 0 },
                            { value: 100 - (metrics.disks?.[0]?.used_percent ?? 0) },
                          ]}
                          cx="50%"
                          cy="50%"
                          innerRadius="58%"
                          outerRadius="80%"
                          startAngle={90}
                          endAngle={-270}
                          dataKey="value"
                          strokeWidth={0}
                          isAnimationActive={false}
                        >
                          <Cell fill={getHeatColor(metrics.disks?.[0]?.used_percent ?? 0)} />
                          <Cell fill="#f3f4f6" />
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-base font-bold text-gray-900 leading-none">{(metrics.disks?.[0]?.used_percent ?? 0).toFixed(0)}%</span>
                    </div>
                  </div>
                  <div className="mt-1">
                    <div className="text-xs text-gray-500 text-center">{formatBytes(metrics.disks?.[0]?.used || 0)} / {formatBytes(metrics.disks?.[0]?.total || 0)}</div>
                  </div>
                </div>
              </Card>
            </div>

            {/* Network - Row 2, Col 3 */}
            <Card className="col-start-3 row-start-2 p-4 bg-white overflow-hidden">
              <div className="flex flex-col h-full">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xl font-bold text-gray-900">Network</div>
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="text-xs font-medium text-blue-500">↓ {metrics.network?.[0]?.rx_rate_mbs.toFixed(2)} MB/s</span>
                    <span className="text-xs font-medium text-emerald-500">↑ {metrics.network?.[0]?.tx_rate_mbs.toFixed(2)} MB/s</span>
                  </div>
                </div>
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={history} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="rxGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="txGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <YAxis hide />
                      <Tooltip
                        content={({ active, payload }) =>
                          active && payload?.length ? (
                            <div className="bg-white border border-gray-100 rounded-lg px-2 py-1 text-xs shadow-md space-y-0.5">
                              <div className="text-blue-500">↓ {(payload[0]?.value as number)?.toFixed(2)} MB/s</div>
                              <div className="text-emerald-500">↑ {(payload[1]?.value as number)?.toFixed(2)} MB/s</div>
                            </div>
                          ) : null
                        }
                      />
                      <Area type="monotone" dataKey="rx" stroke="#3b82f6" strokeWidth={1.5} fill="url(#rxGrad)" dot={false} isAnimationActive={false} />
                      <Area type="monotone" dataKey="tx" stroke="#10b981" strokeWidth={1.5} fill="url(#txGrad)" dot={false} isAnimationActive={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </Card>

            {/* Top Processes - Row 3-4, Col 3 */}
            <Card className="col-start-3 row-start-3 row-span-2 p-4 bg-white">
              <div className="flex flex-col h-full">
                <div className="text-xl font-bold text-gray-900 mb-2">Top Processes</div>
                <div className="space-y-1 flex-1 overflow-auto">
                  {metrics.top_processes?.slice(0, 5).map((proc, idx) => (
                    <div key={proc.pid} className="flex items-center justify-between py-1 px-2 rounded bg-gray-100">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs text-gray-400 w-4">{idx + 1}</span>
                        <span className="text-sm text-gray-700 truncate">{proc.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-purple-600">{proc.cpu.toFixed(0)}%</span>
                        <span className="text-xs text-gray-400">{proc.memory.toFixed(1)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}