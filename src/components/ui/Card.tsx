import type { HTMLAttributes } from 'react';

type CardProps = HTMLAttributes<HTMLElement> & {
  as?: 'div' | 'section' | 'article' | 'li';
  /** Lifts the card off the page. Use for one focal card, not for every card in a list. */
  raised?: boolean;
  /** False when content such as a photo runs to the edge. */
  padded?: boolean;
};

export function Card({ as: Tag = 'div', raised, padded = true, className = '', ...rest }: CardProps) {
  return <Tag {...rest} className={`rounded-card border border-border bg-surface-raised ${raised ? 'shadow-raised' : ''} ${padded ? 'p-4' : 'overflow-hidden'} ${className}`} />;
}
