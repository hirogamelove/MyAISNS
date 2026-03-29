import { PROXY_BASE_URL, PROXY_SECRET } from '../constants';
import { AIUserData, CommentData, PostData } from '../types';
import { generateSystemPrompt } from './personalityService';
import { useAppStore } from '../store/useAppStore';

// ─── フォールバック投稿 ─────────────────────────────────
const FALLBACK_POSTS = [
  '今日もいい天気☀️ 散歩日和だな〜 #日常 #おでかけ',
  '最近ハマってる曲が止まらない🎵 エンドレスリピート #音楽 #推し曲',
  'ランチ何にしようかな🤔 いつものカフェにしようかな #ランチ',
  '読みかけの本、やっと読了📚 続きが気になりすぎた #読書 #おすすめ',
  '運動不足解消のためにウォーキング始めた🚶 #運動 #健康',
  '新しいゲームが面白すぎてやめられない🎮 #ゲーム #廃人',
  '今日のご飯が神がかってた🍜 ラーメン最高 #ラーメン #飯テロ',
  '空がきれいすぎて思わず写真撮った📸 #空 #日常',
];

function getFallback(): string {
  return FALLBACK_POSTS[Math.floor(Math.random() * FALLBACK_POSTS.length)];
}

async function callProxy(systemPrompt: string, userMessage: string): Promise<string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (PROXY_SECRET) headers['X-App-Secret'] = PROXY_SECRET;

  const res = await fetch(`${PROXY_BASE_URL}/api/generate-post`, {
    method:  'POST',
    headers,
    body: JSON.stringify({ systemPrompt, userMessage }),
  });

  if (!res.ok) throw new Error(`Proxy error: ${res.status}`);
  const data = await res.json();
  return data.content as string;
}

// ─── バズしている投稿からトレンドキーワードを抽出 ───────
function extractTrendKeywords(posts: PostData[]): string[] {
  // likeCount が多い上位5件からキーワードを集める
  const topPosts = [...posts]
    .sort((a, b) => b.likeCount - a.likeCount)
    .slice(0, 5);

  const keywords = new Set<string>();

  for (const post of topPosts) {
    if (post.likeCount < 3) continue;

    // ハッシュタグを抽出
    const tags = post.content.match(/#[\w\u3000-\u9FFF\uF900-\uFAFF]+/g);
    if (tags) tags.forEach(t => keywords.add(t.replace('#', '')));

    // 絵文字を抽出（最初の1〜2個）
    const emojis = post.content.match(/[\u{1F300}-\u{1FAFF}]/gu);
    if (emojis) emojis.slice(0, 2).forEach(e => keywords.add(e));
  }

  return Array.from(keywords).slice(0, 6);
}

// ─── バズ傾向からシステムプロンプト補足を生成 ─────────
function buildTrendHint(posts: PostData[]): string {
  const trendKeywords = extractTrendKeywords(posts);
  if (trendKeywords.length === 0) return '';

  return `\n【現在のトレンド（多くのいいねを集めているキーワード）】\n${trendKeywords.join('、')}\n上記のトレンドを意識した投稿にすると多くの反応が得られます。（ただし無理に全部使わなくてよい）`;
}

// ─── AI ポスト生成 ─────────────────────────────────────
export async function generateAIPost(
  aiUser: AIUserData,
  instruction?: string
): Promise<string> {
  const systemPrompt = generateSystemPrompt(aiUser.personality, aiUser.displayName);

  // バズ傾向を取得してプロンプトに追記
  let trendHint = '';
  try {
    const posts = useAppStore.getState().posts;
    if (posts.length > 0 && !instruction) {
      trendHint = buildTrendHint(posts);
    }
  } catch { /* ストアアクセス失敗は無視 */ }

  const enhancedSystemPrompt = systemPrompt + trendHint;

  const userMessage = instruction
    ? `次の指示に従って投稿してください：${instruction}`
    : '今の気分や最近の出来事について、自然な感じで1件投稿してください。';

  try {
    return await callProxy(enhancedSystemPrompt, userMessage);
  } catch (e) {
    console.warn('[OpenAI] フォールバック使用:', e);
    return getFallback();
  }
}

// ─── AI リプライ生成（投稿直下） ─────────────────────────
export async function generateAIReply(
  aiUser: AIUserData,
  targetPost: PostData
): Promise<string> {
  const systemPrompt = generateSystemPrompt(aiUser.personality, aiUser.displayName);
  const userMessage  = `次の投稿に短くリプライしてください（50文字以内）：\n「${targetPost.content}」`;

  try {
    return await callProxy(systemPrompt, userMessage);
  } catch {
    return 'それな！👍';
  }
}

// ─── AI リプライ生成（特定コメントへの返信） ─────────────
export async function generateAIReplyToComment(
  aiUser: AIUserData,
  targetPost: PostData,
  targetComment: CommentData,
): Promise<string> {
  const systemPrompt = generateSystemPrompt(aiUser.personality, aiUser.displayName);
  const postExcerpt =
    targetPost.content.length > 140 ? `${targetPost.content.slice(0, 140)}…` : targetPost.content;
  const userMessage =
    `次のスレッドで、「${targetComment.authorName}」さんのコメントへの短い返信（45文字以内）を1つ書いてください。\n\n`
    + `【元投稿】\n${postExcerpt}\n\n`
    + `【返信先コメント】\n「${targetComment.content}」`;

  try {
    return await callProxy(systemPrompt, userMessage);
  } catch {
    return 'わかる！👍';
  }
}
