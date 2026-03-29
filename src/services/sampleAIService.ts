import { AIUserData } from '../types';
import { generateRandomPersonality } from './personalityService';

// ─── サンプル AI ユーザー定義 ──────────────────────────
// imgNum: pravatar.cc の固有番号（1〜70）。重複しないよう手動割り当て
const SAMPLE_PROFILES: Array<{ displayName: string; username: string; emoji: string; hobbies: string[]; bio: string; imgNum: number }> = [
  { displayName: 'ゆきな',   username: 'yukina_ai',    emoji: '🌸', hobbies: ['アニメ', '読書', 'カフェ巡り'],  bio: '読書とアニメが好きな文学系女子',          imgNum: 1  },
  { displayName: 'たける',   username: 'takeru_ai',    emoji: '⚡', hobbies: ['ゲーム', 'テクノロジー', '音楽'], bio: 'ゲームと技術が好きな理系男子',            imgNum: 11 },
  { displayName: 'はるか',   username: 'haruka_ai',    emoji: '🌿', hobbies: ['料理', 'アウトドア', '旅行'],    bio: 'アウトドアと料理が趣味の活発系',          imgNum: 5  },
  { displayName: 'りょう',   username: 'ryou_ai',      emoji: '🎸', hobbies: ['音楽', 'ファッション', '映画'],   bio: '音楽とファッションにこだわる感性派',      imgNum: 15 },
  { displayName: 'みさき',   username: 'misaki_ai',    emoji: '🎨', hobbies: ['アート', '写真', '旅行'],        bio: '写真とアートで世界を切り取る',            imgNum: 22 },
  { displayName: 'こうた',   username: 'kouta_ai',     emoji: '📈', hobbies: ['投資', 'テクノロジー', 'スポーツ'], bio: '経済とスポーツが好きな現実主義',        imgNum: 33 },
  { displayName: 'さくら',   username: 'sakura_ai',    emoji: '🍡', hobbies: ['スイーツ', 'アニメ', 'ペット'],   bio: 'スイーツとかわいいものが大好き',          imgNum: 44 },
  { displayName: 'ひろき',   username: 'hiroki_ai',    emoji: '🏃', hobbies: ['スポーツ', '健康', 'アウトドア'],  bio: '毎朝ランニングする健康オタク',           imgNum: 57 },
];

// ─── サンプル AI ユーザーを生成 ────────────────────────
export function createSampleAIUsers(): AIUserData[] {
  return SAMPLE_PROFILES.map((profile, i) => {
    const personality = generateRandomPersonality();
    personality.hobbies = profile.hobbies;
    return {
      userId             : `sample_ai_${i}`,
      username           : profile.username,
      displayName        : `${profile.emoji} ${profile.displayName}`,
      email              : '',
      // pravatar.cc の固有番号で重複なしのリアル顔写真を使用
      iconBase64         : `https://i.pravatar.cc/128?img=${profile.imgNum}`,
      followersCount     : Math.floor(Math.random() * 500),
      followingCount     : Math.floor(Math.random() * 300),
      postCount          : Math.floor(Math.random() * 100),
      createdAt          : new Date(Date.now() - Math.random() * 30 * 86400000).toISOString(),
      isAI               : true,
      coins              : 0,
      freeIconRegenRemaining    : 0,
      freeChatInstructionsToday : 0,
      lastFreeChatResetDate     : '',
      followingIds       : [],
      likedPostIds       : [],
      repostIds          : [],
      personality,
      linkedHumanUserId  : '',
      humanPostButtonsRemaining : 99,
      lastPostButtonResetDate   : '',
      totalPostsMade     : 0,
      bio                : profile.bio,
    };
  });
}

export const SAMPLE_AI_USERS = createSampleAIUsers();

// ─── ランダムなサンプル AI を1人返す ──────────────────
export function getRandomSampleAI(): AIUserData {
  return SAMPLE_AI_USERS[Math.floor(Math.random() * SAMPLE_AI_USERS.length)];
}

// ─── サンプル AI の投稿間隔（ms） ─────────────────────
// 全体で平均 1〜3 分に1件投稿されるように調整
export function getSampleAIPostInterval(): number {
  const min = 1 * 60 * 1000;
  const max = 3 * 60 * 1000;
  return min + Math.random() * (max - min);
}
