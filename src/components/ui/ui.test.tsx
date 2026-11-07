import { renderToStaticMarkup as html } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Badge } from './Badge';
import { Button } from './Button';
import { Chip } from './Chip';
import { Field, Input } from './fields';
import { nextIndex, Segmented } from './Segmented';

describe('Button', () => {
  it('renders a link when given href', () => {
    expect(html(<Button href="#/results">Go</Button>)).toMatch(/^<a [^>]*href="#\/results"/);
  });
  it('defaults to type=button so it never submits a form by accident', () => {
    expect(html(<Button>Go</Button>)).toContain('type="button"');
  });
  it('is disabled and busy while loading', () => {
    const out = html(<Button loading>Save</Button>);
    expect(out).toContain('disabled=""');
    expect(out).toContain('aria-busy="true"');
  });
});

describe('Field', () => {
  it('ties label, hint and error to the control', () => {
    const out = html(<Field label="Email" hint="Hint" error="Bad"><Input /></Field>);
    const id = out.match(/<label for="([^"]+)"/)![1];
    const describedBy = out.match(/aria-describedby="([^"]+)"/)![1].split(' ');
    expect(out).toContain(`id="${id}"`);
    expect(out).toContain('aria-invalid="true"');
    expect(describedBy).toHaveLength(2);
    for (const part of describedBy) expect(out).toContain(`<p id="${part}"`);
  });
  it('marks the control invalid from the invalid prop without its own error', () => {
    const out = html(<Field label="Email" invalid><Input /></Field>);
    expect(out).toContain('aria-invalid="true"');
    expect(out).not.toContain('role="alert"');
  });
  it('marks nothing invalid without an error', () => {
    const out = html(<Field label="Email"><Input /></Field>);
    expect(out).not.toContain('aria-invalid');
    expect(out).not.toContain('aria-describedby');
  });
});

it('Chip exposes its pressed state', () => {
  expect(html(<Chip pressed>Pool</Chip>)).toContain('aria-pressed="true"');
  expect(html(<Chip pressed={false}>Pool</Chip>)).toContain('aria-pressed="false"');
});

it('Badge labels Sample and Sponsored by itself', () => {
  expect(html(<Badge tone="sample" />)).toContain('>Sample<');
  expect(html(<Badge tone="sponsored" />)).toContain('>Sponsored<');
});

describe('Segmented', () => {
  const options = [{ value: 'homes', label: 'Homes' }, { value: 'areas', label: 'Areas' }, { value: 'apts', label: 'Apartments' }];
  it('keeps only the selected option in the tab order', () => {
    const out = html(<Segmented label="Show" options={options} value="areas" onChange={() => {}} />);
    expect(out.match(/tabindex="0"/g)).toHaveLength(1);
    expect(out).toMatch(/aria-checked="true" tabindex="0"[^>]*>Areas/);
  });
  it('wraps arrows and jumps with Home and End', () => {
    expect(nextIndex('ArrowRight', 2, 3)).toBe(0);
    expect(nextIndex('ArrowLeft', 0, 3)).toBe(2);
    expect(nextIndex('Home', 2, 3)).toBe(0);
    expect(nextIndex('End', 0, 3)).toBe(2);
    expect(nextIndex('a', 0, 3)).toBeNull();
  });
});
