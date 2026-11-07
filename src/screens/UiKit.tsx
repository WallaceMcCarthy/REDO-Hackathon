import { useState, type ReactNode } from 'react';
import { AppHeader, Badge, Button, Card, Chip, EmptyState, Field, Input, PageHeader, Segmented, Select, Skeleton, Textarea } from '../components/ui';

const COLORS = ['surface', 'surface-raised', 'surface-sunken', 'border', 'border-strong', 'text', 'text-muted', 'primary', 'primary-hover', 'danger', 'success', 'focus'];
// Spelled out so Tailwind's scanner generates each class.
const SWATCH: Record<string, string> = {
  surface: 'bg-surface', 'surface-raised': 'bg-surface-raised', 'surface-sunken': 'bg-surface-sunken', border: 'bg-border', 'border-strong': 'bg-border-strong',
  text: 'bg-text', 'text-muted': 'bg-text-muted', primary: 'bg-primary', 'primary-hover': 'bg-primary-hover', danger: 'bg-danger', success: 'bg-success', focus: 'bg-focus',
};
const TYPE = [
  ['text-display font-display', 'display', 'Homes in Heber'],
  ['text-heading font-display', 'heading', 'Homes in Heber'],
  ['text-title font-display', 'title', 'Three bedrooms near the river'],
  ['text-body', 'body', 'Quiet street, ten minutes from the trailhead.'],
  ['text-small', 'small', 'Listed four days ago'],
  ['text-caption', 'caption', 'Source: Utah Geological Survey, 2024'],
];
const VIEWS = [{ value: 'homes', label: 'Homes' }, { value: 'apartments', label: 'Apartments' }, { value: 'areas', label: 'Areas' }] as const;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-section">
      <h2 className="font-display text-title text-text">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}
const Row = ({ children }: { children: ReactNode }) => <div className="mt-3 flex flex-wrap items-center gap-3">{children}</div>;

export default function UiKit() {
  const [view, setView] = useState<(typeof VIEWS)[number]['value']>('homes');
  const [chips, setChips] = useState(['Garage']);
  const toggle = (name: string) => setChips(on => (on.includes(name) ? on.filter(c => c !== name) : [...on, name]));

  return (
    <>
      <AppHeader route="results" />
      <main className="mx-auto max-w-6xl px-gutter pb-section pt-stack">
        <PageHeader title="Utah Fit components" description="Every shared component in every state. Tab through the page to see the focus ring." />

        <Section title="Color">
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {COLORS.map(name => (
              <li key={name} className="text-caption text-text-muted">
                <div className={`h-12 rounded-control border border-border ${SWATCH[name]}`} />
                <span className="mt-1 block">{name}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Type">
          <div className="space-y-3">
            {TYPE.map(([cls, name, sample]) => (
              <div key={name}>
                <p className="text-caption text-text-muted">{name}</p>
                <p className={`${cls} text-text`}>{sample}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Button">
          <Row>
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Delete account</Button>
          </Row>
          <Row>
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
          </Row>
          <Row>
            <Button loading>Saving</Button>
            <Button variant="secondary" loading>Saving</Button>
            <Button disabled>Disabled</Button>
            <Button variant="secondary" disabled>Disabled</Button>
            <Button variant="danger" disabled>Disabled</Button>
          </Row>
          <Row>
            <Button href="#/results">Link as button</Button>
            <Button href="#/results" variant="secondary">Secondary link</Button>
            <Button className="outline outline-2 outline-offset-2 outline-focus">Focused</Button>
          </Row>
          <div className="mt-3 max-w-sm"><Button fullWidth>Full width</Button></div>
        </Section>

        <Section title="Field, Input, Select, Textarea">
          <div className="grid gap-stack md:grid-cols-2">
            <Field label="Default"><Input placeholder="you@example.com" /></Field>
            <Field label="With hint" hint="At least 8 characters."><Input type="password" /></Field>
            <Field label="With error" error="Enter an email like name@example.com."><Input defaultValue="not-an-email" /></Field>
            <Field label="Disabled"><Input disabled defaultValue="Salt Lake City" /></Field>
            <Field label="Select" hint="Sorted by best fit first.">
              <Select defaultValue="fit"><option value="fit">Best fit</option><option value="price">Lowest price</option></Select>
            </Field>
            <Field label="Select with error" error="Pick a county.">
              <Select defaultValue=""><option value="" disabled>Choose a county</option><option>Wasatch</option></Select>
            </Field>
            <Field label="Textarea" hint="Shown to possible roommates."><Textarea placeholder="Early riser, two dogs" /></Field>
            <Field label="Textarea with error" error="Keep this under 280 characters."><Textarea defaultValue="Too long" /></Field>
          </div>
        </Section>

        <Section title="Card">
          <div className="grid gap-4 md:grid-cols-3">
            <Card><p className="font-display text-title">Flat</p><p className="text-small text-text-muted">The default, for lists.</p></Card>
            <Card raised><p className="font-display text-title">Raised</p><p className="text-small text-text-muted">One focal card per view.</p></Card>
            <Card padded={false}>
              <div className="h-16 bg-alpine-100" />
              <p className="p-5 text-small text-text-muted">Unpadded, for a photo that runs to the edge.</p>
            </Card>
          </div>
        </Section>

        <Section title="Chip">
          <Row>
            {['Garage', 'Yard', 'Near trails'].map(name => (
              <Chip key={name} pressed={chips.includes(name)} onClick={() => toggle(name)}>{name}</Chip>
            ))}
            <Chip pressed={false} disabled>Disabled</Chip>
            <Chip pressed disabled>Disabled on</Chip>
          </Row>
        </Section>

        <Section title="Badge">
          <Row>
            <Badge tone="sample" />
            <Badge tone="sponsored" />
            <Badge>3 beds</Badge>
          </Row>
        </Section>

        <Section title="Segmented">
          <div className="max-w-md">
            <Segmented label="Show" options={VIEWS} value={view} onChange={setView} />
          </div>
          <p className="mt-2 text-small text-text-muted">Showing {view}. Arrow keys, Home and End move the selection.</p>
        </Section>

        <Section title="EmptyState">
          <div className="grid gap-4 md:grid-cols-2">
            <EmptyState title="No homes match yet" description="Raise your budget or add a nearby town." action={<Button variant="secondary">Edit filters</Button>} />
            <EmptyState title="Nothing saved" />
          </div>
        </Section>

        <Section title="Skeleton">
          <Card aria-busy="true" className="max-w-sm space-y-3">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </Card>
        </Section>

        <Section title="PageHeader">
          <div className="space-y-stack">
            <PageHeader title="Saved homes" />
            <PageHeader title="Homes in Heber" description="24 homes, sorted by how well they fit you." actions={<><Button variant="secondary" size="sm">Share</Button><Button size="sm">Save search</Button></>} />
          </div>
        </Section>

        <Section title="Radius and shadow">
          <Row>
            <div className="grid size-24 place-items-center rounded-control border border-border bg-surface-raised text-caption">control</div>
            <div className="grid size-24 place-items-center rounded-card border border-border bg-surface-raised text-caption">card</div>
            <div className="grid size-24 place-items-center rounded-pill border border-border bg-surface-raised text-caption">pill</div>
            <div className="grid size-24 place-items-center rounded-card bg-surface-raised text-caption shadow-raised">raised</div>
            <div className="grid size-24 place-items-center rounded-card bg-surface-raised text-caption shadow-overlay">overlay</div>
          </Row>
        </Section>
      </main>
    </>
  );
}
