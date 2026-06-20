import { AnimatePresence, motion } from 'motion/react';
import type { ReactNode } from 'react';

interface StageTransitionProps {
  /**
   * Identifies the current view. Changing it crossfades from the old view to the
   * new one (e.g. a feature's start screen -> its working view). Keep it stable
   * across renders that should NOT animate (e.g. data updates within one view).
   */
  viewKey: string;
  children: ReactNode;
}

// Crossfades between a feature page's major views (start screen <-> working view)
// so they ease in/out instead of snapping. Both views are stacked (absolute
// inset-0) so the incoming one mounts immediately and dissolves in while the
// outgoing one fades out, with no layout jump or perceptible delay.
// `initial={false}` skips the very first mount so it doesn't double-animate with
// the app's page-switch transition.
export function StageTransition({ viewKey, children }: StageTransitionProps) {
  return (
    <div className="relative h-full min-h-0">
      <AnimatePresence initial={false}>
        <motion.div
          key={viewKey}
          className="absolute inset-0"
          initial={{ opacity: 0, scale: 0.99 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.99 }}
          transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
