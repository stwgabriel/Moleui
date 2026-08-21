import { useEffect, useRef, useState } from 'react';
import { Check, ChevronUp, Copy, Terminal } from 'lucide-react';
import { cn } from '@/utils/cn';
import { FOCUS_RING, GLASS_BAR, META_TEXT, SECTION_LABEL } from './chrome';

// Push and archive stream their output here.
//
// It opens itself when a run fails, because the toast only carries one line while
// the per-repository detail lives in this stream. Collapsed, it keeps a count of
// lines that arrived unread, so a partial failure cannot be silent.

interface OutputDrawerProps {
  log: string[];
  /** Set when a push or archive finished unsuccessfully. */
  failedAt: number | null;
  truncated: boolean;
}

export function OutputDrawer({ log, failedAt, truncated }: OutputDrawerProps) {
  const [open, setOpen] = useState(false);
  const [readCount, setReadCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const bodyRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (failedAt !== null) setOpen(true);
  }, [failedAt]);

  useEffect(() => {
    if (open) setReadCount(log.length);
  }, [open, log.length]);

  useEffect(() => {
    if (open && bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [open, log.length]);

  if (log.length === 0) return null;

  const unread = Math.max(0, log.length - readCount);

  return (
    <div className={cn('mx-2 mb-2 shrink-0 overflow-hidden', GLASS_BAR)}>
      <div className="flex items-center gap-2 px-4 py-2">
        <button
          type="button"
          onClick={() => setOpen((previous) => !previous)}
          aria-expanded={open}
          className={cn('flex min-w-0 flex-1 items-center gap-2 rounded-full py-1 text-left', FOCUS_RING)}
        >
          <Terminal className="h-3.5 w-3.5 shrink-0 text-[var(--page-accent)]" aria-hidden="true" />
          <span className={SECTION_LABEL}>Output</span>
          {!open && unread > 0 && (
            <span className="rounded-full bg-[rgba(var(--page-accent-rgb),0.16)] px-2 py-0.5 text-[0.65rem] font-bold text-[var(--page-accent)]">
              {unread} new
            </span>
          )}
          <ChevronUp
            className={cn('ml-auto h-3.5 w-3.5 text-slate-400 transition-transform', !open && 'rotate-180')}
            aria-hidden="true"
          />
        </button>
        {open && (
          <button
            type="button"
            onClick={async () => {
              await window.moleDesktop?.copyText?.(log.join('\n'));
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1400);
            }}
            aria-label="Copy output"
            className={cn(
              'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-white/80 hover:text-slate-700 dark:hover:bg-slate-800/80 dark:hover:text-slate-200',
              FOCUS_RING
            )}
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
          </button>
        )}
      </div>

      {open && (
        <div className="border-t border-white/55 px-4 py-2 dark:border-white/10">
          {truncated && (
            <p className={cn('mb-1 text-[0.7rem]', META_TEXT)}>Earlier output was dropped to keep memory bounded.</p>
          )}
          <pre
            ref={bodyRef}
            aria-live="off"
            className="max-h-48 select-text overflow-y-auto whitespace-pre-wrap break-all font-mono text-[0.7rem] leading-relaxed text-slate-600 custom-scrollbar dark:text-slate-300"
          >
            {log.join('\n')}
          </pre>
        </div>
      )}
    </div>
  );
}
