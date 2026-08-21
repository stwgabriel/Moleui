import { cn } from '@/utils/cn';

// The two switches on the Automations page.
//
// Amber is not available as a state colour here: `#f59e0b` is this page's accent,
// so "amber when paused, accent when running" would be the same hue twice. State is
// carried by a filled track versus an empty one, and by text, never by tint.
//
// The markup is the pattern already used by the uninstall confirmation dialog: a
// real `sr-only` input plus a decorative track. It keeps the native `disabled`
// attribute, which is what actually removes a control from the tab order, and it
// keeps `checked` where a screen reader and a test both expect to find it.

const TRACK = 'relative flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200';
const KNOB = 'absolute h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform duration-200';

const FOCUS_WITHIN =
  'focus-within:outline-none focus-within:ring-2 focus-within:ring-[var(--page-accent)] focus-within:ring-offset-2 focus-within:ring-offset-white dark:focus-within:ring-offset-slate-900';

/**
 * Per-recipe enable switch. Stays natively disabled until the main process has
 * reported a passing dry run, and points at the reason when it has not.
 */
export function EnableSwitch({
  checked,
  disabled,
  label,
  describedBy,
  onChange,
}: {
  checked: boolean;
  disabled: boolean;
  /** Accessible name. Kept verbatim so it stays the contract it always was. */
  label: string;
  describedBy?: string;
  onChange: (next: boolean) => void;
}) {
  return (
    <label
      className={cn(
        'inline-flex items-center gap-2 rounded-full text-[0.78rem] font-bold',
        FOCUS_WITHIN,
        disabled ? 'cursor-not-allowed text-slate-400 dark:text-slate-500' : 'cursor-pointer text-slate-700 dark:text-slate-200'
      )}
    >
      <input
        type="checkbox"
        role="switch"
        className="sr-only"
        checked={checked}
        disabled={disabled}
        aria-label={label}
        aria-describedby={describedBy}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span
        aria-hidden="true"
        className={cn(
          TRACK,
          checked
            ? 'bg-[var(--page-accent)] shadow-[0_6px_16px_rgba(var(--page-accent-rgb),0.34)]'
            : 'border border-white/60 bg-white/45 dark:border-white/10 dark:bg-slate-950/40'
        )}
      >
        <span className={cn(KNOB, checked ? 'translate-x-[1.15rem]' : 'translate-x-[0.2rem] bg-slate-400')} />
      </span>
      {/* "Enable", not "Enabled": the visible text has to be contained in the
          accessible name, and the name is "Enable <recipe>". */}
      <span aria-hidden="true">Enable</span>
    </label>
  );
}

/**
 * The page-level kill switch. A plain button, because the accessible name is the
 * action it performs and the state is carried by the description beside it; naming
 * it for the action and also marking it pressed would announce both at once.
 */
export function MasterSwitch({
  paused,
  describedBy,
  onToggle,
}: {
  paused: boolean;
  describedBy?: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-describedby={describedBy}
      className={cn(
        'inline-flex items-center gap-2.5 rounded-full border border-white/60 bg-white/50 px-3 py-1.5 text-[0.8rem] font-bold text-slate-700 backdrop-blur-xl transition-colors hover:bg-white/75 dark:border-white/10 dark:bg-slate-900/50 dark:text-slate-200 dark:hover:bg-slate-800/70',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900'
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          TRACK,
          paused
            ? 'border border-white/60 bg-white/45 dark:border-white/10 dark:bg-slate-950/40'
            : 'bg-[var(--page-accent)] shadow-[0_6px_16px_rgba(var(--page-accent-rgb),0.34)]'
        )}
      >
        <span className={cn(KNOB, paused ? 'translate-x-[0.2rem] bg-slate-400' : 'translate-x-[1.15rem]')} />
      </span>
      {paused ? 'Paused, resume all' : 'Pause all'}
    </button>
  );
}
