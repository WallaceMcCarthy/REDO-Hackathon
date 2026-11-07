/** Size it with className. Decorative, so put aria-busy on the region that is loading. */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-control bg-rock-100 motion-reduce:animate-none ${className}`} />;
}
