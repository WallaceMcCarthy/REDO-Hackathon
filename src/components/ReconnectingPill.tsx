import { useIsReconnecting } from '../data/resilient';

export default function ReconnectingPill() {
  if (!useIsReconnecting()) return null;
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed bottom-3 left-1/2 z-50 -translate-x-1/2 rounded-full bg-ink/80 px-3 py-1 text-xs font-medium text-white shadow">
      Reconnecting…
    </div>
  );
}
