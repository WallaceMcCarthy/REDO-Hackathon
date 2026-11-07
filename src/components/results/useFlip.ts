import { useLayoutEffect, useRef } from 'react';

/** FLIP reorder animation for a list. Returns a ref-callback factory keyed by item id; the list container must be positioned. */
export function useFlip() {
  const els = useRef(new Map<string, HTMLElement>());
  const tops = useRef(new Map<string, number>());

  useLayoutEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const next = new Map<string, number>();
    els.current.forEach((el, id) => {
      next.set(id, el.offsetTop);
      const before = tops.current.get(id);
      if (!reduce && before !== undefined && Math.abs(before - el.offsetTop) > 1) {
        el.animate(
          [{ transform: `translateY(${before - el.offsetTop}px)` }, { transform: 'none' }],
          { duration: 380, easing: 'cubic-bezier(.2,.8,.2,1)' },
        );
      }
    });
    tops.current = next;
  });

  return (id: string) => (el: HTMLElement | null) => {
    if (el) els.current.set(id, el);
    else els.current.delete(id);
  };
}
