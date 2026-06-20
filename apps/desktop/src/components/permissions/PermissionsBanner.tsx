import { ArrowRight, ShieldAlert, X } from 'lucide-react';

interface PermissionsBannerProps {
  onOpen: () => void;
  onDismiss: () => void;
}

// Slim banner shown when a required permission (Full Disk Access) is missing while
// system-level cleanup is enabled, nudging the user to grant it.
export function PermissionsBanner({ onOpen, onDismiss }: PermissionsBannerProps) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-amber-200/80 bg-amber-50/85 px-4 py-2.5 shadow-[0_10px_30px_rgba(245,158,11,0.12)] backdrop-blur-xl">
      <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600" />
      <p className="min-w-0 flex-1 truncate text-sm font-semibold text-amber-800">
        Full Disk Access is off, so Mole can&apos;t clean everything.
      </p>
      <button
        type="button"
        onClick={onOpen}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-amber-500 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-amber-600"
      >
        Grant access <ArrowRight className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="shrink-0 rounded-full p-1 text-amber-700/70 transition hover:bg-amber-100 hover:text-amber-900"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
