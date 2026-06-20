import { Check, ExternalLink, FolderOpen, HardDrive, RefreshCw, ShieldAlert, ShieldCheck } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import type { PermissionStatus } from '@/types';

function StatusBadge({ status }: { status: PermissionStatus }) {
  if (status === 'granted') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-600">
        <ShieldCheck className="h-3.5 w-3.5" /> Granted
      </span>
    );
  }
  if (status === 'denied') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-2.5 py-1 text-xs font-bold text-rose-600">
        <ShieldAlert className="h-3.5 w-3.5" /> Not granted
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500">
      Unknown
    </span>
  );
}

const ROW = 'rounded-2xl border border-slate-200/70 bg-white/60 p-4 shadow-[0_8px_24px_rgba(83,76,148,0.06)]';
const ACTION = 'inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-white/70 px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-white';

export function PermissionsPanel() {
  const { fullDiskAccess, systemCleanupEnabled, loading, refresh, openSettings, requestFiles, setPrefs } = usePermissions();

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium leading-relaxed text-slate-500">
        Mole only reads and cleans where you allow it. macOS controls these toggles, so granting happens in System Settings; Mole just shows you the status and takes you there.
      </p>

      {fullDiskAccess === 'denied' && systemCleanupEnabled && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-amber-200/80 bg-amber-50/80 p-3.5 text-sm font-semibold text-amber-700">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Full Disk Access is off, so system-level cleanup is limited. Grant it for a complete clean, or turn off system cleanup below.</span>
        </div>
      )}

      {/* Full Disk Access */}
      <div className={ROW}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-600">
              <HardDrive className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className="text-sm font-bold text-slate-900">Full Disk Access</div>
              <p className="mt-0.5 text-xs font-medium leading-relaxed text-slate-500">
                Lets Mole find caches and leftovers in protected areas and other apps' data. Required for a deep clean.
              </p>
            </div>
          </div>
          <StatusBadge status={fullDiskAccess} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className={ACTION} onClick={() => openSettings('fullDiskAccess')}>
            <ExternalLink className="h-3.5 w-3.5" /> Open System Settings
          </button>
          <button type="button" className={ACTION} onClick={() => void refresh()} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Re-check
          </button>
        </div>
      </div>

      {/* Files & Folders */}
      <div className={ROW}>
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-600">
            <FolderOpen className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <div className="text-sm font-bold text-slate-900">Files &amp; Folders</div>
            <p className="mt-0.5 text-xs font-medium leading-relaxed text-slate-500">
              Lets Mole scan your Desktop, Documents, and Downloads. macOS asks the first time Mole reads them.
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className={ACTION} onClick={() => void requestFiles()}>
            <Check className="h-3.5 w-3.5" /> Request access
          </button>
          <button type="button" className={ACTION} onClick={() => openSettings('filesAndFolders')}>
            <ExternalLink className="h-3.5 w-3.5" /> Open System Settings
          </button>
        </div>
      </div>

      {/* App-level opt out */}
      <label className={`flex cursor-pointer items-center justify-between gap-3 ${ROW}`}>
        <div className="min-w-0">
          <div className="text-sm font-bold text-slate-900">Include system-level cleanup</div>
          <p className="mt-0.5 text-xs font-medium leading-relaxed text-slate-500">
            When on, Mole also cleans system caches and logs (needs Full Disk Access). Turn off to keep cleanup to your user account only.
          </p>
        </div>
        <input
          type="checkbox"
          checked={systemCleanupEnabled}
          onChange={(event) => void setPrefs({ systemCleanupEnabled: event.target.checked })}
          className="h-5 w-5 shrink-0 accent-violet-600"
        />
      </label>
    </div>
  );
}
