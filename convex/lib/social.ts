/** Pure social-content policy shared by handlers and focused security tests. */
export const MAX_COMMENT_LENGTH = 2000;
export const HIDE_AFTER_REPORTS = 3;
export type CommentTarget = "listing" | "town" | "post";
export type ParentComment = { targetType: CommentTarget; targetId: string; parentId: string | null; hidden: boolean };

export function cleanComment(body: string): string {
  const clean = body.trim();
  if (clean.length === 0) throw new Error("Write a comment before posting");
  if (clean.length > MAX_COMMENT_LENGTH) throw new Error(`Comments may be at most ${MAX_COMMENT_LENGTH} characters`);
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(clean)) throw new Error("Comments contain unsupported control characters");
  return clean;
}

export function checkParent(parent: ParentComment | null, targetType: CommentTarget, targetId: string): void {
  if (!parent || parent.hidden) throw new Error("This comment is unavailable");
  if (parent.targetType !== targetType || parent.targetId !== targetId) throw new Error("Replies must belong to the same discussion");
  if (parent.parentId !== null) throw new Error("Reply to the original comment; replies are one level deep");
}

export function checkOwner(actualUserId: string, authorUserId: string): void {
  if (actualUserId !== authorUserId) throw new Error("You may only delete your own comment");
}

/** Caller must first enforce a unique persisted report per reporter and target. */
export function nextReportState(reports: number): { reports: number; hidden: boolean } {
  const next = reports + 1;
  return { reports: next, hidden: next >= HIDE_AFTER_REPORTS };
}
