import { motion } from 'motion/react';
import { ArrowRight, Check, ExternalLink, FolderOpen, HardDrive, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react';
import type { PermissionStatus } from '@/types';

interface OnboardingModalProps {
  fullDiskAccess: PermissionStatus;
  loading: boolean;
  onOpenFda: () => void;
  onRequestFiles: () => void;
  onRecheck: () => void;
  onDone: () => void;
}

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const PERM_CARD = 'rounded-2xl border border-slate-200/70 bg-white/70 p-4';
const PERM_ACTION = 'inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-white/80 px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-white';

export function OnboardingModal({ fullDiskAccess, loading, onOpenFda, onRequestFiles, onRecheck, onDone }: OnboardingModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <motion.div
        className="absolute inset-0 bg-slate-950/30 backdrop-blur-md"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.25, ease: EASE }}
        onClick={onDone}
        aria-hidden="true"
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Set up permissions"
        className="relative w-full max-w-md overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/85 p-7 shadow-[0_40px_120px_rgba(83,76,148,0.28)] backdrop-blur-2xl"
        initial={{ opacity: 0, y: 18, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: EASE }}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_22%_-10%,rgba(140,63,252,0.16),transparent_45%),radial-gradient(circle_at_100%_0%,rgba(253,45,134,0.10),transparent_40%)]" />

        <div className="relative">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-[0_14px_34px_rgba(124,58,237,0.4)]">
            <Sparkles className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-[1.5rem] font-black leading-tight tracking-[-0.03em] text-slate-950">
            Let&apos;s get Mole ready
          </h2>
          <p className="mt-1.5 text-sm font-medium leading-relaxed text-slate-500">
            To scan and clean your Mac, Mole needs a couple of macOS permissions. You only do this once, and you stay in control.
          </p>

          <div className="mt-5 space-y-3">
            <div className={PERM_CARD}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-600">
                    <HardDrive className="h-[18px] w-[18px]" />
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-slate-900">Full Disk Access</div>
                    <p className="mt-0.5 text-xs font-medium leading-relaxed text-slate-500">
                      So we can find junk in protected spots. Flip Mole on in System Settings.
                    </p>
                  </div>
                </div>
                {fullDiskAccess === 'granted' && <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-500" />}
              </div>
              {fullDiskAccess !== 'granted' && (
                <button type="button" className={`${PERM_ACTION} mt-3`} onClick={onOpenFda}>
                  <ExternalLink className="h-3.5 w-3.5" /> Open System Settings
                </button>
              )}
            </div>

            <div className={PERM_CARD}>
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-600">
                  <FolderOpen className="h-[18px] w-[18px]" />
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-slate-900">Files &amp; Folders</div>
                  <p className="mt-0.5 text-xs font-medium leading-relaxed text-slate-500">
                    So we can tidy your Desktop, Documents, and Downloads. macOS will ask, just tap Allow.
                  </p>
                </div>
              </div>
              <button type="button" className={`${PERM_ACTION} mt-3`} onClick={onRequestFiles}>
                <Check className="h-3.5 w-3.5" /> Allow file access
              </button>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between gap-3">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 transition hover:text-slate-800"
              onClick={onRecheck}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Re-check
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-full bg-violet-600 px-6 py-2.5 text-sm font-bold text-white shadow-[0_14px_34px_rgba(124,58,237,0.35)] transition hover:bg-violet-700 active:scale-[0.99]"
              onClick={onDone}
            >
              Continue <ArrowRight className="h-4 w-4" />
            </button>
          </div>
          <p className="relative mt-3 text-center text-[11px] font-medium text-slate-400">
            You can change these anytime in Settings &rarr; Permissions.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
