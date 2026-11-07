import { useState, type ReactNode } from 'react';
import { useResilientQuery as useQuery } from '../../data/resilient';
import { useConvexAuth, useMutation } from 'convex/react';
import { ConvexError } from 'convex/values';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import Composer from './Composer';
import PostCard from './PostCard';
import { Button, Card, EmptyState, Skeleton } from '../ui';

interface Props {
  cityId: string;
  cityName: string;
  /** Opens the sign-in modal; the prompt shows a button only when given. */
  onSignIn?: () => void;
  /** Comments thread slot, rendered under each post (comment targetId is the post id). */
  renderComments?: (postId: string) => ReactNode;
}

const errText = (e: unknown) => (e instanceof ConvexError ? String(e.data) : 'Something went wrong. Try again.');

export default function TownFeed({ cityId, cityName, onSignIn, renderComments }: Props) {
  const { isAuthenticated } = useConvexAuth();
  const posts = useQuery(api.posts.listForTown, { cityId });
  const create = useMutation(api.posts.create);
  const toggleLike = useMutation(api.posts.toggleLike);
  const report = useMutation(api.posts.report);
  const remove = useMutation(api.posts.remove);
  const [notice, setNotice] = useState<string | null>(null);

  const run = (fn: () => Promise<unknown>, ok?: string) => async () => {
    setNotice(null);
    try {
      await fn();
      if (ok) setNotice(ok);
    } catch (e) {
      setNotice(errText(e));
    }
  };

  return (
    <section aria-labelledby="town-feed-heading" className="mt-section">
      <h2 id="town-feed-heading" className="font-display text-heading text-text">Ask the locals in {cityName}</h2>
      <p className="mt-1 mb-4 text-small text-text-muted">Questions and tips from people who live here or are moving here.</p>

      {isAuthenticated ? (
        <Composer
          cityName={cityName}
          onSubmit={async (body) => {
            await create({ cityId, body });
          }}
        />
      ) : (
        <Card className="flex flex-wrap items-center justify-between gap-3 bg-surface-sunken">
          <p className="text-small text-text-muted">Sign in to post, like, or comment.</p>
          {onSignIn && <Button variant="secondary" size="sm" onClick={onSignIn}>Sign in</Button>}
        </Card>
      )}

      <p role="status" aria-live="polite" className="mt-3 min-h-5 text-small text-text-muted">{notice}</p>

      {posts === undefined ? (
        <div className="mt-2 space-y-3" role="status" aria-busy="true">
          <span className="sr-only">Loading posts</span>
          {[0, 1].map((i) => <Skeleton key={i} className="h-24 rounded-card" />)}
        </div>
      ) : posts.length === 0 ? (
        <EmptyState
          className="mt-2"
          title="No posts yet"
          description={`Be the first to ask a question or share a tip about ${cityName}.`}
        />
      ) : (
        <ul className="mt-2 space-y-3">
          {posts.map((p) => {
            const id = p._id as Id<'posts'>;
            return (
              <li key={p._id}>
                <PostCard
                  post={p}
                  canAct={isAuthenticated}
                  onLike={run(() => toggleLike({ postId: id }))}
                  onReport={run(() => report({ postId: id }), 'Thanks. We will review this post.')}
                  onDelete={() => {
                    if (window.confirm('Delete this post? Replies to it will be deleted too.')) void run(() => remove({ postId: id }))();
                  }}
                  comments={renderComments?.(p._id)}
                />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
