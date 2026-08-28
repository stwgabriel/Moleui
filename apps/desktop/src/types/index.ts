// Electron IPC types
export interface MoleResult {
  ok: boolean;
  killed?: boolean;
  command: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
}

export type DesktopOperationId = 'status' | 'clean' | 'optimize' | 'analyze' | 'uninstall' | 'repos';
export type DesktopOperationCapability = 'status' | 'plan' | 'execute' | 'cancel' | 'stream';
export type DesktopOperationState = 'idle' | 'running';

export interface DesktopOperationStatus {
  id: DesktopOperationId;
  label: string;
  capabilities: DesktopOperationCapability[];
  state: DesktopOperationState;
}

export interface DesktopOperationsStatus {
  version: 1;
  runtime: {
    packaged: boolean;
    path: string;
  };
  operations: DesktopOperationStatus[];
}

export interface OptimizePlanTask {
  id: string;
  name: string;
  description: string;
  category: 'system';
  state: 'available' | 'blocked';
  safe: boolean;
}

export interface OptimizeOperationPlan {
  version: 1;
  operation: 'optimize';
  status: 'ready' | 'error';
  summary: {
    available: number;
    blocked: number;
  };
  system: {
    memoryUsedGb?: number;
    memoryTotalGb?: number;
    diskUsedGb?: number;
    diskTotalGb?: number;
    diskUsedPercent?: number;
    uptimeDays?: number;
  };
  tasks: OptimizePlanTask[];
}

export type OperationPlanResult =
  | { ok: true; operation: 'optimize'; plan: OptimizeOperationPlan }
  | { ok: false; operation: string; error: string };

export interface DesktopOperationEvent {
  at: string;
  operation: DesktopOperationId;
  type: 'start' | 'stdout' | 'stderr' | 'complete' | 'cancelled';
  text?: string;
  taskIds?: string[];
  ok?: boolean;
  exitCode?: number | null;
}

export interface MyMacMetricsCache {
  metrics: string;
  history?: string;
  batteryHistory?: string;
  cpuHistory?: string;
  memoryHistory?: string;
  timestamp: number;
}

export interface BackgroundSystemRun {
  startedAt: string;
  finishedAt: string;
  ok: boolean;
  durationMs: number;
  message: string;
}

export interface BackgroundSystemStatus {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  active: boolean;
  schedule: string;
  lastRun: BackgroundSystemRun | null;
  recentRuns: BackgroundSystemRun[];
}

// ─── Automations ─────────────────────────────────────────────────────────────
// Mirrors the schema normalized in main.mjs. The main process is the only
// authority on what may run; these types exist so the renderer can render it.

export type AutomationActionKind = 'clean' | 'installer';
export type AutomationFrequency = 'daily' | 'weekly';

export interface AutomationAction {
  kind: AutomationActionKind;
  sections: string[];
}

export interface AutomationSchedule {
  frequency: AutomationFrequency;
  hour: number;
  minute: number;
  /** 0 = Sunday. Only meaningful when frequency is 'weekly'. */
  weekday: number;
}

export interface AutomationRecipe {
  id: string;
  catalogId: string;
  name: string;
  enabled: boolean;
  /** Set when stored data could not be fully recovered; can never be enabled or run. */
  invalid: boolean;
  action: AutomationAction;
  schedule: AutomationSchedule;
  dryRunPassedAt: string | null;
  dryRunFingerprint: string;
  lastRunAt: string | null;
  createdAt: string;
  nextRunAt: string | null;
}

export interface AutomationRun {
  id: string;
  recipeId: string;
  recipeName: string;
  startedAt: string;
  finishedAt: string;
  ok: boolean;
  durationMs: number;
  dryRun: boolean;
  trigger: 'scheduled' | 'manual';
  message: string;
}

export interface AutomationsState {
  version: number;
  paused: boolean;
  recipes: AutomationRecipe[];
  runs: AutomationRun[];
  allowlist: {
    cleanSections: string[];
    actionKinds: AutomationActionKind[];
  };
  scheduler: {
    running: boolean;
    active: boolean;
  };
}

export interface AutomationRecipeInput {
  id?: string;
  catalogId?: string;
  name: string;
  action: AutomationAction;
  schedule: AutomationSchedule;
}

export interface AutomationMutationResult {
  ok: boolean;
  id?: string;
  message?: string;
  output?: string;
  state: AutomationsState;
}

