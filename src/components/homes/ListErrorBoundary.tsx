import { Component, type ReactNode } from 'react';
import { BTN_PRIMARY } from './ui';

export default class ListErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="rounded-xl border border-rock-300 bg-rock-50 p-6 text-center">
        <h2 className="font-display text-xl text-ink">We couldn’t load places</h2>
        <p className="mt-1 text-sm text-dusk">Something went wrong reaching the data. Try again in a moment.</p>
        <button type="button" onClick={() => this.setState({ failed: false })} className={`${BTN_PRIMARY} mt-4`}>Try again</button>
      </div>
    );
  }
}
