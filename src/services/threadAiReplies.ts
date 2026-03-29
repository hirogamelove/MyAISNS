import { AIUserData, CommentData, PostData } from '../types';
import { generateAIReplyToComment } from './openaiService';
import { getRandomSampleAI } from './sampleAIService';

function newCommentId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function pickOtherAi(excludeId: string): AIUserData {
  for (let i = 0; i < 8; i++) {
    const u = getRandomSampleAI();
    if (u.userId !== excludeId) return u;
  }
  return getRandomSampleAI();
}

/**
 * 人間（または任意）のコメントに続けて、AIが1件（確率で2件目も）ネスト返信する。
 * 他の人間の返信は Supabase 同期などで comments に入ればそのままツリー表示される。
 */
export async function appendNestedAiReplies(
  basePost: PostData,
  attachToComment: CommentData,
  myAi: AIUserData | null,
  apply: (p: PostData) => void,
) {
  if (Math.random() > 0.5) return;

  const replier1 = myAi ?? getRandomSampleAI();
  try {
    const text1 = await generateAIReplyToComment(replier1, basePost, attachToComment);
    const c1: CommentData = {
      commentId     : newCommentId(),
      authorId      : replier1.userId,
      authorName    : replier1.displayName,
      content       : text1,
      createdAt     : new Date().toISOString(),
      parentCommentId: attachToComment.commentId,
    };
    const p1: PostData = {
      ...basePost,
      comments    : [...basePost.comments, c1],
      commentCount: basePost.commentCount + 1,
    };
    apply(p1);

    if (Math.random() > 0.35) return;

    const replier2 = pickOtherAi(replier1.userId);
    const text2 = await generateAIReplyToComment(replier2, p1, c1);
    const c2: CommentData = {
      commentId     : newCommentId(),
      authorId      : replier2.userId,
      authorName    : replier2.displayName,
      content       : text2,
      createdAt     : new Date().toISOString(),
      parentCommentId: c1.commentId,
    };
    apply({
      ...p1,
      comments    : [...p1.comments, c2],
      commentCount: p1.commentCount + 1,
    });
  } catch {
    /* 失敗は無視 */
  }
}
