import { useState, useEffect, useCallback } from 'react';
import { Cpu, HardDrive, Battery, Wifi, Zap, AlertCircle, TrendingUp } from 'lucide-react';
import { StartScreen } from '@/components/common/StartScreen';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { formatBytes } from '@/utils/format';
import type { PageConfig, SystemMetrics } from '@/types';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { AreaChart, Area, XAxis, YAxis, PieChart, Pie, Cell } from 'recharts';

interface MetricHistory {
  timestamp: number;
  cpuUsage: number;
  networkRx: number;
  networkTx: number;
}

const config: PageConfig = {
  title: 'Status',
  description: 'Monitor your Mac\'s health with real-time system metrics and performance indicators.',
  icon: 'Activity',
  buttonText: 'Start Monitoring',
  items: [
    {
      icon: 'Cpu',
      title: 'CPU & Memory',
      description: 'Real-time processor and RAM usage',
    },
    {
      icon: 'HardDrive',
      title: 'Disk & Network',
      description: 'Monitor storage and network activity',
    },
    {
      icon: 'Battery',
      title: 'Battery Health',
      description: 'Check battery status and cycle count',
    },
  ],
};

export function StatusPage() {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [history, setHistory] = useState<MetricHistory[]>([]);

  const fetchMetrics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Check if moleDesktop API is available
      if (!window.moleDesktop || !window.moleDesktop.runStatus) {
        throw new Error('Desktop API not available. Please restart the application.');
      }

      const result = await window.moleDesktop.runStatus();
      
      if (!result.ok) {
        throw new Error(result.stderr || 'Failed to fetch system metrics');
      }
      
const data = JSON.parse(result.stdout) as SystemMetrics;
        setMetrics(data);
        
        // Update history for charts (keep last 30 data points)
        setHistory(prev => {
          const newEntry: MetricHistory = {
            timestamp: Date.now(),
            cpuUsage: data.cpu.usage,
            networkRx: data.network?.[0]?.rx_rate_mbs || 0,
            networkTx: data.network?.[0]?.tx_rate_mbs || 0,
          };
          const updated = [...prev, newEntry];
          return updated.slice(-30);
        });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      console.error('Failed to fetch metrics:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (autoRefresh) {
      fetchMetrics();
      const interval = setInterval(fetchMetrics, 2000); // Refresh every 2 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh, fetchMetrics]);

  const handleStart = async () => {
    setShowDashboard(true);
    setAutoRefresh(true);
  };

  const toggleMonitoring = () => {
    setAutoRefresh(!autoRefresh);
  };

  const getHealthColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getHealthLabel = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Poor';
  };

  // Show start screen if dashboard hasn't been opened yet
  if (!showDashboard) {
    return <StartScreen config={config} onStart={handleStart} />;
  }

  // Show error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <AlertCircle className="w-16 h-16 text-accent-danger" />
        <h2 className="text-2xl font-semibold text-text-primary">Error Loading Metrics</h2>
        <p className="text-text-secondary text-center max-w-md">{error}</p>
        <Button onClick={fetchMetrics}>Try Again</Button>
      </div>
    );
  }

  // Show dashboard
  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-text-primary">System Status</h1>
            <p className="text-text-secondary mt-1">Real-time system metrics and health monitoring</p>
          </div>
          <div className="flex items-center gap-3">
            {loading && <Spinner size="sm" />}
            <Button
              onClick={toggleMonitoring}
              variant={autoRefresh ? 'secondary' : 'primary'}
            >
              {autoRefresh ? 'Stop Monitoring' : 'Start Monitoring'}
            </Button>
          </div>
        </div>

        {metrics && (
          <>
            {/* Health Score */}
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-text-primary mb-1">System Health</h3>
                  <p className="text-sm text-text-secondary">Overall system performance score</p>
                </div>
                <div className="text-right">
                  <div className={`text-4xl font-bold ${getHealthColor(metrics.health_score)}`}>
                    {metrics.health_score}
                  </div>
                  <div className="text-sm text-text-secondary mt-1">
                    {getHealthLabel(metrics.health_score)}
                  </div>
                </div>
              </div>
            </Card>

            {/* CPU & Memory */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-accent-primary/10 flex items-center justify-center">
                    <Cpu className="w-5 h-5 text-accent-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-text-primary">CPU</h3>
                    <p className="text-sm text-text-secondary">{metrics.cpu.core_count} cores</p>
                  </div>
                </div>
                {history.length > 1 && (
                  <div className="h-24 mb-4">
                    <ChartContainer config={{
                      cpu: { color: 'hsl(var(--chart-1))', label: 'CPU Usage' }
                    }}>
                      <AreaChart data={history}>
                        <XAxis dataKey="timestamp" hide />
                        <YAxis hide domain={[0, 100]} />
                        <ChartTooltip 
                          content={<ChartTooltipContent 
                            formatter={(value) => [`${Number(value).toFixed(1)}%`, '']}
                            labelFormatter={() => ''}
                          />}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="cpuUsage" 
                          stroke="hsl(var(--chart-1))" 
                          fill="hsl(var(--chart-1))" 
                          fillOpacity={0.3} 
                          strokeWidth={2}
                          name="CPU"
                        />
                      </AreaChart>
                    </ChartContainer>
                  </div>
                )}
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-text-secondary">Usage</span>
                      <span className="font-semibold text-text-primary">
                        {metrics.cpu.usage.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-surface rounded-full h-2">
                      <div
                        className="bg-accent-primary h-2 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(metrics.cpu.usage, 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-surface">
                    <div>
                      <div className="text-xs text-text-secondary">1m Load</div>
                      <div className="text-sm font-semibold text-text-primary">
                        {metrics.cpu.load1.toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-text-secondary">5m Load</div>
                      <div className="text-sm font-semibold text-text-primary">
                        {metrics.cpu.load5.toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-text-secondary">15m Load</div>
                      <div className="text-sm font-semibold text-text-primary">
                        {metrics.cpu.load15.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-accent-secondary/10 flex items-center justify-center">
                    <Zap className="w-5 h-5 text-accent-secondary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-text-primary">Memory</h3>
                    <p className="text-sm text-text-secondary">
                      {formatBytes(metrics.memory.total)} total
                    </p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-text-secondary">Used</span>
                      <span className="font-semibold text-text-primary">
                        {formatBytes(metrics.memory.used)} ({metrics.memory.used_percent.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="w-full bg-surface rounded-full h-2">
                      <div
                        className="bg-accent-secondary h-2 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(metrics.memory.used_percent, 100)}%` }}
                      />
                    </div>
                  </div>
                  {metrics.memory.pressure && (
                    <div className="pt-2 border-t border-surface">
                      <div className="text-xs text-text-secondary">Memory Pressure</div>
                      <div className="text-sm font-semibold text-text-primary capitalize">
                        {metrics.memory.pressure}
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            </div>

            {/* Disks */}
            {metrics.disks && metrics.disks.length > 0 && (
              <Card className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-accent-success/10 flex items-center justify-center">
                    <HardDrive className="w-5 h-5 text-accent-success" />
                  </div>
                  <h3 className="text-lg font-semibold text-text-primary">Disk Usage</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {metrics.disks.map((disk, index) => {
                    const usedPercent = disk.used_percent;
                    const chartData = [
                      { name: 'Used', value: disk.used, fill: 'hsl(var(--chart-1))' },
                      { name: 'Free', value: disk.total - disk.used, fill: 'hsl(var(--chart-3))' },
                    ];
                    return (
                      <div key={index} className="flex flex-col items-center">
                        <div className="w-32 h-32 relative">
                          <ChartContainer config={{}}>
                            <PieChart>
                              <Pie
                                data={chartData}
                                cx="50%"
                                cy="50%"
                                innerRadius={40}
                                outerRadius={60}
                                paddingAngle={2}
                                dataKey="value"
                                stroke="none"
                              >
                                {chartData.map((entry, i) => (
                                  <Cell key={i} fill={entry.fill} />
                                ))}
                              </Pie>
                            </PieChart>
                          </ChartContainer>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-lg font-bold text-text-primary">{usedPercent.toFixed(0)}%</span>
                          </div>
                        </div>
                        <div className="text-center mt-2">
                          <div className="text-sm font-mono text-text-secondary">{disk.mount}</div>
                          <div className="text-xs text-text-tertiary">{formatBytes(disk.used)} / {formatBytes(disk.total)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}

              {/* Network & Disk I/O */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Network */}
                {metrics.network && metrics.network.length > 0 && (
                  <Card className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-lg bg-accent-primary/10 flex items-center justify-center">
                        <Wifi className="w-5 h-5 text-accent-primary" />
                      </div>
                      <h3 className="text-lg font-semibold text-text-primary">Network Activity</h3>
                    </div>
                    {history.length > 1 && (
                      <div className="h-32">
                        <ChartContainer config={{
                          download: { color: 'hsl(var(--chart-1))', label: 'Download' },
                          upload: { color: 'hsl(var(--chart-2))', label: 'Upload' }
                        }}>
                          <AreaChart data={history}>
                            <XAxis dataKey="timestamp" hide />
                            <YAxis hide domain={[0, 'auto']} />
                            <ChartTooltip 
                              content={<ChartTooltipContent 
                            formatter={(value) => [`${Number(value).toFixed(2)} MB/s`, '']}
                                labelFormatter={() => ''}
                              />}
                            />
                            <Area 
                              type="monotone" 
                              dataKey="networkRx" 
                              stroke="hsl(var(--chart-1))" 
                              fill="hsl(var(--chart-1))" 
                              fillOpacity={0.3} 
                              strokeWidth={2}
                              name="Download"
                            />
                            <Area 
                              type="monotone" 
                              dataKey="networkTx" 
                              stroke="hsl(var(--chart-2))" 
                              fill="hsl(var(--chart-2))" 
                              fillOpacity={0.3} 
                              strokeWidth={2}
                              name="Upload"
                            />
                          </AreaChart>
                        </ChartContainer>
                        <div className="flex justify-center gap-4 mt-2 text-xs">
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-[hsl(var(--chart-1))]"></span>
                            ↓ Download
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-[hsl(var(--chart-2))]"></span>
                            ↑ Upload
                          </span>
                        </div>
                      </div>
                    )}
                    <div className="space-y-3 mt-4">
                      {metrics.network.map((net, index) => (
                        <div key={index} className="flex items-center justify-between">
                          <span className="text-sm text-text-secondary font-mono">{net.name}</span>
                          <div className="flex items-center gap-4 text-sm">
                            <span className="text-text-primary">
                              ↓ {net.rx_rate_mbs.toFixed(2)} MB/s
                            </span>
                            <span className="text-text-primary">
                              ↑ {net.tx_rate_mbs.toFixed(2)} MB/s
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                {/* Disk I/O */}
                {metrics.disk_io && (
                  <Card className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-lg bg-accent-secondary/10 flex items-center justify-center">
                        <TrendingUp className="w-5 h-5 text-accent-secondary" />
                      </div>
                      <h3 className="text-lg font-semibold text-text-primary">Disk I/O</h3>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-text-secondary">Read Rate</span>
                        <span className="text-sm font-semibold text-text-primary">
                          {metrics.disk_io.read_rate.toFixed(2)} MB/s
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-text-secondary">Write Rate</span>
                        <span className="text-sm font-semibold text-text-primary">
                          {metrics.disk_io.write_rate.toFixed(2)} MB/s
                        </span>
                      </div>
                    </div>
                  </Card>
                )}
              </div>

              {/* Battery */}
              {metrics.batteries && metrics.batteries.length > 0 && (
                <Card className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-accent-warning/10 flex items-center justify-center">
                      <Battery className="w-5 h-5 text-accent-warning" />
                    </div>
                    <h3 className="text-lg font-semibold text-text-primary">Battery</h3>
                  </div>
                  <div className="space-y-4">
                    {metrics.batteries.map((battery, index) => (
                      <div key={index} className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-text-secondary">Charge Level</span>
                          <span className="text-lg font-semibold text-text-primary">
                            {battery.percent}%
                          </span>
                        </div>
                        <div className="w-full bg-surface rounded-full h-2">
                          <div
                            className="bg-accent-warning h-2 rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(battery.percent, 100)}%` }}
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-surface">
                          <div>
                            <div className="text-xs text-text-secondary">Status</div>
                            <div className="text-sm font-semibold text-text-primary capitalize">
                              {battery.status}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-text-secondary">Health</div>
                            <div className="text-sm font-semibold text-text-primary">
                              {battery.health}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-text-secondary">Cycles</div>
                            <div className="text-sm font-semibold text-text-primary">
                              {battery.cycle_count}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

            {/* GPU */}
            {metrics.gpu && metrics.gpu.length > 0 && (
              <Card className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-accent-primary/10 flex items-center justify-center">
                    <Zap className="w-5 h-5 text-accent-primary" />
                  </div>
                  <h3 className="text-lg font-semibold text-text-primary">GPU</h3>
                </div>
                <div className="space-y-3">
                  {metrics.gpu.map((gpu, index) => (
                    <div key={index}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-text-secondary">{gpu.name}</span>
                        <span className="font-semibold text-text-primary">
                          {gpu.usage.toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full bg-surface rounded-full h-2">
                        <div
                          className="bg-accent-primary h-2 rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(gpu.usage, 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Top Processes */}
            {metrics.top_processes && metrics.top_processes.length > 0 && (
              <Card className="p-6">
                <h3 className="text-lg font-semibold text-text-primary mb-4">Top Processes</h3>
                <div className="space-y-2">
                  {metrics.top_processes.slice(0, 5).map((proc, index) => (
                    <div key={index} className="flex items-center justify-between text-sm py-2 border-b border-surface last:border-b-0">
                      <span className="text-text-primary font-medium">{proc.name}</span>
                      <div className="flex items-center gap-4 text-text-secondary">
                        <span>CPU: {proc.cpu.toFixed(1)}%</span>
                        <span>Memory: {proc.memory.toFixed(1)}%</span>
                        <span className="text-xs">PID: {proc.pid}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
