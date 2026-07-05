import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

// Catches render/lifecycle throws anywhere below it so an unexpected error shows
// a recoverable message instead of an all-white window. Without this, a single
// throw during startup (e.g. an unauthenticated provider hitting a null user)
// unmounts the whole tree and leaves the user staring at a blank screen.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Renderer error boundary caught:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <main className="flex h-screen flex-col items-center justify-center gap-4 px-8 text-center text-slate-800">
          <div className="window-drag-region" aria-hidden="true" />
          <h1 className="text-lg font-bold">Something went wrong</h1>
          <p className="max-w-md text-sm text-slate-500">
            The app hit an unexpected error and could not finish loading. Reloading usually fixes it.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-full bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700"
          >
            Reload
          </button>
        </main>
      );
    }

    return this.props.children;
  }
}