export interface CliMonitorEvent {
  id: string;
  at: string;
  runId?: number;
  type: 'start' | 'stdout' | 'stderr' | 'close' | 'cancel' | 'error' | 'clear';
  command: string;
  text?: string;
  exitCode?: number | null;
  ok?: boolean;
  durationMs?: number;
  processId?: string | null;
}

export interface AppIconRequest {
  path: string;
  name?: string;
  bundle_id?: string;
  uninstall_name?: string;
  source?: string;
}

export type ThemePreference = 'system' | 'light' | 'dark';

export interface AppIconOption {
  id: string;
  label: string;
  /** Renderer-relative path of the flattened preview image. */
  preview: string;
}

export type AppUpdateStatus =
  | 'disabled'
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'up-to-date'
  | 'error';

export interface AppUpdateState {
  status: AppUpdateStatus;
  currentVersion: string;
  availableVersion: string | null;
  progress: number | null;
  message: string;
  lastCheckedAt: string | null;
}

export type PermissionStatus = 'granted' | 'denied' | 'unknown';
export type PermissionPane = 'fullDiskAccess' | 'filesAndFolders' | 'automation' | 'privacy';

export interface PermissionPrefs {
  onboarded: boolean;
  systemCleanupEnabled: boolean;
}

export interface MoleDesktopAPI {
  windowMode?: string;
  getRuntimeInfo: () => Promise<{ packaged: boolean; runtimeDir: string; executable: string }>;
  auth?: {
    enterApp: () => Promise<{ ok: boolean; message?: string }>;
    enterLogin: () => Promise<{ ok: boolean; message?: string }>;
    signOut: () => Promise<{ ok: boolean; message?: string }>;
  };
  permissions?: {
    status: () => Promise<{ fullDiskAccess: PermissionStatus }>;
    getPrefs: () => Promise<PermissionPrefs>;
    setPrefs: (prefs: Partial<PermissionPrefs>) => Promise<PermissionPrefs>;
    openSettings: (pane?: PermissionPane) => Promise<{ ok: boolean }>;
    requestFiles: () => Promise<{ ok: boolean }>;
  };
  billing?: {
    detectCountry: () => Promise<{ country: string }>;
    openCheckout: (url: string) => Promise<{ ok: boolean; message?: string }>;
    openPortal: (url: string) => Promise<{ ok: boolean; message?: string }>;
    onClosed: (callback: () => void) => void;
    removeListeners: () => void;
  };
  theme?: {
    get: () => Promise<{ theme: ThemePreference }>;
    set: (theme: ThemePreference) => Promise<{ ok: boolean; theme: ThemePreference }>;
  };
  appIcon?: {
    list: () => Promise<{ icons: AppIconOption[] }>;
    get: () => Promise<{ icon: string }>;
    set: (icon: string) => Promise<{ ok: boolean; icon?: string; appliesOnQuit?: boolean; message?: string }>;
  };
  updates?: {
    getState: () => Promise<AppUpdateState>;
    check: () => Promise<AppUpdateState>;
    install: () => Promise<{ ok: boolean; message?: string }>;
    onState: (callback: (state: AppUpdateState) => void) => void;
    removeListeners: () => void;
  };
  openSettingsWindow?: () => Promise<{ ok: boolean; message?: string }>;
  openDeveloperWindow?: () => Promise<{ ok: boolean; message?: string }>;
  getSettingsProfile?: () => Promise<{ deviceName: string; user: { name: string; email: string } }>;
  getBackgroundSystems?: () => Promise<BackgroundSystemStatus[]>;
  developer?: {
    getCliEvents: () => Promise<CliMonitorEvent[]>;
    clearCliEvents: () => Promise<{ ok: boolean; message?: string }>;
    onCliEvent: (callback: (event: CliMonitorEvent) => void) => void;
    onUnlockApp: (callback: () => void) => void;
    removeListeners: () => void;
  };
  myMacCache?: {
    get: () => Promise<MyMacMetricsCache | null>;
    set: (cache: Pick<MyMacMetricsCache, 'metrics' | 'history' | 'batteryHistory'>) => Promise<{ ok: boolean; message?: string }>;
  };
  operations?: {
    status: () => Promise<DesktopOperationsStatus>;
    plan: (operation: DesktopOperationId) => Promise<OperationPlanResult>;
    execute: (
      operation: DesktopOperationId,
      request?: {
        taskIds?: string[];
        dryRun?: boolean;
        sections?: string[];
        command?: 'clean' | 'purge' | 'installer';
        all?: boolean;
      }
    ) => Promise<MoleResult>;
    cancel: (operation: DesktopOperationId) => Promise<{ ok: boolean; message: string }>;
    onEvent: (callback: (event: DesktopOperationEvent) => void) => void;
    removeListeners: () => void;
  };
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
  getProcessIcons?: (processes: Array<{ pid: number; name?: string; command?: string }>) => Promise<{ ok: boolean; icons: Record<number, string>; missing?: number[]; message?: string }>;
  runStatus: (options?: { processLimit?: number }) => Promise<MoleResult>;
  uninstall: {
    list: () => Promise<MoleResult>;
    killList: () => Promise<{ ok: boolean; message: string }>;
    getAppIcon: (appPath: string) => Promise<{ ok: boolean; icon: string; message?: string }>;
    getAppIcons: (apps: Array<string | AppIconRequest>) => Promise<{ ok: boolean; icons: Record<string, string>; message?: string }>;
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
  automations?: {
    list: () => Promise<AutomationsState>;
    saveRecipe: (recipe: AutomationRecipeInput) => Promise<AutomationMutationResult>;
    deleteRecipe: (recipeId: string) => Promise<AutomationMutationResult>;
    setEnabled: (recipeId: string, enabled: boolean) => Promise<AutomationMutationResult>;
    setPaused: (paused: boolean) => Promise<AutomationMutationResult>;
    dryRun: (recipeId: string) => Promise<AutomationMutationResult>;
    runNow: (recipeId: string) => Promise<AutomationMutationResult>;
    cancel: () => Promise<{ ok: boolean; message: string }>;
    onChanged: (callback: () => void) => void;
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
    volumes: () => Promise<{ ok: boolean; volumes: StorageVolume[]; message?: string }>;
    onStdout: (callback: (data: string) => void) => void;
    onStderr: (callback: (data: string) => void) => void;
    removeListeners: () => void;
  };
  repos?: {
    scan: (options?: { verify?: boolean; coldDays?: number; roots?: string[] }) => Promise<MoleResult>;
    killScan: () => Promise<{ ok: boolean; message: string }>;
    gate: (repoPath: string, waivers?: string[]) => Promise<MoleResult>;
    push: (paths: string[], options?: { dryRun?: boolean }) => Promise<MoleResult>;
    killPush: () => Promise<{ ok: boolean; message: string }>;
    sync: (paths: string[], options: { dryRun?: boolean; profile: string; createMissing: boolean }) => Promise<MoleResult>;
    killSync: () => Promise<{ ok: boolean; message: string }>;
    archive: (
      paths: string[],
      options?: { dryRun?: boolean; vault?: boolean; allowWarm?: boolean }
    ) => Promise<MoleResult>;
    killArchive: () => Promise<{ ok: boolean; message: string }>;
    getRoots: () => Promise<{ ok: boolean; roots: string[] }>;
    getProfiles: () => Promise<{
      ok: boolean;
      profiles: Array<{ login: string; active: boolean }>;
      profile: string;
      askBeforeCreate: boolean;
    }>;
    setSyncPreferences: (preferences: { profile?: string; askBeforeCreate?: boolean }) => Promise<{
      ok: boolean;
      profile: string;
      askBeforeCreate: boolean;
    }>;
    setRoots: (roots: string[]) => Promise<{ ok: boolean; roots: string[] }>;
    chooseRoot: () => Promise<{ ok: boolean; roots: string[] }>;
    onScanStdout: (callback: (data: string) => void) => void;
    onPushStdout: (callback: (data: string) => void) => void;
    onPushStderr: (callback: (data: string) => void) => void;
    onArchiveStdout: (callback: (data: string) => void) => void;
    onArchiveStderr: (callback: (data: string) => void) => void;
    onSyncStdout: (callback: (data: string) => void) => void;
    onSyncStderr: (callback: (data: string) => void) => void;
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
    memory_bytes?: number;
    command?: string;
  }>;
  top_processes?: Array<{
    name: string;
    pid: number;
    cpu: number;
    memory: number;
    memory_bytes?: number;
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

export type PageId = 'mymac' | 'clean' | 'automations' | 'uninstall' | 'optimize' | 'analyze' | 'repos';

// ─── Storage volumes ─────────────────────────────────────────────────────────
// Mirrors jsonVolume in cmd/analyze/volumes.go. Only browsable local volumes
// reach here; the helper volumes macOS hides from Finder are filtered out
// before the JSON is written.

export interface StorageVolume {
  name: string;
  path: string;
  fs_type: string;
  total: number;
  free: number;
  used: number;
  is_root: boolean;
  read_only: boolean;
}

// ─── Repos ───────────────────────────────────────────────────────────────────
// Mirrors the JSON emitted by cmd/repos. Keep field names in sync with the Go
// structs in cmd/repos/model.go.

export type RepoKind = 'standalone' | 'worktree' | 'nested_parent' | 'nested_child' | 'plain';

export type RepoOwnership = 'own' | 'third_party' | 'unknown' | 'none';

export type RepoPushState =
  | 'verified'
  | 'ahead'
  | 'behind'
  | 'needs_fetch'
  | 'no_upstream'
  | 'stale_upstream'
  | 'unverified';

export interface RepoRemote {
  name: string;
  url: string;
  host: string;
  owner: string;
  repo: string;
  normalized: string;
  scheme: string;
  ssh_alias?: string;
  embedded_user?: string;
  verify_ok: boolean;
  verify_error?: string;
  verify_attempted: boolean;
  /** An authenticated request could not see the remote: treat local as the only copy. */
  missing: boolean;
  /** Credentials were refused, so nothing could be confirmed either way. */
  auth_failed: boolean;
  /** "Not found" over an unauthenticated transport: deleted or private, unknown which. */
  ambiguous: boolean;
  verified_via?: string;
}

export interface RepoBranch {
  name: string;
  sha: string;
  upstream?: string;
  ahead: number;
  behind: number;
  state: RepoPushState;
  committed: string;
}

export interface RepoTag {
  name: string;
  sha: string;
  state: RepoPushState;
}

export interface RepoGate {
  id: string;
  label: string;
  ok: boolean;
  detail?: string;
}

export interface RepoWorktree {
  main_repo?: string;
  git_dir?: string;
  prunable: boolean;
  broken: boolean;
}

export interface RepoEntry {
  path: string;
  rel_path: string;
  name: string;
  root: string;
  kind: RepoKind;
  git_dir?: string;
  git_is_dir: boolean;
  worktree?: RepoWorktree;
  remote: RepoRemote | null;
  ownership: RepoOwnership;
  /** Other local directories pointing at the same remote. */
  shared_with?: string[];
  other_remotes?: string[];
  head_branch?: string;
  head_sha?: string;
  has_commits: boolean;
  detached: boolean;
  bare_or_empty: boolean;
  branches?: RepoBranch[];
  tags?: RepoTag[];
  stashes: number;
  dirty: { tracked: number; untracked: number; total: number };
  submodules: { count: number; dirty: number };
  activity: { last: string; source: string; days_idle: number; cold: boolean };
  /** total_kb includes nested repos; exclusive_kb is what archiving would reclaim. */
  size: { total_kb: number; exclusive_kb: number };
  local_only_files?: string[];
  children?: string[];
  parent?: string;
  markers?: string[];
  gates: RepoGate[];
  archivable: boolean;
  blocked_by?: string[];
  needs_push: boolean;
  push_branches?: string[];
  push_blocked: boolean;
  push_blocked_by?: string;
  scan_error?: string;
}

export interface RepoSummary {
  total: number;
  repos: number;
  plain: number;
  worktrees: number;
  no_remote: number;
  third_party: number;
  needs_push: number;
  dirty: number;
  cold: number;
  archivable: number;
  reclaimable_kb: number;
  total_kb: number;
  remote_conflict: number;
  unverified: number;
  remote_missing: number;
  auth_failed: number;
  no_backup: number;
}

export interface RepoMoveProposal {
  from: string;
  to: string;
  reason: string;
  risk: string;
  safe: boolean;
}

export interface RepoReport {
  version: number;
  scanned_at: string;
  roots: string[];
  cold_days: number;
  verified: boolean;
  entries: RepoEntry[];
  summary: RepoSummary;
  organize?: RepoMoveProposal[];
  warnings?: string[];
  duration_ms: number;
}

export interface RepoScanOptions {
  verify?: boolean;
  coldDays?: number;
  roots?: string[];
}

export interface RepoPushResult extends MoleResult {
  /** Parsed per-repository outcome lines, when the CLI produced them. */
  pushed?: number;
  failed?: number;
}

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
