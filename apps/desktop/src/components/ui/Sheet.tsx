import { useCallback, useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { X } from 'lucide-react';
import { cn } from '@/utils/cn';

// One dialog for the whole app.
//
// Before this, every modal in the renderer re-implemented its own chrome and none
// of them managed focus: the onboarding modal and the uninstall confirmation both
// set role/aria-modal and then let Tab walk straight out into the page behind,
// with dismissal available only by clicking an aria-hidden backdrop. Anything that
// asks for a decision has to be reachable and escapable from the keyboard, so the
// behaviour lives here once.
//
// Two constraints shaped the animation:
//
//   * Entrance is opacity only. A transform on an ancestor silently disables
//     backdrop-filter in Chromium and forces every glass surface underneath it to
//     re-rasterize per frame. Both of those already cost this codebase a bug (see
//     the notes in index.css and StageTransition.tsx), and a sheet is exactly the
//     case that would hit them: a glass panel full of glass cards.
//
//   * The panel is inset from the top by at least 1rem so its close button never
//     lands inside the fixed window drag region.

// Only the topmost sheet reacts to Escape, so a dialog opened over a page that
// also listens for Escape does not close both.
const openStack: string[] = [];

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  /** Visible title. Rendered as the dialog's accessible name. */
  title: string;
  description?: ReactNode;
  /** Use `alertdialog` when the sheet asks to confirm something irreversible. */
  role?: 'dialog' | 'alertdialog';
  /** Sits in the header row, opposite the title. */
  headerAside?: ReactNode;
  footer?: ReactNode;
  /** Selector for the element that should hold focus when the sheet opens. */
  initialFocus?: string;
  size?: 'md' | 'lg';
  children: ReactNode;
}

export function Sheet({
  open,
  onClose,
  title,
  description,
  role = 'dialog',
  headerAside,
  footer,
  initialFocus,
  size = 'md',
  children,
}: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const id = useId();
  const titleId = `${id}-title`;
  const descriptionId = `${id}-description`;

  const focusable = useCallback(() => {
    const panel = panelRef.current;
    if (!panel) return [] as HTMLElement[];
    return [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
      (element) => element.offsetParent !== null || element === document.activeElement
    );
  }, []);

  // Remember who opened the sheet, take focus, hide the rest of the app from
  // assistive technology and from Tab, then put focus back where it was.
  useEffect(() => {
    if (!open) return;

    openStack.push(id);
    openerRef.current = document.activeElement as HTMLElement | null;
    const appRoot = document.querySelector('main');
    appRoot?.setAttribute('inert', '');
    appRoot?.setAttribute('aria-hidden', 'true');

    const target =
      (initialFocus && panelRef.current?.querySelector<HTMLElement>(initialFocus)) ||
      panelRef.current?.querySelector<HTMLElement>('[data-sheet-autofocus]') ||
      panelRef.current;
    target?.focus();

    return () => {
      const index = openStack.lastIndexOf(id);
      if (index !== -1) openStack.splice(index, 1);
      if (openStack.length === 0) {
        appRoot?.removeAttribute('inert');
        appRoot?.removeAttribute('aria-hidden');
      }
      openerRef.current?.focus?.();
    };
  }, [open, id, initialFocus]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (openStack[openStack.length - 1] !== id) return;

      if (event.key === 'Escape') {
        // Stops here so a page-level Escape handler does not also fire. Several
        // pages listen on window, and window sees bubbling events after document.
        event.stopPropagation();
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab') return;

      const elements = focusable();
      if (elements.length === 0) {
        event.preventDefault();
        return;
      }

      const first = elements[0];
      const last = elements[elements.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (!panelRef.current?.contains(active)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
        return;
      }
      if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, id, onClose, focusable]);

  if (!open) return null;

  // Deliberately no exit animation, and so deliberately no AnimatePresence.
  //
  // An exit transition here left the layer in the DOM at opacity 0 with
  // `pointer-events: auto` after closing, which is a full-screen invisible shield
  // over the page: every click underneath it silently did nothing. A dialog that
  // disappears on the frame it is dismissed is the correct trade, and it matches
  // the app's existing modals, which have no exit animation either.
  return createPortal(
    <motion.div
      key="sheet"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 pt-[max(1.5rem,4vh)] pb-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.24 }}
    >
      <div
        className="fixed inset-0 bg-slate-950/30 backdrop-blur-md"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cn(
          'relative my-auto w-full overflow-hidden rounded-[2rem] border border-white/60 bg-white/90 shadow-[0_36px_120px_rgba(15,23,42,0.28),inset_0_1px_1px_rgba(255,255,255,0.85)] backdrop-blur-2xl focus:outline-none dark:border-white/10 dark:bg-slate-900/92 dark:shadow-[0_36px_120px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.08)]',
          size === 'lg' ? 'max-w-[62rem]' : 'max-w-lg'
        )}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_82%_0%,rgba(var(--page-accent-rgb),0.14),transparent_46%)]" />

        <header className="relative flex items-start justify-between gap-4 px-6 pt-6">
          <div className="min-w-0">
            <h2
              id={titleId}
              tabIndex={-1}
              data-sheet-autofocus
              className="text-2xl font-black tracking-[-0.04em] text-slate-950 focus:outline-none dark:text-slate-100"
            >
              {title}
            </h2>
            {description && (
              <p
                id={descriptionId}
                className="mt-1.5 max-w-2xl text-sm font-medium leading-6 text-slate-600 dark:text-slate-300"
              >
                {description}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {headerAside}
            <button
              type="button"
              onClick={onClose}
              aria-label={`Close ${title}`}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/60 bg-white/60 text-slate-500 transition-colors hover:bg-white hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-white/10 dark:bg-slate-800/70 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 dark:focus-visible:ring-offset-slate-900"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </header>

        <div className="relative px-6 py-5">{children}</div>

        {footer && (
          <div className="relative border-t border-white/55 px-6 py-4 dark:border-white/10">{footer}</div>
        )}
      </div>
    </motion.div>,
    document.body
  );
}
