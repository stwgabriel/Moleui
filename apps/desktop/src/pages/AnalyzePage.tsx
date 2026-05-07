import { useState, useEffect, useRef } from 'react';
import {
  HardDrive, FolderOpen, File, BarChart3, Layers, Search,
  RefreshCw, X, ChevronRight, Home, Download,
  AlertCircle, ArrowLeft, Folder, Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import { StartScreen } from '@/components/common/StartScreen';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { formatBytes, stripAnsi } from '@/utils/format';
import type { PageConfig } from '@/types';

type Stage = 'idle' | 'scanning' | 'results' | 'error';

interface AnalyzeEntry {
  name: string;
  path: string;
  size: number;
  is_dir: boolean;
  insight?: boolean;
  cleanable?: boolean;
  last_access?: string;
}

interface AnalyzeLargeFile {
  name: string;
  path: string;
  size: number;
}

interface AnalyzeResult {
  path: string;
  overview: boolean;
  entries: AnalyzeEntry[];
  large_files?: AnalyzeLargeFile[];
  total_size: number;
  total_files?: number;
}

const QUICK_PATHS = [
  { label: 'Entire Disk', path: '/', icon: HardDrive },
  { label: 'Home Folder', path: '~', icon: Home },
  { label: 'Downloads', path: '~/Downloads', icon: Download },
];

const config: PageConfig = {
  title: 'Analyze',
  description: 'Visualize disk usage and identify large files and folders consuming your storage.',
  icon: 'PieChart',
  buttonText: 'Analyze Storage',
  items: [
    {
      icon: 'BarChart3',
      title: 'Disk Usage Map',
      description: 'Interactive visualization of storage usage',
    },
    {
      icon: 'FolderOpen',
      title: 'Large Files',
      description: 'Quickly identify space-hogging files',
    },
    {
      icon: 'Layers',
      title: 'Category Breakdown',
      description: 'See storage by file type and category',
    },
  ],
};

export function AnalyzePage() {
  const [stage, setStage] = useState<Stage>('idle');
  const [scanPath, setScanPath] = useState('/');
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [progress, setProgress] = useState(0);
  const [currentFile, setCurrentFile] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'breakdown' | 'files'>('breakdown');
  const [pathInput, setPathInput] = useState('/');
  // 'start' = StartScreen, 'pick' = path picker, rest handled by stage
  const [view, setView] = useState<'start' | 'pick'>('start');

  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      window.moleDesktop?.analyze?.removeListeners();
    };
  }, []);

  const startScan = async (path?: string) => {
    const targetPath = path ?? scanPath;
    setScanPath(targetPath);
    setPathInput(targetPath);
    setStage('scanning');
    setView('start'); // not on pick screen anymore
    setProgress(0);
    setCurrentFile('');
    setError(null);

    let jsonBuffer = '';

    window.moleDesktop.analyze.onStdout((text) => {
      jsonBuffer += text;
      const clean = stripAnsi(text).trim();
      if (clean) setCurrentFile(clean.slice(0, 80));
    });

    window.moleDesktop.analyze.onStderr((text) => {
      console.error('[Analyze stderr]', text);
    });

    // Simulate progress while scanning
    progressIntervalRef.current = setInterval(() => {
      setProgress((prev) => (prev < 88 ? prev + Math.random() * 8 : prev));
    }, 400);

    try {
      const res = await window.moleDesktop.analyze.execute(targetPath);

      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      setProgress(100);

      if (res.ok) {
        try {
          const parsed: AnalyzeResult = JSON.parse(jsonBuffer || res.stdout);
          setResult(parsed);
          setStage('results');
          setActiveTab('breakdown');
        } catch (parseErr) {
          console.error('Failed to parse analyze JSON:', parseErr);
          setError('Failed to parse analysis results. The scan may have returned unexpected output.');
          setStage('error');
        }
      } else if (res.killed) {
        setStage('idle');
      } else {
        setError(res.stderr || 'Analysis failed with an unknown error.');
        setStage('error');
      }
    } catch (err: any) {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      setError(err.message || 'An unexpected error occurred.');
      setStage('error');
    } finally {
      window.moleDesktop.analyze.removeListeners();
    }
  };

  const stopScan = async () => {
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    await window.moleDesktop.analyze.kill();
    setStage('idle');
    setView('start');
    toast('Analysis cancelled', {
      description: 'The disk scan was stopped.',
      icon: <X className="w-4 h-4 text-text-secondary" />,
    });
  };

  const reset = () => {
    setStage('idle');
    setView('start');
    setResult(null);
    setProgress(0);
    setCurrentFile('');
    setError(null);
  };

  // ── Idle / Start Screen ──────────────────────────────────────────────────
  if (stage === 'idle' && view === 'start') {
    return (
      <StartScreen
        config={config}
        onStart={() => setView('pick')}
      />
    );
  }

  // ── Path Picker ──────────────────────────────────────────────────────────
  if (stage === 'idle' && view === 'pick') {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8">
        <Card className="w-full max-w-lg p-8 space-y-6">
          <div className="text-center">
            <div className="inline-flex p-4 rounded-2xl bg-analyze/10 mb-4">
              <BarChart3 className="w-8 h-8 text-analyze" />
            </div>
            <h2 className="text-2xl font-bold text-text-primary mb-1">Choose Scan Location</h2>
            <p className="text-sm text-text-secondary">Select a folder to analyze its disk usage</p>
          </div>

          {/* Quick paths */}
          <div className="grid grid-cols-3 gap-3">
            {QUICK_PATHS.map(({ label, path, icon: Icon }) => (
              <button
                key={path}
                onClick={() => setScanPath(path)}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${
                  scanPath === path
                    ? 'border-accent-primary bg-accent-primary/10 text-accent-primary'
                    : 'border-surface-hover bg-surface text-text-secondary hover:border-accent-primary/40 hover:text-text-primary'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs font-medium">{label}</span>
              </button>
            ))}
          </div>

          {/* Custom path input */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Custom Path
            </label>
            <div className="relative">
              <Folder className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
              <input
                type="text"
                value={pathInput}
                onChange={(e) => {
                  setPathInput(e.target.value);
                  setScanPath(e.target.value);
                }}
                placeholder="/path/to/folder"
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-surface border border-surface-hover text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent-primary/30 focus:border-accent-primary transition-all font-mono text-sm"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="secondary" onClick={reset} className="flex-1">
              Cancel
            </Button>
            <Button onClick={() => startScan(scanPath)} className="flex-1 gap-2">
              <Search className="w-4 h-4" />
              Start Analysis
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // ── Scanning ─────────────────────────────────────────────────────────────
  if (stage === 'scanning') {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8">
        <div className="text-center space-y-6 w-full max-w-md">
          <div className="inline-flex p-6 rounded-full bg-analyze/10 relative">
            <Spinner size="lg" />
            <Search className="absolute inset-0 m-auto w-6 h-6 text-analyze" />
          </div>

          <div>
            <h2 className="text-2xl font-bold text-text-primary mb-1">Analyzing Disk...</h2>
            <p className="text-sm text-text-secondary font-mono truncate max-w-xs mx-auto">
              {scanPath}
            </p>
          </div>

          {/* Progress bar */}
          <div className="space-y-2">
            <div className="h-2 bg-surface rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-analyze to-accent-secondary rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-text-tertiary">
              <span className="truncate max-w-[240px]">{currentFile || 'Scanning...'}</span>
              <span>{Math.round(progress)}%</span>
            </div>
          </div>

          <Button variant="secondary" onClick={stopScan} className="gap-2">
            <X className="w-4 h-4" />
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (stage === 'error') {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8">
        <div className="text-center space-y-6 max-w-md">
          <div className="inline-flex p-6 rounded-full bg-accent-danger/10">
            <AlertCircle className="w-12 h-12 text-accent-danger" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-text-primary mb-2">Analysis Failed</h2>
            <p className="text-sm text-text-secondary">{error}</p>
          </div>
          <div className="flex gap-3 justify-center">
            <Button variant="secondary" onClick={reset} className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
            <Button onClick={() => startScan()} className="gap-2">
              <RefreshCw className="w-4 h-4" />
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Results ──────────────────────────────────────────────────────────────
  if (stage === 'results' && result) {
    const entries = [...(result.entries ?? [])].sort((a, b) => b.size - a.size);
    const largeFiles = [...(result.large_files ?? [])].sort((a, b) => b.size - a.size);
    const topEntries = entries.slice(0, 20);

    // Build a simple bar chart: each entry as a % of total
    const maxSize = topEntries[0]?.size ?? 1;

    // Color palette cycling for entries
    const COLORS = [
      '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4',
      '#10b981', '#f59e0b', '#ef4444', '#64748b',
    ];

    return (
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-surface flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-text-primary mb-0.5">Storage Analysis</h2>
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <ChevronRight className="w-3 h-3" />
              <span className="font-mono">{result.path}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={() => { setStage('idle'); setView('pick'); }} className="gap-2">
              <FolderOpen className="w-4 h-4" />
              Change Path
            </Button>
            <Button onClick={() => startScan(scanPath)} className="gap-2">
              <RefreshCw className="w-4 h-4" />
              Rescan
            </Button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="px-6 pt-5 grid grid-cols-3 gap-4">
          <Card variant="glass" className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-analyze/12 flex items-center justify-center">
                <HardDrive className="w-5 h-5 text-analyze" />
              </div>
              <div>
                <div className="text-xl font-bold text-text-primary">{formatBytes(result.total_size)}</div>
                <div className="text-xs text-text-secondary">Total Size</div>
              </div>
            </div>
          </Card>

          <Card variant="glass" className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent-primary/12 flex items-center justify-center">
                <Layers className="w-5 h-5 text-accent-primary" />
              </div>
              <div>
                <div className="text-xl font-bold text-text-primary">{entries.length}</div>
                <div className="text-xs text-text-secondary">Entries Found</div>
              </div>
            </div>
          </Card>

          <Card variant="glass" className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent-warning/12 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-accent-warning" />
              </div>
              <div>
                <div className="text-xl font-bold text-text-primary">
                  {entries.filter((e) => e.cleanable).length}
                </div>
                <div className="text-xs text-text-secondary">Cleanable</div>
              </div>
            </div>
          </Card>
        </div>

        {/* Tabs */}
        <div className="px-6 pt-4 flex gap-1 border-b border-surface">
          {(['breakdown', 'files'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-all capitalize ${
                activeTab === tab
                  ? 'text-accent-primary border-b-2 border-accent-primary'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {tab === 'breakdown' ? 'Breakdown' : `Large Files${largeFiles.length ? ` (${largeFiles.length})` : ''}`}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-3">
          {activeTab === 'breakdown' && (
            <>
              {topEntries.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <FolderOpen className="w-12 h-12 text-text-tertiary mb-3" />
                  <p className="text-text-secondary">No entries found in this location.</p>
                </div>
              ) : (
                topEntries.map((entry, i) => {
                  const pct = maxSize > 0 ? (entry.size / maxSize) * 100 : 0;
                  const color = COLORS[i % COLORS.length];
                  return (
                    <Card
                      key={entry.path}
                      variant="glass"
                      hover
                      className="p-4 cursor-pointer"
                      onClick={() => {
                        if (entry.is_dir) {
                          setScanPath(entry.path);
                          startScan(entry.path);
                        }
                      }}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <div
                          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: `${color}20`, color }}
                        >
                          {entry.is_dir ? (
                            <Folder className="w-4 h-4" />
                          ) : (
                            <File className="w-4 h-4" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-text-primary truncate">{entry.name}</span>
                            {entry.cleanable && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-accent-warning/10 text-accent-warning font-medium flex-shrink-0">
                                Cleanable
                              </span>
                            )}
                            {entry.insight && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-accent-primary/10 text-accent-primary font-medium flex-shrink-0">
                                Insight
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-text-tertiary font-mono truncate">{entry.path}</div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="font-semibold text-text-primary">{formatBytes(entry.size)}</div>
                          <div className="text-xs text-text-tertiary">
                            {result.total_size > 0
                              ? `${((entry.size / result.total_size) * 100).toFixed(1)}%`
                              : '—'}
                          </div>
                        </div>
                        {entry.is_dir && (
                          <ChevronRight className="w-4 h-4 text-text-tertiary flex-shrink-0" />
                        )}
                      </div>
                      {/* Bar */}
                      <div className="h-1.5 bg-surface rounded-full overflow-hidden ml-12">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, backgroundColor: color }}
                        />
                      </div>
                    </Card>
                  );
                })
              )}
            </>
          )}

          {activeTab === 'files' && (
            <>
              {largeFiles.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <File className="w-12 h-12 text-text-tertiary mb-3" />
                  <p className="text-text-secondary">No large files detected in this scan.</p>
                </div>
              ) : (
                largeFiles.map((file, i) => (
                  <Card key={file.path} variant="glass" hover className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-accent-danger/10 flex items-center justify-center flex-shrink-0">
                        <File className="w-4 h-4 text-accent-danger" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-text-primary truncate">{file.name}</div>
                        <div className="text-xs text-text-tertiary font-mono truncate">{file.path}</div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="font-semibold text-text-primary">{formatBytes(file.size)}</div>
                        <div className="text-xs text-text-tertiary">
                          #{i + 1} largest
                        </div>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-surface flex items-center justify-between">
          <Button variant="secondary" onClick={reset} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          {result.total_files != null && (
            <span className="text-xs text-text-tertiary">
              {result.total_files.toLocaleString()} files scanned
            </span>
          )}
        </div>
      </div>
    );
  }

  return null;
}
