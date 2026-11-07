import React, { useState } from 'react';
import { useConvexAuth } from 'convex/react';
import { useAddComment, useComments, useDeleteComment, useReportComment } from '../../data/socialHooks';
import { Badge, Button, Card, EmptyState, Field, Skeleton, Textarea } from '../ui';
import { openSignIn } from '../auth/AccountMenu';
import type { CommentItem, CommentTargetType } from './types';

interface CommentsThreadProps {
  targetType: CommentTargetType;
  targetId: string;
  title?: string;
  className?: string;
  /** Placeholder text for the new-comment box. */
  placeholder?: string;
  /** Helper line shown above the box. */
  helper?: string;
  /** When provided, others' comments get a Message button. Never receives emails. */
  onMessageUser?: (userId: string, listingId: string) => void;
}

function SingleComment({
  comment,
  targetType,
  targetId,
  isReply = false,
  onReplySuccess,
  onMessageUser,
}: {
  comment: CommentItem;
  targetType: CommentTargetType;
  targetId: string;
  isReply?: boolean;
  onReplySuccess?: () => void;
  onMessageUser?: (userId: string, listingId: string) => void;
}) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [reported, setReported] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { isAuthenticated } = useConvexAuth();
  const addComment = useAddComment();
  const deleteComment = useDeleteComment();
  const reportComment = useReportComment();

  const handleReport = async () => {
    if (reported) return;
    setReported(true);
    await reportComment(comment._id);
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this comment?')) {
      await deleteComment(comment._id);
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || submitting) return;
    setSubmitting(true);
    try {
      await addComment({
        targetType,
        targetId,
        body: replyText.trim(),
        parentId: comment._id,
      });
      setReplyText('');
      setReplyOpen(false);
      onReplySuccess?.();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div data-comment={comment._id} className={isReply ? 'ml-2 mt-3 border-l-2 border-border pl-3 sm:ml-4' : 'py-3'}>
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-small">
        <span className="break-words font-semibold text-text [overflow-wrap:anywhere]">{comment.displayName || 'Anonymous'}</span>
        {comment.isSample && <Badge tone="sample" />}
        <span className="text-caption text-text-muted">
          {new Date(comment.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
        </span>
      </div>

      {/* plain text only: React escapes it, whitespace is preserved by CSS */}
      <p className="mt-1 whitespace-pre-wrap break-words text-small text-text [overflow-wrap:anywhere]">{comment.body}</p>

      {(comment.canDelete || isAuthenticated) && (
        <div className="-ml-3 flex flex-wrap items-center">
          {comment.canDelete && <Button variant="ghost" size="sm" onClick={handleDelete}>Delete</Button>}
          {isAuthenticated && onMessageUser && !comment.canDelete && comment.userId && (
            <Button variant="ghost" size="sm" onClick={() => onMessageUser(comment.userId, targetId)}>Message</Button>
          )}
          {isAuthenticated && <Button variant="ghost" size="sm" onClick={handleReport} disabled={reported}>{reported ? 'Reported' : 'Report'}</Button>}
          {!isReply && isAuthenticated && (
            <Button variant="ghost" size="sm" onClick={() => setReplyOpen(!replyOpen)}>{replyOpen ? 'Cancel' : 'Reply'}</Button>
          )}
        </div>
      )}

      {replyOpen && (
        <form onSubmit={handleSendReply} className="mt-2 space-y-2">
          <Field label="Reply" className="[&>label]:sr-only">
            <Textarea
              required
              rows={2}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              maxLength={2000}
              placeholder={`Reply to ${comment.displayName || 'this comment'}...`}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setReplyOpen(false)}>Cancel</Button>
            <Button type="submit" size="sm" loading={submitting} disabled={!replyText.trim()}>{submitting ? 'Posting' : 'Reply'}</Button>
          </div>
        </form>
      )}

      {comment.replies && comment.replies.length > 0 && (
        <div className="space-y-1">
          {comment.replies.map((reply) => (
            <SingleComment key={reply._id} comment={reply} targetType={targetType} targetId={targetId} isReply onMessageUser={onMessageUser} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function CommentsThread({
  targetType,
  targetId,
  title = 'Community discussion',
  className = '',
  placeholder = 'Share local insights, questions, or notes...',
  helper,
  onMessageUser,
}: CommentsThreadProps) {
  const [newBody, setNewBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const comments = useComments(targetType, targetId);
  const addComment = useAddComment();

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBody.trim() || submitting) return;
    setSubmitting(true);
    try {
      setAuthError(null);
      await addComment({
        targetType,
        targetId,
        body: newBody.trim(),
      });
      setNewBody('');
    } catch (err: any) {
      if (err?.message?.includes('Sign in') || err?.message?.includes('auth')) {
        setAuthError('Please sign in to post comments.');
        openSignIn();
      } else {
        setAuthError('Could not post comment. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const isLoading = comments === undefined;

  return (
    <Card as="section" aria-label="Comments" className={className}>
      <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
        <h3 className="font-display text-title text-text">{title}</h3>
        {comments && (
          <span className="shrink-0 text-small text-text-muted">
            {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
          </span>
        )}
      </div>

      {helper && <p className="mt-3 text-small text-text-muted">{helper}</p>}

      <form onSubmit={handlePost} className="mt-3 space-y-2">
        <Field label="Add a comment" className="[&>label]:sr-only" error={authError}>
          <Textarea
            value={newBody}
            onChange={(e) => setNewBody(e.target.value)}
            maxLength={2000}
            placeholder={placeholder}
            rows={3}
          />
        </Field>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-caption text-text-muted">{newBody.length}/2000 characters</span>
          <Button type="submit" size="sm" loading={submitting} disabled={!newBody.trim()}>
            {submitting ? 'Posting' : 'Post comment'}
          </Button>
        </div>
      </form>

      <div className="mt-4 divide-y divide-border">
        {isLoading ? (
          <div className="space-y-3 py-2" aria-busy="true">
            {[0, 1].map((i) => <Skeleton key={i} className="h-16" />)}
          </div>
        ) : comments.length === 0 ? (
          <EmptyState className="my-3" title="No comments yet" description="Start the conversation." />
        ) : (
          comments.map((c) => <SingleComment key={c._id} comment={c} targetType={targetType} targetId={targetId} onMessageUser={onMessageUser} />)
        )}
      </div>
    </Card>
  );
}
