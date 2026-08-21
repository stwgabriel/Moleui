// The class strings the Repos surface shares.
//
// These are the app's frosted vocabulary, lifted verbatim from the surfaces that
// define it (the uninstall selection stage and StartScreen) rather than invented
// here: soft glass panels at generous radii, heavy tight display type over soft
// body copy, and every accent read through `--page-accent` so the page's own
// featureAccentVars is the only place a colour is chosen.

export const SOFT_CARD =
  'rounded-[1.75rem] border border-white/55 bg-white/35 backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/35';

export const ROW_CARD =
  'rounded-[1.5rem] border border-white/55 bg-white/35 backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/35';

export const CHIP_CARD =
  'rounded-[1.25rem] border border-white/60 bg-white/45 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/40';

export const GLASS_BAR =
  'rounded-[1.5rem] border border-white/55 bg-white/45 shadow-[0_18px_44px_rgba(109,93,252,0.10),inset_0_1px_0_rgba(255,255,255,0.6)] backdrop-blur-2xl dark:border-white/10 dark:bg-slate-900/55 dark:shadow-[0_18px_44px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.07)]';

export const PAGE_TITLE =
  'text-3xl font-black tracking-[-0.045em] text-slate-950 dark:text-slate-100';

export const SECTION_LABEL =
  'text-[0.7rem] font-bold uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500';

export const BODY_TEXT = 'font-medium text-slate-600 dark:text-slate-300';

export const META_TEXT = 'text-sm font-semibold text-slate-500 dark:text-slate-400';

// Required on every interactive element that is not a <Button>. The ring offset
// needs an explicit colour or it draws white on dark glass.
export const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900';

export const ACCENT_WASH =
  'pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_88%_14%,rgba(var(--page-accent-rgb),0.16),transparent_36%),radial-gradient(circle_at_12%_88%,rgba(109,93,252,0.12),transparent_38%)]';

// Entrance easing shared with the rest of the app, so this page's choreography
// reads as the same product.
export const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

// Animate the first few children of a container, then reveal the rest with it.
// The house formula caps at 0.45s, which makes everything past the ninth item pop
// as one block anyway, and a data-heavy list should not make the user wait.
export function stagger(index: number, reduce: boolean): number {
  if (reduce || index > 5) return 0;
  return index * 0.045;
}
