import { expect, it } from 'vitest';
// @ts-expect-error tailwind.config.js is untyped JavaScript.
import config from '../../../tailwind.config.js';

const c: Record<string, any> = config.theme.extend.colors;

const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const surfaces = { surface: c.surface, raised: c['surface-raised'], sunken: c['surface-sunken'] };

it.each(Object.entries(surfaces))('text on %s meets AA', (_, bg) => {
  for (const fg of [c.text, c['text-muted'], c.danger, c.success, c['primary-hover']]) expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
});

it('button, segmented, chip and badge pairs meet AA', () => {
  const pairs = [
    [c['on-primary'], c.primary],
    [c['on-primary'], c['primary-hover']],
    [c['on-primary'], c.danger],
    [c['text-muted'], c.rock[100]],
    [c.alpine[700], c.alpine[50]],
    [c.alpine[900], c.alpine[100]],
    [c.rock[800], c.rock[100]],
  ];
  for (const [fg, bg] of pairs) expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
});

it.each(Object.entries(surfaces))('control borders and the focus ring on %s reach 3:1', (_, bg) => {
  expect(contrast(c['border-strong'], bg)).toBeGreaterThanOrEqual(3);
  expect(contrast(c.focus, bg)).toBeGreaterThanOrEqual(3);
});
