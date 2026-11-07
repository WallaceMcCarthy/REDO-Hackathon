# UI components

Import from `src/components/ui`. Review every state at `#/ui`. Every interactive part is at least 44px tall.

Tokens: `bg-surface`, `bg-surface-raised`, `bg-surface-sunken`, `border-border`, `border-border-strong`, `text-text`, `text-text-muted`, `bg-primary`, `text-danger`, `text-success`. Type: `text-display`, `heading`, `title`, `body`, `small`, `caption`. Spacing: 4px steps, plus `gutter` (page edge), `stack` (between blocks), `section` (between sections). Radius: `rounded-control`, `card`, `pill`. Shadow: `shadow-raised`, `overlay`. Focus ring is global, so add none. Never write a hex value or `text-white`. Inline text links use `text-alpine-700 underline underline-offset-2`.

| Use | When | Example |
| --- | --- | --- |
| Button | Any action. Pass `href` to navigate. One `primary` per view. `danger` is outlined. | `<Button variant="secondary" size="sm" loading={busy}>Save</Button>` |
| Field | Wraps every form control. Wires label, hint and error. | `<Field label="Email" hint="We never share it" error={err}><Input /></Field>` |
| Input | Single-line entry, inside Field. | `<Input type="email" value={v} onChange={f} />` |
| Select | Short fixed list, inside Field. | `<Select><option>Best fit</option></Select>` |
| Textarea | Multi-line entry, inside Field. | `<Textarea rows={4} />` |
| Card | Groups one thing. Flat by default. `raised` for one focal card. | `<Card as="article" padded={false}>...</Card>` |
| Chip | On/off filter. Not for navigation. | `<Chip pressed={on} onClick={toggle}>Garage</Chip>` |
| Badge | Non-interactive label. Listings must use `sample` or `sponsored` when true. | `<Badge tone="sponsored" />` or `<Badge>3 beds</Badge>` |
| Segmented | Pick one of 2 to 4 views. Use Select for more. | `<Segmented label="Show" options={opts} value={v} onChange={setV} />` |
| EmptyState | No results. Say what to do next. | `<EmptyState title="No homes yet" action={<Button>Edit filters</Button>} />` |
| Skeleton | Loading placeholder. Put `aria-busy` on the parent. | `<Skeleton className="h-6 w-40" />` |
| PageHeader | The page's `h1`, once per screen. | `<PageHeader title="Saved homes" actions={<Button>Share</Button>} />` |
| AppHeader | Site header, once per screen. | `<AppHeader route="results" />` |

App.tsx renders the one AppHeader, and AppHeader renders AccountMenu. Do not mount a second AccountMenu: two would open two sign-in modals.

`AppHeader` takes vertical space, so a full-height screen uses `flex-1 min-h-0` inside a `h-dvh` column, not `h-dvh` on its own `main`. It sits above Leaflet through `z-header`.
