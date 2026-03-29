import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  UserData, AIUserData, PostData, ChatMessage, AppNotification, PersonalityProfile, CommentData,
} from '../types';
import { ThemeMode, AccentId } from '../theme';
import { STAMINA, EARN } from '../constants';
import { diceBearUrl } from '../services/iconService';
import { getSupabase, SUPABASE_CONFIGURED } from '../lib/supabase';

// DiceBear URL（どのスタイルでも）を pravatar.cc のリアル写真に差し替える
function migrateIconUrl(url: string | undefined | null): string {
  if (!url) return '';
  if (url.includes('dicebear.com')) {
    const m = url.match(/seed=([^&]+)/);
    const seed = m ? decodeURIComponent(m[1]) : 'default';
    return diceBearUrl(seed);   // pravatar.cc URL を返す
  }
  return url;
}

// ─── ヘルパー ────────────────────────────────────────────
const today = () => new Date().toISOString().slice(0, 10);

const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

/** リモート同期時のスコア（どちらをベースの本文・メタにするか） */
function postEngagement(p: PostData): number {
  return p.comments.length * 20 + p.likeCount + p.repostCount * 2;
}

/** 同一 commentId が両方にあるとき新しめ／長い方を優先（parentCommentId もマージ） */
function mergeDuplicateComment(a: CommentData, b: CommentData): CommentData {
  const ta = new Date(a.createdAt).getTime();
  const tb = new Date(b.createdAt).getTime();
  if (tb > ta) return { ...a, ...b, parentCommentId: b.parentCommentId ?? a.parentCommentId };
  if (ta > tb) return { ...b, ...a, parentCommentId: a.parentCommentId ?? b.parentCommentId };
  const prefer = a.content.length >= b.content.length ? a : b;
  const other  = a.content.length >= b.content.length ? b : a;
  return {
    ...other,
    ...prefer,
    parentCommentId: prefer.parentCommentId ?? other.parentCommentId,
  };
}

function recalcBuzzLocal(post: PostData): PostData {
  const raw = post.likeCount * 1.0 + post.repostCount * 2.0 + post.commentCount * 1.5;
  return { ...post, buzzScore: Math.min(1, raw / 200) };
}

/**
 * ローカルとリモートの同一投稿をマージ。
 * コメントは commentId でユニオン（スレッドの parentCommentId を落とさない）。
 * いいね・リポスト ID は和集合、カウントは一貫するよう調整。
 */
function mergePostsForSync(local: PostData, remote: PostData): PostData {
  const base  = postEngagement(local) >= postEngagement(remote) ? { ...local } : { ...remote };
  const other = postEngagement(local) >= postEngagement(remote) ? remote : local;

  const byId = new Map<string, CommentData>();
  for (const c of base.comments) byId.set(c.commentId, c);
  for (const c of other.comments) {
    const ex = byId.get(c.commentId);
    if (!ex) byId.set(c.commentId, c);
    else byId.set(c.commentId, mergeDuplicateComment(ex, c));
  }
  const comments = Array.from(byId.values()).sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  const likedByIds    = [...new Set([...local.likedByIds, ...remote.likedByIds])];
  const repostedByIds = [...new Set([...local.repostedByIds, ...remote.repostedByIds])];
  const likeCount     = Math.max(local.likeCount, remote.likeCount, likedByIds.length);
  const repostCount   = Math.max(local.repostCount, remote.repostCount, repostedByIds.length);

  return recalcBuzzLocal({
    ...base,
    likedByIds,
    repostedByIds,
    likeCount,
    repostCount,
    comments,
    commentCount: comments.length,
  });
}

function supabasePostPayload(post: PostData) {
  return {
    author_id    : post.authorId,
    author_name  : post.authorName,
    author_handle: post.authorHandle,
    author_icon  : post.authorIconBase64,
    is_ai_author : post.isAIAuthor,
    content      : post.content,
    like_count   : post.likeCount,
    repost_count : post.repostCount,
    comment_count: post.commentCount,
    buzz_score   : post.buzzScore,
    is_ad        : post.isAd,
    is_repost    : post.isRepost,
    created_at   : post.createdAt,
    metadata     : post as any,
  };
}

// ─── State 型 ─────────────────────────────────────────────
interface AppState {
  // ユーザー
  humanUser:  UserData   | null;
  aiUser:     AIUserData | null;
  isLoggedIn: boolean;

  // タイムライン
  posts: PostData[];

  // 通知
  notifications: AppNotification[];
  unreadCount: number;

