import type { ReactNode } from 'react';

export interface FeedPost {
  _id: string;
  body: string;
  likes: number;
  createdAt: number;
  isSample: boolean;
  authorName: string;
  isMine: boolean;
  likedByMe: boolean;
}

export function relativeTime(ts: number, now = Date.now()): string {
  const s = Math.max(0, Math.floor((now - ts) / 1000));
  if (s < 60) return 'just now';
  const units: [number, string][] = [[60, 'm'], [3600, 'h'], [86400, 'd']];
  if (s < 7 * 86400) {
    const [div, unit] = [...units].reverse().find(([d]) => s >= d)!;
    return `${Math.floor(s / div)}${unit} ago`;
  }
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const action =
  'cursor-pointer rounded-full px-3.5 py-2 min-h-[44px] inline-flex items-center text-sm font-semibold focus-visible:outline-2 focus-visible:outline-alpine-500';

interface Props {
  post: FeedPost;
  canAct: boolean;
  onLike: () => void;
  onReport: () => void;
  onDelete: () => void;
  comments?: ReactNode;
}

export default function PostCard({ post, canAct, onLike, onReport, onDelete, comments }: Props) {
  return (
    <article className="rounded-2xl border border-rock-100 bg-white p-4">
      <header className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <span className="font-semibold text-ink">{post.authorName}</span>
        {post.isSample && (
          <span className="rounded-full bg-alpine-100 px-2 py-0.5 text-xs font-semibold text-alpine-700">Sample</span>
        )}
        <time className="text-dusk" dateTime={new Date(post.createdAt).toISOString()}>{relativeTime(post.createdAt)}</time>
      </header>
      {/* plain text only: React escapes it, whitespace is preserved by CSS */}
      <p className="mt-2 whitespace-pre-wrap break-words text-ink">{post.body}</p>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={onLike}
          disabled={!canAct}
          aria-pressed={post.likedByMe}
          aria-label={`${post.likedByMe ? 'Unlike' : 'Like'}, ${post.likes} ${post.likes === 1 ? 'like' : 'likes'}`}
          className={`${action} disabled:cursor-default ${post.likedByMe ? 'bg-rock-100 text-rock-800' : 'text-dusk hover:bg-rock-50'}`}
        >
          <span aria-hidden="true">{post.likedByMe ? '♥' : '♡'} {post.likes}</span>
        </button>
        {canAct && post.isMine && (
          <button type="button" onClick={onDelete} className={`${action} text-rock-600 hover:bg-rock-50`}>Delete</button>
        )}
        {canAct && !post.isMine && (
          <button type="button" onClick={onReport} className={`${action} text-dusk hover:bg-rock-50`}>Report</button>
        )}
      </div>
      {comments && <div className="mt-3 border-t border-rock-100 pt-3">{comments}</div>}
    </article>
  );
}
