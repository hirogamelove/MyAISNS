// ─── サーバー設定 ────────────────────────────────────────
export const PROXY_BASE_URL = 'https://vercel-proxy-sigma-liard.vercel.app';
export const PROXY_SECRET   = '';  // ← Vercel の APP_SECRET を入力

// ─── 収益（任意）────────────────────────────────────────
// バナー左の CTA 文言タップで開く URL（未設定なら従来どおりテキストのみ）
export const BANNER_EXTERNAL_CLICK_URL =
  process.env.EXPO_PUBLIC_BANNER_EXTERNAL_URL?.trim() ?? '';

// ─── スタミナ上限 ────────────────────────────────────────
export const STAMINA = {
  MAX_POST_BUTTONS : 10,
  MAX_LIKES        : 30,
  MAX_REPOSTS      : 15,
  MAX_FOLLOWS      : 20,
  MAX_AD_POSTS     : 3,
};

// ─── コスト ──────────────────────────────────────────────
export const COST = {
  ICON_REGEN          : 500,
  CHAT_INSTRUCTION    : 100,
  AD_POST             : 200,
};

// ─── 獲得量 ──────────────────────────────────────────────
export const EARN = {
  DAILY_LOGIN  : 30,
  WATCH_AD     : 50,
  POST_BUZZ    : 100,
};

// ─── IAP パック ──────────────────────────────────────────
export const IAP_PACKS = [
  { label: 'スターターパック',   coins: 600,  iapId: 'coins_600'  },
  { label: 'お得なパック',       coins: 1500, iapId: 'coins_1500' },
  { label: 'プレミアムパック',   coins: 3500, iapId: 'coins_3500' },
];

// ─── デザイントークン ────────────────────────────────────
export const COLORS = {
  bg          : '#0a0a0f',
  bgCard      : '#13131a',
  bgInput     : '#1e1e2a',
  primary     : '#7c5cfc',
  primaryLight: '#9d82fd',
  accent      : '#fc5c7d',
  accentGreen : '#43e97b',
  accentBlue  : '#38f9d7',
  text        : '#f0f0ff',
  textSub     : '#8888aa',
  textMuted   : '#555577',
  border      : '#2a2a3a',
  like        : '#fc5c7d',
  repost      : '#43e97b',
  gold        : '#ffd700',
  adBg        : '#1a1508',
  adBorder    : '#4a3a00',
};

export const FONT_SIZE = {
  xs  : 11,
  sm  : 13,
  md  : 15,
  lg  : 17,
  xl  : 20,
  xxl : 26,
};
