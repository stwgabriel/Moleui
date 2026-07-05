import { SignIn } from '@clerk/clerk-react';
import { AnimatePresence, motion } from 'motion/react';

// Shared easing for the logo-rise / form-reveal choreography.
const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

// The sign-in surface of the single primary window. Rendered by PrimaryWindow
// only while signed out; once Clerk reports a session, PrimaryWindow swaps to the
// app in this same renderer, so there is no window hand-off to manage here.
//
// `ready` is Clerk's isLoaded: while false the logo spins as a loader; once true
// the logo rises and the sign-in form opens beneath it.
export function LoginWindow({ ready = true }: { ready?: boolean }) {
  const showForm = ready;

  return (
    <main className="mole-native-login relative h-screen overflow-y-auto overflow-x-clip text-slate-950">
      <div className="window-drag-region" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_24%_18%,rgba(140,63,252,0.18),transparent_34%),radial-gradient(circle_at_84%_12%,rgba(253,45,134,0.10),transparent_30%),radial-gradient(circle_at_70%_92%,rgba(41,115,253,0.10),transparent_38%),linear-gradient(135deg,rgba(255,255,255,0.5),rgba(246,242,255,0.55))]" />
      <div className="pointer-events-none absolute left-[12%] top-[15%] h-72 w-72 rounded-full bg-violet-200/30 blur-3xl" />
      <div className="pointer-events-none absolute right-[14%] top-[10%] h-64 w-64 rounded-full bg-pink-100/40 blur-3xl" />

      <section className="relative flex h-full min-h-0 items-center justify-center px-8 pb-10 pt-12">
        <div className="flex w-full max-w-[360px] min-w-0 flex-col items-center">
          <motion.div
            layout
            transition={{ duration: 0.55, ease: EASE }}
            className="relative flex h-24 w-24 shrink-0 items-center justify-center"
          >
            <AnimatePresence>
              {!showForm && (
                <motion.span
                  key="loader-ring"
                  aria-hidden="true"
                  className="absolute inset-0 animate-spin rounded-full border-4 border-violet-200/55 border-t-violet-600"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3, ease: EASE }}
                />
              )}
            </AnimatePresence>
            <motion.img
              src="./assets/images/rounded-logo.png"
              alt="Moleui"
              className="h-20 w-20 object-contain drop-shadow-[0_18px_38px_rgba(109,93,252,0.18)]"
              draggable={false}
              animate={{ scale: showForm ? 1.2 : 1 }}
              transition={{ duration: 0.55, ease: EASE }}
            />
          </motion.div>

          <AnimatePresence>
            {showForm && (
              <motion.div
                key="login-form"
                className="w-full min-w-0"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.45, ease: EASE, delay: 0.12 }}
              >
                <h1 className="mb-8 mt-5 text-center text-[2rem] font-semibold tracking-[-0.045em] text-slate-950">
                  Sign in to Moleui
                </h1>

                <div className="mole-native-login-form w-full min-w-0">
                  <SignIn
                    routing="hash"
                    appearance={{
                      variables: {
                        colorPrimary: '#8c3ffc',
                        colorText: '#202936',
                        colorTextSecondary: '#5a6473',
                        colorBackground: 'transparent',
                        borderRadius: '0.75rem',
                        fontFamily: 'DM Sans, -apple-system, BlinkMacSystemFont, Segoe UI, system-ui, sans-serif',
                      },
                      elements: {
                        rootBox: 'w-full',
                        cardBox: 'w-full shadow-none',
                        card: 'w-full border-0 bg-transparent p-0 shadow-none',
                        header: 'hidden',
                        headerTitle: 'hidden',
                        headerSubtitle: 'hidden',
                        logoBox: 'hidden',
                        main: 'gap-4',
                        socialButtonsBlockButton: 'h-11 rounded-xl border border-slate-200/80 bg-white/70 text-sm font-semibold text-slate-800 shadow-sm backdrop-blur transition hover:bg-white',
                        dividerLine: 'bg-slate-200/80',
                        dividerText: 'text-xs font-semibold text-slate-400',
                        formField: 'space-y-2',
                        formFieldLabel: 'text-[13px] font-medium text-slate-700',
                        formFieldInput: 'h-11 rounded-xl border border-slate-300/80 bg-white/82 px-3 text-[15px] font-medium text-slate-950 shadow-[inset_0_1px_2px_rgba(15,23,42,0.05)] outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20',
                        formButtonPrimary: 'h-11 rounded-xl bg-violet-600 text-[15px] font-semibold text-white shadow-[0_10px_22px_rgba(140,63,252,0.22)] transition hover:bg-violet-700 active:scale-[0.99]',
                        footer: 'hidden',
                        footerPages: 'hidden',
                        footerAction: 'hidden',
                        formResendCodeLink: 'text-violet-700 font-semibold',
                        identityPreview: 'rounded-xl border border-slate-200/80 bg-white/70 shadow-sm',
                        identityPreviewEditButton: 'text-violet-700 font-semibold',
                      },
                    }}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>
    </main>
  );
}
