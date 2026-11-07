import { Component, type ReactNode } from 'react';
import { isChunkError, reloadOnce } from '../lib/chunkReload';
import { backoffDelay, isPermanentError } from '../data/resilient';

interface Props {
  children: ReactNode;
  /** Shown after repeated failures, in place of the default inline message. */
  fallback?: ReactNode;
  /** Short label for the default message, e.g. "places". */
  label?: string;
  /** Shown while silently retrying. */
  pending?: ReactNode;
  giveUpMs?: number;
  className?: string;
}
interface State { failed: boolean; gaveUp: boolean; attempt: number; firstFailAt: number | null }

/**
 * Catches render errors (Convex queries throw them), waits with backoff, then remounts the subtree.
 * Only after ~1 minute of failures does it show a gentle inline message with "Try again".
 */
export default class RetryBoundary extends Component<Props, State> {
  state: State = { failed: false, gaveUp: false, attempt: 0, firstFailAt: null };
  private timer?: ReturnType<typeof setTimeout>;
  private healthy?: ReturnType<typeof setTimeout>;

  static getDerivedStateFromError(): Partial<State> { return { failed: true }; }

  componentDidCatch(error: unknown) {
    console.warn('RetryBoundary caught error:', error);
    clearTimeout(this.healthy);
    if (isChunkError(error) && reloadOnce()) return; // stale chunk after a deploy: reload once
    const now = Date.now();
    if (isPermanentError(error)) { this.setState({ gaveUp: true, firstFailAt: now }); return; }
    const first = this.state.firstFailAt ?? now;
    const { giveUpMs = 60_000 } = this.props;
    if (now - first >= giveUpMs) { this.setState({ gaveUp: true, firstFailAt: first }); return; }
    this.setState({ firstFailAt: first });
    this.timer = setTimeout(() => {
      this.setState(s => ({ failed: false, attempt: s.attempt + 1 }));
      // If the remounted subtree survives a while, forget the failure streak.
      this.healthy = setTimeout(() => this.setState({ attempt: 0, firstFailAt: null }), 10_000);
    }, backoffDelay(this.state.attempt));
  }

  componentWillUnmount() { clearTimeout(this.timer); clearTimeout(this.healthy); }

  private retry = () => {
    clearTimeout(this.timer);
    this.setState({ failed: false, gaveUp: false, attempt: 0, firstFailAt: null });
  };

  render() {
    const { failed, gaveUp, attempt } = this.state;
    if (!failed) return <RetryKey key={attempt}>{this.props.children}</RetryKey>;
    if (!gaveUp) {
      return this.props.pending ?? <div aria-busy="true" className={`min-h-16 animate-pulse rounded-xl bg-rock-50 ${this.props.className ?? ''}`} />;
    }
    return (
      <div role="status" className={`rounded-xl border border-rock-300 bg-rock-50 p-4 text-center ${this.props.className ?? ''}`}>
        {this.props.fallback ?? <p className="text-sm text-dusk">Still reconnecting{this.props.label ? ` to ${this.props.label}` : ''}…</p>}
        <button
          type="button" onClick={this.retry}
          className="mt-3 rounded-full bg-rock-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-rock-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-alpine-500"
        >
          Try again
        </button>
      </div>
    );
  }
}

const RetryKey = ({ children }: { children: ReactNode }) => <>{children}</>;
