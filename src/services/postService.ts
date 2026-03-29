import { PostData, UserData, AIUserData, CommentData, AppNotification } from '../types';
import {
  shouldLike, shouldRepost, shouldComment,
  isPostVisible, generateRandomPersonality,
} from './personalityService';
import { useAppStore } from '../store/useAppStore';

// ─── 通知ヘルパー ──────────────────────────────────────
// 自分の AI の投稿に対するリアクション、またはフォロー時に通知を発行
export function fireNotification(
  type      : AppNotification['type'],
  actorName : string,
  actorIcon : string,
  post?     : PostData,
  commentContent?: string,
  replyTargetPreview?: string,
): void {
  const state = useAppStore.getState();
  const myAIId = state.aiUser?.userId;

  // バズ通知は自分の投稿のみ、それ以外も自分の投稿対象のみ
  if (type !== 'follow' && type !== 'buzz') {
    if (!post || post.authorId !== myAIId) return;
  }
  if (type === 'buzz' && post && post.authorId !== myAIId) return;

  const notif: AppNotification = {
    id             : Math.random().toString(36).slice(2) + Date.now().toString(36),
    type,
    actorName,
    actorIcon,
    postContent    : post?.content.slice(0, 60),
    commentContent,
    replyTargetPreview,
    createdAt      : new Date().toISOString(),
    read           : false,
  };
  state.addNotification(notif);
}

// uuid が使えない環境用の簡易 ID 生成
function genId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ─── 投稿ファクトリ ─────────────────────────────────────
export function createPost(
  author: UserData | AIUserData,
  content: string,
  isAI: boolean
): PostData {
  return {
    postId          : genId(),
    authorId        : author.userId,
    authorName      : author.displayName,
    authorHandle    : '@' + author.username,
    authorIconBase64: author.iconBase64 ?? '',
    isAIAuthor      : isAI,
    content,
    likeCount       : 0,
    repostCount     : 0,
    commentCount    : 0,
    buzzScore       : 0,
    createdAt       : new Date().toISOString(),
    isAd            : false,
    adSponsorId     : '',
    adLabel         : '',
    isRepost        : false,
    originalPostId  : '',
    repostAuthorName: '',
    likedByIds      : [],
    repostedByIds   : [],
    comments        : [],
  };
}

// ─── 広告投稿ファクトリ ─────────────────────────────────
export function createAdPost(sponsor: UserData, content: string): PostData {
  const post = createPost(sponsor, content, sponsor.isAI);
  post.isAd       = true;
  post.adSponsorId = sponsor.userId;
  post.adLabel    = '広告';
  return post;
}

// ─── リポストファクトリ ─────────────────────────────────
export function createRepost(
  reposter: UserData,
  original: PostData
): PostData {
  return {
    ...original,
    postId          : genId(),
    authorId        : reposter.userId,
    authorName      : reposter.displayName,
    authorHandle    : '@' + reposter.username,
    authorIconBase64: reposter.iconBase64 ?? '',
    isAIAuthor      : reposter.isAI,
    isRepost        : true,
    originalPostId  : original.postId,
    repostAuthorName: original.authorName,
    createdAt       : new Date().toISOString(),
    likeCount       : 0,
    repostCount     : 0,
    commentCount    : 0,
    buzzScore       : 0,
    likedByIds      : [],
    repostedByIds   : [],
    comments        : [],
  };
}

// ─── buzzScore 再計算 ─────────────────────────────────
export function recalcBuzz(post: PostData): PostData {
  const raw = post.likeCount * 1.0 + post.repostCount * 2.0 + post.commentCount * 1.5;
  return { ...post, buzzScore: Math.min(1, raw / 200) };
}

// ─── AI の自動リアクション（2段階判定） ──────────────
// commenters = コメントすべきと判定された AI（呼び出し元が非同期でコメント生成）
export function processAIReactions(
  post         : PostData,
  count        : number   = 5,
  followingIds : string[] = [],
): { updated: PostData; commenters: { id: string; displayName: string }[] } {
  let updated   = { ...post, likedByIds: [...post.likedByIds], repostedByIds: [...post.repostedByIds] };
  const commenters: { id: string; displayName: string }[] = [];
  const authorFollowers = post.isAIAuthor ? 50 : 200;

  for (let i = 0; i < count; i++) {
    const aiId = `ai_sample_${i}`;
    const p    = generateRandomPersonality();
    const isFollowing = followingIds.includes(post.authorId);

    // Step1: 目に留まるか
    if (!isPostVisible(post.content, updated.buzzScore, authorFollowers, p.hobbies, isFollowing)) continue;

    // Step2: ファボ
    if (!updated.likedByIds.includes(aiId) &&
        shouldLike(p, post.content, updated.buzzScore, authorFollowers, post.isAd)) {
      updated.likedByIds.push(aiId);
      updated.likeCount++;
      // 自分の AI 投稿なら通知（20% の確率で通知してノイズを減らす）
      if (Math.random() < 0.2) {
        fireNotification('like', `AI_${i}`, '', post);
      }
    }

    // Step2: リポスト
    if (!updated.repostedByIds.includes(aiId) &&
        shouldRepost(p, post.content, updated.buzzScore, authorFollowers)) {
      updated.repostedByIds.push(aiId);
      updated.repostCount++;
      if (Math.random() < 0.3) {
        fireNotification('repost', `AI_${i}`, '', post);
      }
    }

    // Step2: コメント候補
    if (shouldComment(p, post.content, updated.buzzScore, authorFollowers)) {
      commenters.push({ id: aiId, displayName: `AI_${i}` });
    }
  }

  return { updated: recalcBuzz(updated), commenters };
}

// ─── 時刻フォーマット ─────────────────────────────────
export function timeAgo(isoString: string): string {
  const diff = (Date.now() - new Date(isoString).getTime()) / 1000;
  if (diff < 60)   return 'たった今';
  if (diff < 3600) return `${Math.floor(diff / 60)}分前`;
  if (diff < 86400)return `${Math.floor(diff / 3600)}時間前`;
  return `${Math.floor(diff / 86400)}日前`;
}

// ─── カウントフォーマット ─────────────────────────────
export function formatCount(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`;
  if (n >= 1000)  return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}
