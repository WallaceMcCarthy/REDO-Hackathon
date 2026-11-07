import AccountMenu from '../auth/AccountMenu';

const NAV = [
  { label: 'Homes', route: 'results' },
  { label: 'Areas', route: 'results?view=areas' },
  { label: 'Roommates', route: 'roommates' },
  { label: 'Saved', route: 'saved' },
];

function Logo() {
  return (
    <a href="#/" className="flex min-h-11 items-center gap-2 rounded-control font-display text-title text-text no-underline">
      <svg viewBox="0 0 32 32" aria-hidden="true" className="size-8">
        <circle cx="23" cy="10" r="5" className="fill-rock-300" />
        <path d="M1 26l9-14 5 7 4-5 12 12z" className="fill-alpine-700" />
        <path d="M1 26l7-6 4 3 5-4 6 4 8 3z" className="fill-primary" />
      </svg>
      Utah Fit
    </a>
  );
}

/** The one site header. `route` is the hash path without "#/", and marks the current nav item. */
export function AppHeader({ route }: { route?: string }) {
  // Every Results view but Areas is homes: the Apartments tab and a single town's homes.
  const current = route?.startsWith('results') && route !== 'results?view=areas' ? 'results' : route;
  return (
    <header className="relative z-header border-b border-border bg-surface sm:sticky sm:top-0">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 px-gutter py-1.5">
        <Logo />
        <nav aria-label="Main" className="order-last flex w-full gap-1 sm:order-none sm:mr-auto sm:w-auto">
          {NAV.map(item => (
            <a
              key={item.route}
              href={`#/${item.route}`}
              aria-current={item.route === current ? 'page' : undefined}
              className="flex min-h-11 items-center rounded-control px-3 text-small font-semibold text-text-muted no-underline transition-colors first:-ml-3 hover:text-text aria-[current=page]:text-primary-hover aria-[current=page]:underline aria-[current=page]:decoration-2 aria-[current=page]:underline-offset-8 sm:first:ml-0"
            >
              {item.label}
            </a>
          ))}
        </nav>
        <AccountMenu />
      </div>
    </header>
  );
}
