import React, { useState } from 'react';
import { useConvexAuth } from 'convex/react';
import { useAddComment, useComments, useDeleteComment, useReportComment } from '../../data/socialHooks';
import type { CommentItem, CommentTargetType } from './types';

interface CommentsThreadProps {
  targetType: CommentTargetType;
  targetId: string;
  title?: string;
  className?: string;
}

function SingleComment({
  comment,
  targetType,
  targetId,
  isReply = false,
  onReplySuccess,
}: {
  comment: CommentItem;
  targetType: CommentTargetType;
  targetId: string;
  isReply?: boolean;
  onReplySuccess?: () => void;
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
    <div className={`space-y-2 ${isReply ? 'ml-2.5 sm:ml-6 mt-3 border-l-2 border-rock-200 pl-2.5 sm:pl-3' : 'py-3'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-ink">{comment.displayName || 'Anonymous'}</span>
          {comment.isSample && (
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
              Sample
            </span>
          )}
          <span className="text-rock-400">
            {new Date(comment.createdAt).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            })}
          </span>
        </div>

        <div className="flex items-center gap-1 text-rock-400">
          {comment.canDelete && (
            <button
              type="button"
              onClick={handleDelete}
              className="inline-flex min-h-[36px] items-center px-2 py-1 text-xs hover:text-rose-600 focus-visible:outline-alpine-500"
            >
              Delete
            </button>
          )}
          {isAuthenticated && (
            <button
              type="button"
              onClick={handleReport}
              disabled={reported}
              className={`inline-flex min-h-[36px] items-center px-2 py-1 text-xs hover:text-rock-700 focus-visible:outline-alpine-500 ${
                reported ? 'text-rock-300' : ''
              }`}
            >
              {reported ? 'Reported' : 'Report'}
            </button>
          )}
          {!isReply && isAuthenticated && (
            <button
              type="button"
              onClick={() => setReplyOpen(!replyOpen)}
              className="inline-flex min-h-[36px] items-center px-2 py-1 text-xs font-medium text-alpine-700 hover:text-alpine-900 focus-visible:outline-alpine-500"
            >
              {replyOpen ? 'Cancel' : 'Reply'}
            </button>
          )}
        </div>
      </div>

      <p className="text-xs text-rock-700 leading-relaxed break-words [overflow-wrap:anywhere]">{comment.body}</p>

      {/* Reply input */}
      {replyOpen && (
        <form onSubmit={handleSendReply} className="mt-2 space-y-2">
          <textarea
            required
            rows={2}
            maxLength={2000}
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder={`Reply to ${comment.displayName || 'this comment'}...`}
            className="w-full rounded-xl border border-rock-200 p-2 text-xs text-ink placeholder:text-rock-400 focus:border-alpine-500 focus:outline-none"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setReplyOpen(false)}
              className="min-h-[44px] inline-flex items-center rounded-full border border-rock-200 px-3 py-1 text-xs text-rock-600 hover:bg-rock-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!replyText.trim() || submitting}
              className="min-h-[44px] inline-flex items-center rounded-full bg-alpine-700 px-4 py-1 text-xs font-semibold text-white hover:bg-alpine-800 disabled:opacity-50"
            >
              {submitting ? 'Posting...' : 'Reply'}
            </button>
          </div>
        </form>
      )}

      {/* Nested Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="space-y-1">
          {comment.replies.map((reply) => (
            <SingleComment
              key={reply._id}
              comment={reply}
              targetType={targetType}
              targetId={targetId}
              isReply
            />
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
      } else {
        setAuthError('Could not post comment. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const isLoading = comments === undefined;

  return (
    <section aria-label="Comments" className={`rounded-2xl border border-rock-200 bg-white p-4 ${className}`}>
      <div className="flex items-center justify-between border-b border-rock-100 pb-3">
        <h3 className="font-display text-base font-semibold text-ink">{title}</h3>
        {comments && (
          <span className="text-xs text-dusk">
            {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
          </span>
        )}
      </div>

      {authError && (
        <div className="mt-2 rounded-xl bg-rose-50 p-2 text-xs text-rose-800">
          {authError}
        </div>
      )}

      {/* New comment input */}
      <form onSubmit={handlePost} className="mt-3 space-y-2">
        <textarea
          value={newBody}
          onChange={(e) => setNewBody(e.target.value)}
          maxLength={2000}
          placeholder="Share local insights, questions, or notes..."
          rows={3}
          className="w-full rounded-xl border border-rock-200 p-2.5 text-xs text-ink placeholder:text-rock-400 focus:border-alpine-500 focus:outline-none"
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[10px] text-rock-400">
            {newBody.length}/2000 characters
          </span>
          <button
            type="submit"
            disabled={!newBody.trim() || submitting}
            className="inline-flex min-h-[44px] items-center justify-center cursor-pointer rounded-full bg-alpine-700 px-5 py-2 text-xs font-semibold text-white hover:bg-alpine-800 disabled:opacity-50"
          >
            {submitting ? 'Posting...' : 'Post comment'}
          </button>
        </div>
      </form>

      {/* Comments list */}
      <div className="mt-4 divide-y divide-rock-100">
        {isLoading ? (
          <div className="space-y-3 py-2">
            {[0, 1].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-rock-50" />
            ))}
          </div>
        ) : comments.length === 0 ? (
          <p className="py-6 text-center text-xs text-dusk">
            No comments yet. Start the conversation!
          </p>
        ) : (
          comments.map((c) => (
            <SingleComment
              key={c._id}
              comment={c}
              targetType={targetType}
              targetId={targetId}
            />
          ))
        )}
      </div>
    </section>
  );
}