  // テーマ
  themeMode:   ThemeMode;
  accentColor: AccentId;
  setThemeMode:   (mode: ThemeMode) => void;
  setAccentColor: (id: AccentId) => void;

  // チャット
  chatMessages: ChatMessage[];

  // スタミナ（日次）
  stamina: {
    postButtonsUsed : number;
    likesUsed       : number;
    repostsUsed     : number;
    followsUsed     : number;
    adPostsUsed     : number;
    lastResetDate   : string;
  };

  // アクション
  login:          (user: UserData, ai: AIUserData | null) => void;
  logout:         () => void;
  setHumanUser:   (u: UserData)    => void;
  setAIUser:      (ai: AIUserData) => void;
  updateAIPersonality: (patch: { personality?: Partial<PersonalityProfile>; bio?: string; displayName?: string }) => void;
  addPost:        (post: PostData) => void;
  updatePost:     (post: PostData) => void;
  addChatMessage:   (msg: ChatMessage) => void;
  clearChat:        () => void;

  // 通知
  addNotification:  (n: AppNotification) => void;
  markAllRead:      () => void;
  clearNotifications: () => void;

  // フォロー操作
  followUser:   (userId: string) => boolean;
  unfollowUser: (userId: string) => void;

  // スタミナ消費（false = 上限超え）
  usePostButton:  () => boolean;
  useLike:        () => boolean;
  useRepost:      () => boolean;
  useFollow:      () => boolean;
  useAdPost:      () => boolean;
  refreshStamina: () => void;

  // コイン
  earnCoins:  (amount: number) => void;
  spendCoins: (amount: number) => boolean;

  // Supabase 認証
  supabaseSignUp: (email: string, password: string, displayName: string, username: string) => Promise<string | null>;
  supabaseSignIn: (email: string, password: string) => Promise<string | null>;
  supabaseSignOut: () => Promise<void>;
  deleteAccount: () => Promise<string | null>;

  // Supabase データ同期
  syncPostsFromSupabase: () => Promise<void>;
  startRealtimeSync: () => (() => void);

  // 永続化
  saveToStorage: () => Promise<void>;
  loadFromStorage: () => Promise<void>;
}

