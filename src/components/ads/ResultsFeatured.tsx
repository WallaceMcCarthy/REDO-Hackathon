import { Badge, Button } from '../ui';
import { REDO_IT } from './placement';

// shortcut: REDO IT is the only advertiser here and has no campaign row, so it counts nothing; bring back pickFeatured when other advertisers return.
/** A fixed banner above the list and map, so every Results view and pane shows it and it never reads as a ranked result. */
export default function ResultsFeatured() {
  return (
    <section aria-label="Sponsored placements" className="shrink-0 border-b border-rock-100 bg-surface-raised px-4 py-2">
      <article className="flex items-center gap-3">
        <Badge tone="sponsored">Sponsored job</Badge>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-title leading-tight text-text">{REDO_IT.title}</h2>
          <p className="hidden truncate text-small text-text-muted sm:block">{REDO_IT.body}</p>
        </div>
        <Button href={REDO_IT.url} target="_blank" rel="noopener noreferrer" size="sm" className="shrink-0">
          Apply to REDO
        </Button>
      </article>
    </section>
  );
}
