import type { ReactNode } from 'react';
import { Badge, Button, Card } from '../ui';

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
    <Card as="article">
      <header className="flex flex-wrap items-center gap-x-2 gap-y-1 text-small">
        <span className="font-semibold text-text">{post.authorName}</span>
        {post.isSample && <Badge tone="sample" />}
        <time className="text-text-muted" dateTime={new Date(post.createdAt).toISOString()}>{relativeTime(post.createdAt)}</time>
      </header>
      {/* plain text only: React escapes it, whitespace is preserved by CSS */}
      <p className="mt-2 whitespace-pre-wrap break-words text-body text-text [overflow-wrap:anywhere]">{post.body}</p>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <Button
          variant={post.likedByMe ? 'secondary' : 'ghost'}
          size="sm"
          onClick={onLike}
          disabled={!canAct}
          aria-pressed={post.likedByMe}
          aria-label={`${post.likedByMe ? 'Unlike' : 'Like'}, ${post.likes} ${post.likes === 1 ? 'like' : 'likes'}`}
        >
          <span aria-hidden="true">{post.likedByMe ? '♥' : '♡'} {post.likes}</span>
        </Button>
        {canAct && post.isMine && <Button variant="ghost" size="sm" onClick={onDelete}>Delete</Button>}
        {canAct && !post.isMine && <Button variant="ghost" size="sm" onClick={onReport}>Report</Button>}
      </div>
      {comments && <div className="mt-3 border-t border-border pt-3">{comments}</div>}
    </Card>
  );
}
