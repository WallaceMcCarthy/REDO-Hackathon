import { useState, type ReactNode } from 'react';
import { useConvexAuth, useMutation, useQuery } from 'convex/react';
import { ConvexError } from 'convex/values';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import Composer from './Composer';
import PostCard from './PostCard';

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
    <section aria-labelledby="town-feed-heading" className="mt-12 border-t border-rock-100 pt-8">
      <h2 id="town-feed-heading" className="font-display text-2xl font-bold text-ink">Ask the locals in {cityName}</h2>
      <p className="mt-0.5 mb-4 text-xs text-dusk">Questions and tips from people who live here or are moving here.</p>

      {isAuthenticated ? (
        <Composer
          cityName={cityName}
          onSubmit={async (body) => {
            try {
              await create({ cityId, body });
            } catch (e) {
              throw new Error(errText(e));
            }
          }}
        />
      ) : (
        <div className="rounded-2xl border border-rock-100 bg-rock-50 p-4 text-sm text-dusk">
          Sign in to post, like, or comment.{' '}
          {onSignIn && (
            <button type="button" onClick={onSignIn} className="cursor-pointer font-semibold text-alpine-700 underline focus-visible:outline-2 focus-visible:outline-alpine-500">
              Sign in
            </button>
          )}
        </div>
      )}

      <p role="status" aria-live="polite" className="mt-3 min-h-5 text-sm text-rock-600">{notice}</p>

      {posts === undefined ? (
        <div className="mt-2 space-y-3" role="status" aria-busy="true">
          <span className="sr-only">Loading posts</span>
          {[0, 1].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-rock-100/70" />)}
        </div>
      ) : posts.length === 0 ? (
        <p className="mt-2 rounded-2xl border border-dashed border-rock-300 p-6 text-center text-dusk">
          No posts yet. Be the first to ask a question or share a tip about {cityName}.
        </p>
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
                  onDelete={run(() => remove({ postId: id }))}
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
