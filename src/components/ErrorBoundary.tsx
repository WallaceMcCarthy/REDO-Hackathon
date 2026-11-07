import { Component, type ErrorInfo, type ReactNode } from 'react';

// Convex useQuery throws on a backend error; without this the page goes blank mid-demo.
export default class ErrorBoundary extends Component<{ children: ReactNode; onError?: (error: Error) => void }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, _info: ErrorInfo) {
    this.props.onError?.(error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main role="alert" className="mx-auto max-w-xl px-4 py-24 text-center">
        <h1 className="font-display text-3xl text-ink">We couldn’t load the towns</h1>
        <p className="mt-2 text-dusk">Something went wrong reaching the data. Reloading usually fixes it.</p>
        <button
          type="button" onClick={() => window.location.reload()}
          className="mt-6 rounded-full bg-rock-600 px-5 py-2 text-sm font-semibold text-white hover:bg-rock-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-alpine-500"
        >
          Reload
        </button>
      </main>
    );
  }
}
