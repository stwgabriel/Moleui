export function MissingClientConfig() {
  return (
    <main className="flex h-screen items-center justify-center bg-[#fbf9ff] p-8 text-slate-950">
      <section className="max-w-xl rounded-[1.75rem] border border-white/70 bg-white/65 p-8 shadow-[0_24px_80px_rgba(109,93,252,0.14)] backdrop-blur-2xl">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-100 text-3xl font-black text-violet-700">
          M
        </div>
        <h1 className="mt-6 text-3xl font-black tracking-[-0.04em]">Connect Moleui auth first</h1>
        <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
          Add `VITE_CLERK_PUBLISHABLE_KEY` and `VITE_CONVEX_URL` to `apps/desktop/.env.local`, then restart the desktop app.
        </p>
        <p className="mt-4 rounded-2xl bg-violet-50 p-4 text-xs font-semibold leading-5 text-violet-700">
          Secrets stay out of the desktop build. Stripe secret keys and webhook secrets belong only in Convex environment variables.
        </p>
      </section>
    </main>
  );
}