// ─── Store ────────────────────────────────────────────────
export const useAppStore = create<AppState>((set, get) => ({
  humanUser:     null,
  aiUser:        null,
  isLoggedIn:    false,
  posts:         [],
  notifications: [],
  unreadCount:   0,
  chatMessages:  [],
  themeMode:     'dark',
  accentColor:   'purple',
  setThemeMode:   (mode) => { set({ themeMode: mode }); AsyncStorage.setItem('themeMode', mode); },
  setAccentColor: (id)   => { set({ accentColor: id }); AsyncStorage.setItem('accentColor', id); },
  stamina: {
    postButtonsUsed : 0,
    likesUsed       : 0,
    repostsUsed     : 0,
    followsUsed     : 0,
    adPostsUsed     : 0,
    lastResetDate   : '',
  },

  // ─── ログイン ────────────────────────────────────────
  login: (user, ai) => {
    set({ humanUser: user, aiUser: ai ?? null, isLoggedIn: true });
    get().refreshStamina();
  },

  logout: () => {
    get().saveToStorage();
    set({ humanUser: null, aiUser: null, isLoggedIn: false });
  },

  setHumanUser: (u) => {
    set({ humanUser: u });
    get().saveToStorage();
    if (SUPABASE_CONFIGURED) {
      const sb = getSupabase();
      if (sb) {
        sb.from('human_users').upsert({
          id              : u.userId,
          username        : u.username,
          display_name    : u.displayName,
          email           : u.email,
          icon_url        : u.iconBase64,
          coins           : u.coins,
          followers_count : u.followersCount,
          following_count : u.followingCount,
          following_ids   : u.followingIds,
          liked_post_ids  : u.likedPostIds,
          repost_ids      : u.repostIds,
          free_icon_regen : u.freeIconRegenRemaining,
        }).then(({ error }) => {
          if (error) console.warn('supabase setHumanUser error:', error.message);
        });
      }
    }
  },

  updateAIPersonality: ({ personality, bio, displayName }) => {
    const { aiUser } = get();
    if (!aiUser) return;
    const updated: AIUserData = {
      ...aiUser,
      ...(displayName ? { displayName } : {}),
      ...(bio !== undefined ? { bio } : {}),
      personality: personality
        ? { ...aiUser.personality, ...personality }
        : aiUser.personality,
    };
    get().setAIUser(updated);
  },

  setAIUser: (ai) => {
    set({ aiUser: ai });
    get().saveToStorage();
    if (SUPABASE_CONFIGURED) {
      const sb = getSupabase();
      if (sb) {
        sb.from('ai_users').upsert({
          id                     : ai.userId,
          linked_human_id        : ai.linkedHumanUserId,
          username               : ai.username,
          display_name           : ai.displayName,
          icon_url               : ai.iconBase64,
          personality            : ai.personality as any,
          bio                    : ai.bio ?? '',
          post_buttons_remaining : ai.humanPostButtonsRemaining,
          total_posts_made       : ai.totalPostsMade,
        }).then(({ error }) => {
          if (error) console.warn('supabase setAIUser error:', error.message);
        });
      }
    }
  },

  // ─── 投稿 ────────────────────────────────────────────
  addPost: (post) => {
    set(s => ({ posts: [post, ...s.posts].slice(0, 300) }));
    get().saveToStorage();
    // Supabase に非同期で書き込み（失敗してもローカルは保持）
    if (SUPABASE_CONFIGURED) {
      const sb = getSupabase();
      if (sb) {
        sb.from('posts').insert({
          id: post.postId,
          ...supabasePostPayload(post),
        }).then(({ error }) => {
          if (error) console.warn('supabase addPost error:', error.message);
        });
      }
    }
  },

  updatePost: (post) => {
    set(s => ({
      posts: s.posts.map(p => p.postId === post.postId ? post : p),
    }));
    get().saveToStorage();
    if (SUPABASE_CONFIGURED) {
      const sb = getSupabase();
      if (sb) {
        sb.from('posts')
          .update(supabasePostPayload(post))
          .eq('id', post.postId)
          .then(({ error }) => {
            if (error) console.warn('supabase updatePost error:', error.message);
          });
      }
    }
  },

  // ─── チャット ─────────────────────────────────────────
  addChatMessage: (msg) =>
    set(s => ({ chatMessages: [...s.chatMessages, msg] })),

  clearChat: () => set({ chatMessages: [] }),

  // ─── 通知 ─────────────────────────────────────────────
  addNotification: (n) =>
    set(s => ({
      notifications: [n, ...s.notifications].slice(0, 100),
      unreadCount:   s.unreadCount + 1,
    })),

  markAllRead: () =>
    set(s => ({
      notifications: s.notifications.map(n => ({ ...n, read: true })),
      unreadCount:   0,
    })),

  clearNotifications: () => set({ notifications: [], unreadCount: 0 }),

  // ─── スタミナ ─────────────────────────────────────────
  refreshStamina: () => {
    const { stamina } = get();
    if (stamina.lastResetDate === today()) return;
    set({
      stamina: {
        postButtonsUsed : 0,
        likesUsed       : 0,
        repostsUsed     : 0,
        followsUsed     : 0,
        adPostsUsed     : 0,
        lastResetDate   : today(),
      },
    });
  },

  usePostButton: () => {
    get().refreshStamina();
    const { stamina, aiUser } = get();
    if (stamina.postButtonsUsed >= STAMINA.MAX_POST_BUTTONS) return false;
    if (!aiUser || aiUser.humanPostButtonsRemaining <= 0) return false;
    set(s => ({
      stamina: { ...s.stamina, postButtonsUsed: s.stamina.postButtonsUsed + 1 },
      aiUser: s.aiUser
        ? { ...s.aiUser, humanPostButtonsRemaining: s.aiUser.humanPostButtonsRemaining - 1 }
        : null,
    }));
    get().saveToStorage();
    return true;
  },

  useLike: () => {
    get().refreshStamina();
    if (get().stamina.likesUsed >= STAMINA.MAX_LIKES) return false;
    set(s => ({ stamina: { ...s.stamina, likesUsed: s.stamina.likesUsed + 1 } }));
    return true;
  },

  useRepost: () => {
    get().refreshStamina();
    if (get().stamina.repostsUsed >= STAMINA.MAX_REPOSTS) return false;
    set(s => ({ stamina: { ...s.stamina, repostsUsed: s.stamina.repostsUsed + 1 } }));
    return true;
  },

  useFollow: () => {
    get().refreshStamina();
    if (get().stamina.followsUsed >= STAMINA.MAX_FOLLOWS) return false;
    set(s => ({ stamina: { ...s.stamina, followsUsed: s.stamina.followsUsed + 1 } }));
    return true;
  },

  // ─── フォロー操作 ─────────────────────────────────────
  followUser: (userId) => {
    const { humanUser, useFollow } = get();
    if (!humanUser || humanUser.followingIds.includes(userId)) return false;
    if (!useFollow()) return false;
    set(s => ({
      humanUser: s.humanUser ? {
        ...s.humanUser,
        followingIds   : [...s.humanUser.followingIds, userId],
        followingCount : s.humanUser.followingCount + 1,
      } : null,
    }));
    return true;
  },

  unfollowUser: (userId) => {
    set(s => ({
      humanUser: s.humanUser ? {
        ...s.humanUser,
        followingIds   : s.humanUser.followingIds.filter(id => id !== userId),
        followingCount : Math.max(0, s.humanUser.followingCount - 1),
      } : null,
    }));
  },

  useAdPost: () => {
    get().refreshStamina();
    if (get().stamina.adPostsUsed >= STAMINA.MAX_AD_POSTS) return false;
    set(s => ({ stamina: { ...s.stamina, adPostsUsed: s.stamina.adPostsUsed + 1 } }));
    return true;
  },

  // ─── コイン ───────────────────────────────────────────
  earnCoins: (amount) => {
    set(s => ({
      humanUser: s.humanUser
        ? { ...s.humanUser, coins: s.humanUser.coins + amount }
        : null,
    }));
    get().saveToStorage();
  },

  spendCoins: (amount) => {
    const { humanUser } = get();
    if (!humanUser || humanUser.coins < amount) return false;
    set(s => ({
      humanUser: s.humanUser
        ? { ...s.humanUser, coins: s.humanUser.coins - amount }
        : null,
    }));
    get().saveToStorage();
    return true;
  },

  // ─── 永続化 ───────────────────────────────────────────
  saveToStorage: async () => {
    const { humanUser, aiUser, posts, stamina, notifications, unreadCount } = get();
    try {
      await AsyncStorage.setItem('humanUser',     JSON.stringify(humanUser));
      await AsyncStorage.setItem('aiUser',        JSON.stringify(aiUser));
      await AsyncStorage.setItem('posts',         JSON.stringify(posts.slice(0, 100)));
      await AsyncStorage.setItem('stamina',       JSON.stringify(stamina));
      await AsyncStorage.setItem('notifications', JSON.stringify(notifications.slice(0, 50)));
      await AsyncStorage.setItem('unreadCount',   String(unreadCount));
    } catch (e) {
      console.warn('saveToStorage error:', e);
    }
  },

  loadFromStorage: async () => {
    try {
      const [rawHuman, rawAI, rawPosts, rawStamina, rawNotifs, rawUnread, rawTheme, rawAccent] = await Promise.all([
        AsyncStorage.getItem('humanUser'),
        AsyncStorage.getItem('aiUser'),
        AsyncStorage.getItem('posts'),
        AsyncStorage.getItem('stamina'),
        AsyncStorage.getItem('notifications'),
        AsyncStorage.getItem('unreadCount'),
        AsyncStorage.getItem('themeMode'),
        AsyncStorage.getItem('accentColor'),
      ]);
      if (rawTheme)  set({ themeMode:   rawTheme  as ThemeMode });
      if (rawAccent) set({ accentColor: rawAccent as AccentId });
      const map = {
        humanUser     : rawHuman  ? JSON.parse(rawHuman)  : null,
        aiUser        : rawAI     ? JSON.parse(rawAI)     : null,
        posts         : rawPosts  ? JSON.parse(rawPosts)  : [],
        stamina       : rawStamina ? JSON.parse(rawStamina) : null,
        notifications : rawNotifs ? JSON.parse(rawNotifs) : [],
        unreadCount   : rawUnread ? Number(rawUnread) : 0,
      };

      if (map.aiUser)    map.aiUser.iconBase64    = migrateIconUrl(map.aiUser.iconBase64);
      if (map.humanUser) map.humanUser.iconBase64 = migrateIconUrl(map.humanUser.iconBase64);
      if (map.posts) {
        map.posts = (map.posts as PostData[]).map((p: PostData) => ({
          ...p,
          authorIconBase64: migrateIconUrl(p.authorIconBase64),
        }));
      }

      set({
        humanUser     : map.humanUser  ?? null,
        aiUser        : map.aiUser     ?? null,
        posts         : map.posts      ?? [],
        notifications : map.notifications ?? [],
        unreadCount   : map.unreadCount   ?? 0,
        stamina       : map.stamina    ?? {
          postButtonsUsed: 0, likesUsed: 0, repostsUsed: 0,
          followsUsed: 0, adPostsUsed: 0, lastResetDate: '',
        },
        isLoggedIn : !!map.humanUser,
      });

      get().refreshStamina();

      // Supabase が設定されていれば、ログイン状態を確認してリモート投稿を取得
      if (SUPABASE_CONFIGURED) {
        const sb = getSupabase();
        if (sb) {
          const { data: { session } } = await sb.auth.getSession();
          if (session?.user && !map.humanUser) {
            // セッションはあるがローカルにユーザーがいない場合は DB から復元
            const { data: hu } = await sb.from('human_users').select('*').eq('id', session.user.id).single();
            const { data: au } = await sb.from('ai_users').select('*').eq('linked_human_id', session.user.id).single();
            if (!hu) {
              // DB にユーザーが存在しない（削除済み） → セッションも破棄
              await sb.auth.signOut();
            } else if (hu) {
              const humanUser: UserData = {
                userId    : hu.id,
                username  : hu.username,
                displayName: hu.display_name,
                email     : hu.email,
                iconBase64: hu.icon_url,
                followersCount: hu.followers_count,
                followingCount: hu.following_count,
                postCount : 0,
                createdAt : hu.created_at,
                isAI      : false,
                coins     : hu.coins,
                freeIconRegenRemaining    : hu.free_icon_regen,
                freeChatInstructionsToday : 3,
                lastFreeChatResetDate     : '',
                followingIds : hu.following_ids ?? [],
                likedPostIds : hu.liked_post_ids ?? [],
                repostIds    : hu.repost_ids ?? [],
              };
              set({ humanUser, isLoggedIn: true });
              if (au) {
                const aiUser: AIUserData = {
                  ...humanUser,
                  userId    : au.id,
                  username  : au.username,
                  displayName: au.display_name,
                  iconBase64: au.icon_url,
                  isAI      : true,
                  personality: au.personality as any,
                  bio       : au.bio,
                  linkedHumanUserId : au.linked_human_id,
                  humanPostButtonsRemaining: au.post_buttons_remaining,
                  lastPostButtonResetDate  : '',
                  totalPostsMade           : au.total_posts_made,
                };
                set({ aiUser });
              }
            }
          }
          // リモート投稿を取得（マージ）
          await get().syncPostsFromSupabase();
        }
      }
    } catch (e) {
      console.warn('loadFromStorage error:', e);
    }
  },

  // ─── Supabase 認証 ────────────────────────────────────

  supabaseSignUp: async (email, password, displayName, username) => {
    const sb = getSupabase();
    if (!sb) return 'Supabaseが設定されていません';

    const { data, error } = await sb.auth.signUp({ email, password });
    if (error) return error.message;
    if (!data.user) return '登録に失敗しました';

    const userId = data.user.id;

    // human_users テーブルに挿入
    const { error: huErr } = await sb.from('human_users').insert({
      id           : userId,
      username,
      display_name : displayName,
      email,
      icon_url     : '',
      coins        : 100,
      free_icon_regen: 3,
      following_ids  : [],
      liked_post_ids : [],
      repost_ids     : [],
    });
    if (huErr) return huErr.message;

    const humanUser: UserData = {
      userId, username, displayName, email,
      iconBase64: '', followersCount: 0, followingCount: 0, postCount: 0,
      createdAt: new Date().toISOString(), isAI: false, coins: 100,
      freeIconRegenRemaining: 3, freeChatInstructionsToday: 3,
      lastFreeChatResetDate: '', followingIds: [], likedPostIds: [], repostIds: [],
    };
    set({ humanUser, isLoggedIn: true });
    get().refreshStamina();
    await get().syncPostsFromSupabase();
    return null;
  },

  supabaseSignIn: async (email, password) => {
    const sb = getSupabase();
    if (!sb) return 'Supabaseが設定されていません';

    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) return error.message;
    if (!data.user) return 'ログインに失敗しました';

    const userId = data.user.id;
    const { data: hu } = await sb.from('human_users').select('*').eq('id', userId).single();
    const { data: au } = await sb.from('ai_users').select('*').eq('linked_human_id', userId).single();

    if (!hu) return 'プロフィールが見つかりません。再登録してください';

    const humanUser: UserData = {
      userId: hu.id, username: hu.username, displayName: hu.display_name,
      email: hu.email, iconBase64: hu.icon_url,
      followersCount: hu.followers_count, followingCount: hu.following_count,
      postCount: 0, createdAt: hu.created_at, isAI: false, coins: hu.coins,
      freeIconRegenRemaining: hu.free_icon_regen,
      freeChatInstructionsToday: 3, lastFreeChatResetDate: '',
      followingIds: hu.following_ids ?? [], likedPostIds: hu.liked_post_ids ?? [],
      repostIds: hu.repost_ids ?? [],
    };
    set({ humanUser, isLoggedIn: true });

    if (au) {
      const aiUser: AIUserData = {
        ...humanUser,
        userId: au.id, username: au.username, displayName: au.display_name,
        iconBase64: au.icon_url, isAI: true,
        personality: au.personality as any, bio: au.bio,
        linkedHumanUserId: au.linked_human_id,
        humanPostButtonsRemaining: au.post_buttons_remaining,
        lastPostButtonResetDate: '', totalPostsMade: au.total_posts_made,
      };
      set({ aiUser });
    }

    get().refreshStamina();
    await get().syncPostsFromSupabase();
    return null;
  },

  supabaseSignOut: async () => {
    const sb = getSupabase();
    if (sb) await sb.auth.signOut();
    set({ humanUser: null, aiUser: null, isLoggedIn: false, posts: [] });
    await AsyncStorage.multiRemove(['humanUser', 'aiUser', 'posts']);
  },

  deleteAccount: async () => {
    const sb = getSupabase();
    let rpcError: string | null = null;

    if (sb) {
      // RPC でサーバー側削除（失敗してもローカル削除は続行）
      const { error } = await sb.rpc('delete_own_account');
      if (error) rpcError = error.message;
      // セッションを必ず破棄
      await sb.auth.signOut();
    }

    // ローカルデータを必ずすべてクリア
    set({
      humanUser: null, aiUser: null, isLoggedIn: false,
      posts: [], notifications: [], unreadCount: 0, chatMessages: [],
      stamina: {
        postButtonsUsed: 0, likesUsed: 0, repostsUsed: 0,
        followsUsed: 0, adPostsUsed: 0, lastResetDate: '',
      },
    });
    await AsyncStorage.clear();  // すべてのキーを一括削除

    // RPC エラーがあっても null を返す（ローカル削除は成功しているため）
    if (rpcError) console.warn('deleteAccount RPC error:', rpcError);
    return null;
  },

  // ─── Supabase 投稿同期 ────────────────────────────────

  syncPostsFromSupabase: async () => {
    const sb = getSupabase();
    if (!sb) return;
    try {
      const { data, error } = await sb
        .from('posts')
        .select('metadata')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error || !data) return;

      const remotePosts: PostData[] = data
        .map(row => row.metadata as PostData)
        .filter(Boolean);

      set(s => {
        const remoteMap = new Map(remotePosts.map(p => [p.postId, p]));
        const merged: PostData[] = [];
        const seen = new Set<string>();
        for (const p of s.posts) {
          seen.add(p.postId);
          const r = remoteMap.get(p.postId);
          merged.push(r ? mergePostsForSync(p, r) : p);
        }
        for (const p of remotePosts) {
          if (!seen.has(p.postId)) merged.push(p);
        }
        merged.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        return { posts: merged.slice(0, 300) };
      });
    } catch (e) {
      console.warn('syncPostsFromSupabase error:', e);
    }
  },

  // ─── リアルタイム購読（HomeScreen で開始・停止）──────

  startRealtimeSync: () => {
    const sb = getSupabase();
    if (!sb) return () => {};

    const channel = sb
      .channel('posts_changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'posts' },
        (payload) => {
          const newPost = (payload.new as any).metadata as PostData;
          if (!newPost) return;
          set(s => {
            if (s.posts.some(p => p.postId === newPost.postId)) return {};
            return { posts: [newPost, ...s.posts].slice(0, 300) };
          });
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'posts' },
        (payload) => {
          const remote = (payload.new as any).metadata as PostData;
          if (!remote?.postId) return;
          set(s => {
            const i = s.posts.findIndex(p => p.postId === remote.postId);
            if (i < 0) {
              return { posts: [remote, ...s.posts].slice(0, 300) };
            }
            const local = s.posts[i];
            const next  = mergePostsForSync(local, remote);
            if (
              next.likeCount === local.likeCount
              && next.repostCount === local.repostCount
              && next.commentCount === local.commentCount
              && next.comments.length === local.comments.length
            ) {
              return {};
            }
            const posts = [...s.posts];
            posts[i] = next;
            return { posts };
          });
        },
      )
      .subscribe();

    return () => { sb.removeChannel(channel); };
  },
}));
