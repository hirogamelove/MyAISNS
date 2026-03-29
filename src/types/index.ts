// ─── 性格プロファイル ────────────────────────────────────
export interface PersonalityProfile {
  openness: number;           // 開放性 0-1
  conscientiousness: number;  // 誠実性
  extraversion: number;       // 外向性
  agreeableness: number;      // 協調性
  neuroticism: number;        // 神経症傾向
  hobbies: string[];
  favoriteFoods: string[];
  politicalLeaning: 'left' | 'center' | 'right';
  religiosity: 'secular' | 'moderate' | 'devout';
  toneStyle?: 'casual' | 'polite' | 'passionate' | 'calm' | 'humorous';
  // 派生値
  likeThreshold: number;
  repostThreshold: number;
  postPositivity: number;
  humorLevel: number;
}

// ─── ユーザー ────────────────────────────────────────────
export interface UserData {
  userId: string;
  username: string;
  displayName: string;
  email: string;
  iconBase64: string;
  followersCount: number;
  followingCount: number;
  postCount: number;
  createdAt: string;
  isAI: boolean;
  coins: number;
  freeIconRegenRemaining: number;
  freeChatInstructionsToday: number;
  lastFreeChatResetDate: string;
  followingIds: string[];
  likedPostIds: string[];
  repostIds: string[];
}

// ─── AI ユーザー ─────────────────────────────────────────
export interface AIUserData extends UserData {
  personality: PersonalityProfile;
  linkedHumanUserId: string;
  humanPostButtonsRemaining: number;
  lastPostButtonResetDate: string;
  totalPostsMade: number;
  bio?: string;
}

// ─── 投稿 ────────────────────────────────────────────────
export interface PostData {
  postId: string;
  authorId: string;
  authorName: string;
  authorHandle: string;
  authorIconBase64: string;
  isAIAuthor: boolean;
  content: string;
  likeCount: number;
  repostCount: number;
  commentCount: number;
  buzzScore: number;
  createdAt: string;
  isAd: boolean;
  adSponsorId: string;
  adLabel: string;
  isRepost: boolean;
  originalPostId: string;
  repostAuthorName: string;
  likedByIds: string[];
  repostedByIds: string[];
  comments: CommentData[];
}

// ─── コメント ────────────────────────────────────────────
export interface CommentData {
  commentId: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
  /** 返信先。未設定は投稿直下のコメント */
  parentCommentId?: string;
}

// ─── クイズ ──────────────────────────────────────────────
export type QuizQuestionType = 'single' | 'multiple';

export interface QuizQuestion {
  id: string;
  questionText: string;
  type: QuizQuestionType;
  options: string[];
  traitTarget: string;
  maxSelections?: number;
}

export interface QuizAnswers {
  [questionId: string]: number | number[];
}

// ─── チャットメッセージ ───────────────────────────────────
export interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  content: string;
  createdAt: string;
}

// ─── アプリ内通知 ─────────────────────────────────────────
export type NotificationType = 'like' | 'repost' | 'comment' | 'follow' | 'buzz';

export interface AppNotification {
  id: string;
  type: NotificationType;
  actorName: string;       // 誰が
  actorIcon: string;       // そのアイコン URL
  postContent?: string;    // 対象投稿の冒頭（like/repost/comment）
  commentContent?: string; // コメント本文（comment）
  /** ネスト返信時、返信先コメントの冒頭（プレビュー） */
  replyTargetPreview?: string;
  createdAt: string;
  read: boolean;
}
