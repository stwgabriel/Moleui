// Electron IPC types
export interface MoleResult {
  ok: boolean;
  command: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
}

export interface MoleDesktopAPI {
  runStatus: () => Promise<MoleResult>;
  uninstall: {
    list: () => Promise<MoleResult>;
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
    execute: (options: { dryRun: boolean }) => Promise<MoleResult>;
    onStdout: (callback: (data: string) => void) => void;
    onStderr: (callback: (data: string) => void) => void;
    removeListeners: () => void;
  };
  optimize: {
    execute: (options: { dryRun: boolean }) => Promise<MoleResult>;
    onStdout: (callback: (data: string) => void) => void;
    onStderr: (callback: (data: string) => void) => void;
    removeListeners: () => void;
  };
  analyze: {
    execute: (path: string) => Promise<MoleResult>;
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

export interface SystemMetrics {
  cpu: {
    usage: number;
    core_count: number;
    load1: number;
    load5: number;
    load15: number;
  };
  memory: {
    used: number;
    total: number;
    used_percent: number;
    pressure?: string;
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
  }>;
  gpu: Array<{
    name: string;
    usage: number;
  }>;
  top_processes?: Array<{
    name: string;
    pid: number;
    cpu: number;
    memory: number;
  }>;
  health_score: number;
}

export interface CleanCategory {
  name: string;
  icon: string;
  color: string;
  size: number;
  fileCount: number;
}

export type PageId = 'smartcare' | 'clean' | 'uninstall' | 'optimize' | 'analyze' | 'status';

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
