import { useState, useEffect, useRef } from 'react';
import { 
  CheckCircle, AlertTriangle, Loader, ArrowRight, X, Trash2,
  Package, Folder, Info, AlertCircle, Check, Search, ArrowUpDown
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StartScreen } from '@/components/common/StartScreen';
import type { PageConfig } from '@/types';

type Stage = 'idle' | 'loading' | 'selection' | 'confirmation' | 'executing' | 'results' | 'error';

interface App {
  name: string;
  bundle_id: string;
  source: string;
  uninstall_name: string;
  path: string;
  size: string;
}

interface CommandResult {
  ok: boolean;
  command: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
}

export function UninstallPage() {
  const [stage, setStage] = useState<Stage>('idle');
  const [apps, setApps] = useState<App[]>([]);
  const [selectedApps, setSelectedApps] = useState<Set<number>>(new Set());
  const [scanStatus, setScanStatus] = useState('');
  const [dryRunOutput, setDryRunOutput] = useState<string[]>([]);
  const [executeOutput, setExecuteOutput] = useState<string[]>([]);
  const [error, setError] = useState<{ title: string; message: string } | null>(null);
  const [result, setResult] = useState<CommandResult | null>(null);
  const [showAllApps, setShowAllApps] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'size'>('size');
  
  const dryRunListRef = useRef<HTMLDivElement>(null);
  const executeListRef = useRef<HTMLDivElement>(null);

  // Setup stream listeners
  useEffect(() => {
    if (!window.moleDesktop) return;

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

    window.moleDesktop.uninstall.onDryRunStdout(handleDryRunStdout);
    window.moleDesktop.uninstall.onDryRunStderr(handleDryRunStderr);
    window.moleDesktop.uninstall.onExecuteStdout(handleExecuteStdout);
    window.moleDesktop.uninstall.onExecuteStderr(handleExecuteStderr);

    return () => {
      window.moleDesktop.uninstall.removeListeners();
    };
  }, []);

  const startScan = async () => {
    setStage('loading');
    setScanStatus('Scanning applications...');

    try {
      const moleDesktop = (window as any).moleDesktop;
      const result = await moleDesktop.uninstall.list();

      if (!result.ok) {
        setError({
          title: 'Failed to scan applications',
          message: result.stderr || 'Unknown error occurred'
        });
        setStage('error');
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

        setScanStatus(`✓ Found ${parsedApps.length} applications`);
        await new Promise(resolve => setTimeout(resolve, 800));

        setApps(parsedApps);
        setStage('selection');
      } catch (e: any) {
        setError({
          title: 'Failed to parse application list',
          message: `${e.message}\n\nOutput: ${result.stdout.substring(0, 200)}`
        });
        setStage('error');
      }
    } catch (error: any) {
      setError({
        title: 'Scan failed',
        message: error.message
      });
      setStage('error');
    }
  };

  const toggleApp = (index: number) => {
    setSelectedApps(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const selectAll = () => {
    setSelectedApps(new Set(apps.map((_, i) => i)));
  };

  const deselectAll = () => {
    setSelectedApps(new Set());
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
    setStage('executing');
    setExecuteOutput([]);

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

  const cancelConfirmation = () => {
    setStage('selection');
    setDryRunOutput([]);
    setAnalysisProgress(0);
  };

  const reset = () => {
    setStage('idle');
    setApps([]);
    setSelectedApps(new Set());
    setScanStatus('');
    setDryRunOutput([]);
    setExecuteOutput([]);
    setError(null);
    setResult(null);
    setShowAllApps(false);
    setAnalysisProgress(0);
    setSearchQuery('');
    setSortBy('size');
  };

  // Parse size string to bytes for sorting
  const parseSizeToBytes = (sizeStr: string): number => {
    const match = sizeStr.match(/^([\d.]+)\s*([A-Za-z]+)$/);
    if (!match) return 0;
    
    const value = parseFloat(match[1]);
    const unit = match[2].toUpperCase();
    
    const multipliers: { [key: string]: number } = {
      'B': 1,
      'KB': 1024,
      'MB': 1024 * 1024,
      'GB': 1024 * 1024 * 1024,
      'TB': 1024 * 1024 * 1024 * 1024,
    };
    
    return value * (multipliers[unit] || 0);
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

  const stripAnsi = (text: string) => {
    return text.replace(/\x1B\[[0-9;]*[A-Za-z]/g, '').replace(/\x1B\[K/g, '');
  };

  // Parse dry-run output into structured data
  const parseDryRunOutput = (output: string[]) => {
    const apps: Array<{ name: string; size: string; files: Array<{ path: string; isSystem: boolean }> }> = [];
    let currentApp: { name: string; size: string; files: Array<{ path: string; isSystem: boolean }> } | null = null;
    let summary = '';

    output.forEach(line => {
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
    return { apps, summary };
  };

  // Parse execute output into structured data
  const parseExecuteOutput = (output: string[]) => {
    const apps: Array<{ name: string; progress: string; files: string[]; completed: boolean }> = [];
    let currentApp: { name: string; progress: string; files: string[]; completed: boolean } | null = null;
    let summary = '';
    let currentProgress = { current: 0, total: 0 };

    output.forEach(line => {
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

      // Completed app: "✓ [1/3] AppName"
      const completedMatch = cleanLine.match(/^[✓✔☑]\s+(?:\[(\d+)\/(\d+)\]\s+)?(.+)$/);
      if (completedMatch && !cleanLine.startsWith('✓ /')) {
        const appName = completedMatch[3].trim();
        if (currentApp && currentApp.name === appName) {
          currentApp.completed = true;
        } else if (!currentApp) {
          // App completed without seeing progress line
          currentApp = { name: appName, progress: '', files: [], completed: true };
        }
        return;
      }

      // File removed: "  ✓ /path/to/file"
      const fileMatch = cleanLine.match(/^[✓✔☑]\s+(\/.*|~\/.*)$/);
      if (fileMatch && currentApp) {
        currentApp.files.push(fileMatch[1]);
        return;
      }

      // Summary: "Removed X apps, freed Y MB"
      if (cleanLine.match(/Removed\s+\d+\s+apps?/i)) {
        summary = cleanLine;
      }
    });

    if (currentApp) apps.push(currentApp);
    return { apps, summary, progress: currentProgress };
  };

  // Render stages
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
          icon: 'Trash',
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

    return <StartScreen config={config} onStart={startScan} />;
  }

  if (stage === 'loading') {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8">
        <div className="text-center space-y-6">
          <div className="inline-flex p-6 rounded-full bg-accent-primary/10">
            <Loader className="w-12 h-12 text-accent-primary animate-spin" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-text-primary mb-2">
              Analyzing Applications...
            </h2>
            <p className="text-text-secondary">
              Scanning your system for installed applications
            </p>
          </div>
          {scanStatus && (
            <Card className="p-4 inline-flex items-center gap-3">
              <Folder className="w-5 h-5 text-accent-primary" />
              <span className="text-sm text-text-secondary">{scanStatus}</span>
            </Card>
          )}
        </div>
      </div>
    );
  }

  if (stage === 'selection') {
    const filteredApps = getFilteredAndSortedApps();
    const filteredIndices = filteredApps.map(app => apps.indexOf(app));
    
    return (
      <div className="h-full flex flex-col">
        <div className="p-6 border-b border-surface">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-text-primary mb-1">
                Select Applications to Uninstall
              </h2>
              <p className="text-sm text-text-secondary">
                {selectedApps.size} of {apps.length} selected
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                onClick={() => selectedApps.size === apps.length ? deselectAll() : selectAll()}
              >
                {selectedApps.size === apps.length ? 'Deselect All' : 'Select All'}
              </Button>
              <Button
                onClick={proceedToConfirmation}
                disabled={selectedApps.size === 0}
                className="gap-2"
              >
                Continue
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Search and Sort Controls */}
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
              <input
                type="text"
                placeholder="Search applications..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg bg-surface border border-surface-hover text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent-primary/30 focus:border-accent-primary transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface border border-surface-hover">
              <ArrowUpDown className="w-4 h-4 text-text-tertiary" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'name' | 'size')}
                className="bg-transparent text-sm text-text-primary focus:outline-none cursor-pointer"
              >
                <option value="size">Sort by Size</option>
                <option value="name">Sort by Name</option>
              </select>
            </div>
          </div>

          {searchQuery && (
            <p className="text-sm text-text-tertiary mt-3">
              Found {filteredApps.length} application{filteredApps.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        <div className="flex-1 overflow-auto p-6">
          {filteredApps.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="p-4 rounded-full bg-surface mb-4">
                <Search className="w-8 h-8 text-text-tertiary" />
              </div>
              <h3 className="text-lg font-semibold text-text-primary mb-1">
                No applications found
              </h3>
              <p className="text-sm text-text-secondary">
                Try adjusting your search query
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredApps.map((app, displayIndex) => {
                const originalIndex = filteredIndices[displayIndex];
                return (
                  <Card
                    key={originalIndex}
                    className={`p-4 cursor-pointer transition-all ${
                      selectedApps.has(originalIndex) ? 'ring-2 ring-accent-primary' : ''
                    }`}
                    onClick={() => toggleApp(originalIndex)}
                  >
                    <div className="flex items-center gap-4">
                      <input
                        type="checkbox"
                        checked={selectedApps.has(originalIndex)}
                        onChange={() => toggleApp(originalIndex)}
                        className="w-5 h-5"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="flex-1">
                        <div className="font-semibold text-text-primary">{app.name}</div>
                        <div className="text-sm text-text-tertiary">{app.path}</div>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        app.source === 'Homebrew' 
                          ? 'bg-accent-secondary/10 text-accent-secondary'
                          : 'bg-surface text-text-secondary'
                      }`}>
                        {app.source}
                      </span>
                      <span className="text-sm font-medium text-text-secondary min-w-[80px] text-right">
                        {app.size}
                      </span>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (stage === 'confirmation') {
    const parsedDryRun = parseDryRunOutput(dryRunOutput);
    const isAnalyzing = dryRunOutput.length === 0 || !parsedDryRun.summary;
    
    const selectedAppsArray = Array.from(selectedApps);
    const hasMoreApps = selectedAppsArray.length > 3;
    const displayedApps = showAllApps ? selectedAppsArray : selectedAppsArray.slice(0, 3);

    return (
      <div className="h-full flex flex-col">
        <div className="p-6 border-b border-surface">
          <div className="flex items-start gap-4 mb-4">
            <div className="p-2 rounded-lg bg-accent-warning/10">
              <AlertTriangle className="w-6 h-6 text-accent-warning" />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-text-primary mb-1">
                Confirm Uninstallation
              </h2>
              <p className="text-text-secondary mb-4">
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
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-surface border border-surface-hover transition-all hover:border-accent-primary/30 hover:shadow-sm"
                      >
                        <Package className="w-4 h-4 text-accent-primary flex-shrink-0" />
                        <span className="font-medium text-text-primary text-sm">{app.name}</span>
                        <span className="text-xs text-text-tertiary">•</span>
                        <span className="text-xs text-text-tertiary">{app.size}</span>
                        {app.source === 'Homebrew' && (
                          <>
                            <span className="text-xs text-text-tertiary">•</span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-accent-secondary/10 text-accent-secondary font-medium">
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
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-accent-primary hover:bg-accent-primary/5 transition-colors"
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

        <div className="flex-1 overflow-auto p-6">
          <div className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-text-primary">
                {isAnalyzing ? 'Analyzing files...' : 'Files to be removed'}
              </h3>
              {isAnalyzing && (
                <div className="flex items-center gap-2 text-sm text-text-secondary">
                  <Loader className="w-4 h-4 animate-spin" />
                  <span>Scanning...</span>
                </div>
              )}
            </div>
            
            {isAnalyzing && (
              <div className="space-y-2">
                <div className="h-2 bg-surface rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-accent-primary to-accent-secondary transition-all duration-300 ease-out"
                    style={{ width: `${analysisProgress}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-text-tertiary">
                  <span>Scanning application files and dependencies...</span>
                  <span>{Math.round(analysisProgress)}%</span>
                </div>
              </div>
            )}
          </div>

          <div ref={dryRunListRef} className="space-y-4 max-h-[400px] overflow-auto">
            {parsedDryRun.apps.map((app, appIndex) => (
              <Card key={appIndex} className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 rounded-lg bg-accent-primary/10">
                    <Package className="w-5 h-5 text-accent-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-text-primary">{app.name}</div>
                    <div className="text-sm text-text-tertiary">{app.size}</div>
                  </div>
                  <CheckCircle className="w-5 h-5 text-accent-success" />
                </div>
                
                {app.files.length > 0 && (
                  <div className="space-y-1 ml-11">
                    {app.files.slice(0, 5).map((file, fileIndex) => (
                      <div 
                        key={fileIndex} 
                        className={`text-sm flex items-center gap-2 ${
                          file.isSystem ? 'text-accent-warning' : 'text-text-tertiary'
                        }`}
                      >
                        {file.isSystem ? (
                          <>
                            <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                            <span className="font-mono text-xs truncate">{file.path}</span>
                            <span className="text-xs px-2 py-0.5 rounded bg-accent-warning/10">System</span>
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
                      <div className="text-xs text-text-tertiary ml-5">
                        + {app.files.length - 5} more files
                      </div>
                    )}
                  </div>
                )}
              </Card>
            ))}

            {parsedDryRun.summary && (
              <Card className="p-4  border-accent-primary/20">
                <div className="flex items-center gap-3">
                  <Info className="w-5 h-5 text-accent-primary" />
                  <span className="text-sm text-text-secondary">{parsedDryRun.summary}</span>
                </div>
              </Card>
            )}
          </div>
        </div>

        <div className="p-6 border-t border-surface flex items-center justify-between">
          <Button variant="secondary" onClick={cancelConfirmation} className="gap-2">
            <X className="w-4 h-4" />
            Cancel
          </Button>
          <Button 
            variant="danger" 
            onClick={executeUninstall} 
            disabled={isAnalyzing}
            className="gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Uninstall {selectedApps.size} App{selectedApps.size > 1 ? 's' : ''}
          </Button>
        </div>
      </div>
    );
  }

  if (stage === 'executing') {
    const parsedExecute = parseExecuteOutput(executeOutput);
    const { apps: executingApps, summary, progress } = parsedExecute;

    return (
      <div className="h-full flex flex-col">
        <div className="p-6 border-b border-surface">
          <h2 className="text-2xl font-bold text-text-primary mb-1">
            Uninstalling Applications
          </h2>
          <p className="text-text-secondary mb-4">
            Removing selected applications and their files...
          </p>
          
          {progress.total > 0 && (
            <div className="mb-4">
              <div className="flex items-center justify-between text-sm text-text-secondary mb-2">
                <span>Progress</span>
                <span>{progress.current} of {progress.total}</span>
              </div>
              <div className="h-2 bg-surface rounded-full overflow-hidden">
                <div 
                  className="h-full bg-accent-primary transition-all duration-300"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          <Card className="p-3 flex items-center gap-3 bg-accent-warning/10">
            <Info className="w-5 h-5 text-accent-warning" />
            <span className="text-sm text-text-secondary">
              Do not close this window until the process completes
            </span>
          </Card>
        </div>

        <div className="flex-1 overflow-auto p-6">
          <div ref={executeListRef} className="space-y-4">
            {executingApps.map((app, appIndex) => (
              <Card key={appIndex} className={`p-4 ${app.completed ? 'border-accent-success/30' : ''}`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-2 rounded-lg ${
                    app.completed ? 'bg-accent-success/10' : 'bg-accent-primary/10'
                  }`}>
                    {app.completed ? (
                      <CheckCircle className="w-5 h-5 text-accent-success" />
                    ) : (
                      <Loader className="w-5 h-5 text-accent-primary animate-spin" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-text-primary">{app.name}</div>
                    <div className="text-sm text-text-tertiary">
                      {app.completed ? 'Completed' : 'Removing files...'}
                      {app.progress && ` (${app.progress})`}
                    </div>
                  </div>
                </div>
                
                {app.files.length > 0 && (
                  <div className="space-y-1 ml-11">
                    {app.files.slice(-5).map((file, fileIndex) => (
                      <div key={fileIndex} className="text-sm flex items-center gap-2 text-text-tertiary">
                        <Check className="w-3 h-3 flex-shrink-0 text-accent-success" />
                        <span className="font-mono text-xs truncate">
                          {file.replace(/^\/Users\/[^\/]+/, '~')}
                        </span>
                      </div>
                    ))}
                    {app.files.length > 5 && (
                      <div className="text-xs text-text-tertiary ml-5">
                        {app.files.length} files removed
                      </div>
                    )}
                  </div>
                )}
              </Card>
            ))}

            {summary && (
              <Card className="p-4 bg-accent-success/5 border-accent-success/20">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-accent-success" />
                  <div>
                    <div className="font-semibold text-text-primary mb-1">Uninstall Complete</div>
                    <div className="text-sm text-text-secondary">{summary}</div>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (stage === 'results') {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8">
        <div className="text-center space-y-6 max-w-2xl">
          <div className={`inline-flex p-6 rounded-full ${
            result?.ok ? 'bg-accent-success/10' : 'bg-accent-danger/10'
          }`}>
            {result?.ok ? (
              <CheckCircle className="w-12 h-12 text-accent-success" />
            ) : (
              <AlertCircle className="w-12 h-12 text-accent-danger" />
            )}
          </div>
          <div>
            <h2 className="text-2xl font-bold text-text-primary mb-2">
              {result?.ok ? 'Uninstall Complete' : 'Uninstall Failed'}
            </h2>
            <p className="text-text-secondary">
              {result?.ok 
                ? 'Applications have been successfully removed'
                : 'An error occurred during uninstallation'
              }
            </p>
          </div>
          {result && (
            <Card className="p-4 text-left max-h-[300px] overflow-auto">
              <pre className="text-sm font-mono text-text-secondary whitespace-pre-wrap">
                {result.stdout || result.stderr}
              </pre>
            </Card>
          )}
          <Button onClick={reset} className="gap-2">
            <Check className="w-4 h-4" />
            Done
          </Button>
        </div>
      </div>
    );
  }

  if (stage === 'error') {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8">
        <div className="text-center space-y-6 max-w-2xl">
          <div className="inline-flex p-6 rounded-full bg-accent-danger/10">
            <AlertCircle className="w-12 h-12 text-accent-danger" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-text-primary mb-2">
              {error?.title || 'Error'}
            </h2>
            <p className="text-text-secondary">
              {error?.message || 'An unknown error occurred'}
            </p>
          </div>
          <Button onClick={reset}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
