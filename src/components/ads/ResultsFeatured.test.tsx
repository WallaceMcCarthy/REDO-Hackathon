import { renderToStaticMarkup as html } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import ResultsFeatured from './ResultsFeatured';

describe('ResultsFeatured', () => {
  it('shows one labelled REDO IT ad that opens its careers page', () => {
    const out = html(<ResultsFeatured />);
    expect(out.match(/<article/g)).toHaveLength(1);
    expect(out).toContain('Sponsored job');
    expect(out).toContain('REDO IT');
    expect(out).toContain('href="https://getredo.com/careers"');
    expect(out).toContain('noopener');
  });
});
