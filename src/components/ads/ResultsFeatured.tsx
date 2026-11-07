import { Badge, Button, Card } from '../ui';

const REDO_IT = {
  title: 'REDO IT',
  body: 'We are hiring engineers, product builders, and designers in Utah! Build software that moves mountains.',
  url: 'https://getredo.com/careers',
};

// shortcut: REDO IT is the only advertiser in this slot and has no campaign row, so it counts no impressions or clicks; bring back pickFeatured when other advertisers return.
/** The one paid placement above the ranked list, in its own labeled block so it never reads as a ranked result. */
export default function ResultsFeatured() {
  return (
    <section aria-label="Sponsored placements" className="mb-4 border-b border-border-strong pb-4">
      <h2 className="mb-2 text-caption font-semibold text-text-muted">Paid placement, not part of your ranking</h2>
      <Card as="article" raised>
        <Badge tone="sponsored" />
        <h3 className="mt-3 font-display text-4xl text-text">{REDO_IT.title}</h3>
        <p className="mt-2 text-body text-text-muted">{REDO_IT.body}</p>
        <Button href={REDO_IT.url} target="_blank" rel="noopener noreferrer" fullWidth className="mt-stack">
          Apply to REDO
        </Button>
      </Card>
    </section>
  );
}
