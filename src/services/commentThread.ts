import { CommentData } from '../types';

/** 親が存在しない parentCommentId はルート扱いにする */
export function flattenCommentThread(comments: CommentData[]): { item: CommentData; depth: number }[] {
  const ids = new Set(comments.map(c => c.commentId));
  const byParent = new Map<string | undefined, CommentData[]>();

  for (const c of comments) {
    let p = c.parentCommentId;
    if (p && !ids.has(p)) p = undefined;
    const list = byParent.get(p) ?? [];
    list.push(c);
    byParent.set(p, list);
  }

  for (const list of byParent.values()) {
    list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  const out: { item: CommentData; depth: number }[] = [];

  function walk(parentKey: string | undefined, depth: number) {
    for (const c of byParent.get(parentKey) ?? []) {
      out.push({ item: c, depth });
      walk(c.commentId, depth + 1);
    }
  }

  walk(undefined, 0);
  return out;
}

/**
 * バックグラウンド AI コメントの返信先。
 * 既存リプがあれば多くはそのいずれかへネストし、ときどき投稿直下に付ける。
 */
export function pickBackgroundReplyTarget(comments: CommentData[]): CommentData | undefined {
  if (comments.length === 0) return undefined;
  if (Math.random() < 0.28) return undefined;

  const sorted = [...comments].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const pool = sorted.slice(0, Math.min(6, sorted.length));
  return pool[Math.floor(Math.random() * pool.length)];
}
