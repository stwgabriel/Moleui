// Electron IPC types
export interface MoleResult {
  ok: boolean;
  killed?: boolean;
  command: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
}

export interface MoleDesktopAPI {
  getRuntimeInfo: () => Promise<{ packaged: boolean; runtimeDir: string; executable: string }>;
  openSettingsWindow?: () => Promise<{ ok: boolean; message?: string }>;
  getSettingsProfile?: () => Promise<{ deviceName: string; user: { name: string; email: string } }>;
  touchid?: {
    status: () => Promise<MoleResult>;
    enable: () => Promise<MoleResult>;
    disable: () => Promise<MoleResult>;
  };
  openExternal: (url: string) => Promise<{ ok: boolean; message?: string }>;
  copyText: (text: string) => Promise<{ ok: boolean }>;
  revealPath: (commandPath: string) => Promise<{ ok: boolean; message?: string }>;
  openPathInFinder: (path: string) => Promise<{ ok: boolean; message?: string }>;
  deletePath: (path: string) => Promise<{ ok: boolean; message?: string }>;
  openActivityMonitor: () => Promise<{ ok: boolean; message?: string }>;
  signalProcess: (pid: number, signal: 'SIGTERM' | 'SIGKILL') => Promise<{ ok: boolean; message?: string }>;
  runStatus: () => Promise<MoleResult>;
  uninstall: {
    list: () => Promise<MoleResult>;
    killList: () => Promise<{ ok: boolean; message: string }>;
    getAppIcon: (appPath: string) => Promise<{ ok: boolean; icon: string; message?: string }>;
    getAppIcons: (appPaths: string[]) => Promise<{ ok: boolean; icons: Record<string, string>; message?: string }>;
    dryRun: (appNames: string[]) => Promise<MoleResult>;
    execute: (appNames: string[]) => Promise<MoleResult>;
    onListStdout: (callback: (data: string) => void) => void;
    onListStderr: (callback: (data: string) => void) => void;
    onDryRunStdout: (callback: (data: string) => void) => void;
    onDryRunStderr: (callback: (data: string) => void) => void;
    onExecuteStdout: (callback: (data: string) => void) => void;
    onExecuteStderr: (callback: (data: string) => void) => void;
    removeListeners: () => void;
  };
  clean: {
    execute: (options: { dryRun: boolean; sections?: string[]; command?: 'clean' | 'purge' | 'installer'; all?: boolean }) => Promise<MoleResult>;
    kill: () => Promise<MoleResult>;
    onStdout: (callback: (data: string) => void) => void;
    onStderr: (callback: (data: string) => void) => void;
    removeListeners: () => void;
  };
  optimize: {
    execute: (options: { dryRun: boolean; taskNames?: string[] }) => Promise<MoleResult>;
    kill: () => Promise<MoleResult>;
    onStdout: (callback: (data: string) => void) => void;
    onStderr: (callback: (data: string) => void) => void;
    removeListeners: () => void;
  };
  analyze: {
    execute: (path: string, options?: { fresh?: boolean }) => Promise<MoleResult>;
    kill: () => Promise<{ ok: boolean; message: string }>;
    onStdout: (callback: (data: string) => void) => void;
    onStderr: (callback: (data: string) => void) => void;
    removeListeners: () => void;
  };
}

declare global {
  interface Window {
    moleDesktop: MoleDesktopAPI;
  }
}

// Application types
export interface Application {
  name: string;
  path: string;
  source: string;
  size: string;
  uninstall_name: string;
}

export interface HardwareInfo {
  model?: string;
  cpu_model?: string;
  total_ram?: string;
  disk_size?: string;
  os_version?: string;
  refresh_rate?: string;
}

export interface SystemMetrics {
  host?: string;
  uptime?: string;
  thermal?: {
    cpu_temp?: number;
    gpu_temp?: number;
    battery_temp?: number;
    fan_speed?: number;
    fan_count?: number;
    system_power?: number;
    adapter_power?: number;
    battery_power?: number;
  };
  cpu: {
    usage: number;
    core_count: number;
    load1: number;
    load5: number;
    load15: number;
    temperature?: number;
  };
  memory: {
    used: number;
    total: number;
    used_percent: number;
    pressure?: string;
    swap_used?: number;
    swap_total?: number;
  };
  disks: Array<{
    mount: string;
    used: number;
    total: number;
    used_percent: number;
  }>;
  network: Array<{
    name: string;
    rx_rate_mbs: number;
    tx_rate_mbs: number;
    ip?: string;
  }>;
  disk_io: {
    read_rate: number;
    write_rate: number;
  };
  batteries: Array<{
    percent: number;
    status: string;
    health: string;
    cycle_count: number;
    time_left?: string;
  }>;
  gpu: Array<{
    name: string;
    usage: number;
    memory_used?: number;
    memory_total?: number;
  }>;
  processes?: Array<{
    name: string;
    pid: number;
    cpu: number;
    memory: number;
    command?: string;
  }>;
  top_processes?: Array<{
    name: string;
    pid: number;
    cpu: number;
    memory: number;
    command?: string;
  }>;
  hardware?: HardwareInfo;
  health_score: number;
}

export interface CleanCategory {
  section: string;
  name: string;
  icon: string;
  color: string;
  size: number;
  fileCount: number;
  items: string[];
  cleanable: boolean;
  scanned: boolean;
}

export type PageId = 'home' | 'mymac' | 'clean' | 'uninstall' | 'optimize' | 'analyze';

export interface PageConfig {
  title: string;
  description: string;
  icon: string;
  buttonText: string;
  items: Array<{
    icon: string;
    title: string;
    description: string;
  }>;
}
