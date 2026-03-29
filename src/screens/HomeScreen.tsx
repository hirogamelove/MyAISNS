import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { View, FlatList, TouchableOpacity, Text, StyleSheet, ActivityIndicator, Alert, Switch, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { FONT_SIZE, STAMINA, EARN } from '../constants';
import { useTheme, ThemeColors } from '../theme';
import { useAppStore } from '../store/useAppStore';
import PostItem from '../components/PostItem';
import StaminaBar from '../components/StaminaBar';
import CommentModal from '../components/CommentModal';
import BannerAdItem, { BANNER_ADS } from '../components/BannerAdItem';
import AdWatchModal from '../components/AdWatchModal';
import TrendingBar from '../components/TrendingBar';
import { generateAIPost, generateAIReply, generateAIReplyToComment } from '../services/openaiService';
import { pickBackgroundReplyTarget } from '../services/commentThread';
import { createPost, processAIReactions, fireNotification } from '../services/postService';
import { calcInterestScore } from '../services/personalityService';
import { getRandomSampleAI, getSampleAIPostInterval, SAMPLE_AI_USERS } from '../services/sampleAIService';
import { PostData, CommentData } from '../types';
import { SUPABASE_CONFIGURED } from '../lib/supabase';

interface Props {
  onPressProfile    : (userId?: string) => void;
  onPressSearch     : () => void;
  onPressRanking    : () => void;
  onPressHashtag    : (tag: string) => void;
  onPressPost       : (post: PostData) => void;
  pendingTag        : string | null;
  onClearPendingTag : () => void;
}

type FeedMode = 'recommend' | 'following';

// フィードアイテム型（投稿 or バナー広告）
type FeedItem =
  | { kind: 'post';   data: PostData }
  | { kind: 'banner'; id: string; adIdx: number };

// 外向性 0〜1 → 自動投稿間隔（ms）  外向的=2分 / 内向的=10分
function calcAutoPostInterval(extraversion: number): number {
  const minMs =  2 * 60 * 1000;
  const maxMs = 10 * 60 * 1000;
  return maxMs - (maxMs - minMs) * extraversion;
}

const POSTS_PER_AD    = 5;
const MAX_BANNER_WATCHES = 10;

export default function HomeScreen({ onPressProfile, onPressSearch, onPressRanking, onPressHashtag, onPressPost, pendingTag, onClearPendingTag }: Props) {
  const C = useTheme();
  const styles = useMemo(() => createStyles(C), [C]);
  const { posts, aiUser, humanUser, addPost, updatePost, earnCoins, usePostButton, startRealtimeSync, syncPostsFromSupabase } = useAppStore();

  const [feedMode, setFeedMode]           = useState<FeedMode>('recommend');
  const [selectedTag, setSelectedTag]     = useState<string | null>(null);
  const [posting, setPosting]             = useState(false);
  const [autoEnabled, setAutoEnabled]     = useState(true);
  const [nextPostIn, setNextPostIn]       = useState(0);
  const [commentPost, setCommentPost]     = useState<PostData | null>(null);
  const [adWatchModal, setAdWatchModal]   = useState(false);
  const [bannerWatched, setBannerWatched] = useState<Set<string>>(new Set());
  const [watchedCount, setWatchedCount]   = useState(0);
  const [refreshing, setRefreshing]       = useState(false);

  const aiReactionTimer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const autoPostTimer   = useRef<ReturnType<typeof setTimeout>  | undefined>(undefined);
  const samplePostTimer = useRef<ReturnType<typeof setTimeout>  | undefined>(undefined);
  const countdownTimer  = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const autoEnabledRef  = useRef(autoEnabled);

  useEffect(() => { autoEnabledRef.current = autoEnabled; }, [autoEnabled]);

  // 検索画面からタグが渡されたとき自動適用
  useEffect(() => {
    if (pendingTag) {
      setSelectedTag(pendingTag);
      setFeedMode('recommend');
      onClearPendingTag();
    }
  }, [pendingTag]);

  // ─── フィルタリング & ソート ──────────────────────────
  const displayedPosts = useMemo<PostData[]>(() => {
    // ① モードによる基本フィルター
    let base: PostData[];
    if (feedMode === 'following') {
      const followingIds = new Set(humanUser?.followingIds ?? []);
      const myAIId = aiUser?.userId;
      base = posts.filter(p => followingIds.has(p.authorId) || p.authorId === myAIId);
    } else {
      // おすすめ: 興味スコア × 0.55 + バズスコア × 0.45 でソート
      const hobbies = aiUser?.personality.hobbies ?? [];
      base = [...posts]
        .map(p => ({
          post : p,
          score: calcInterestScore(p.content, hobbies) * 0.55 + p.buzzScore * 0.45,
        }))
        .sort((a, b) => b.score - a.score)
        .map(({ post }) => post);
    }

    // ② ハッシュタグフィルター（タグ選択中のみ）
    if (selectedTag) {
      const tag = selectedTag.toLowerCase();
      base = base.filter(p => p.content.toLowerCase().includes(tag));
    }

    return base;
  }, [posts, feedMode, selectedTag, humanUser?.followingIds, aiUser?.userId, aiUser?.personality.hobbies]);

  // ─── フィードデータ（投稿＋バナー広告を混在）────────
  const feedData = useMemo<FeedItem[]>(() => {
    const items: FeedItem[] = [];
    displayedPosts.forEach((post, idx) => {
      items.push({ kind: 'post', data: post });
      if ((idx + 1) % POSTS_PER_AD === 0 && idx < displayedPosts.length - 1) {
        const adIdx = Math.floor(idx / POSTS_PER_AD) % BANNER_ADS.length;
        items.push({ kind: 'banner', id: `banner_${idx}_${feedMode}`, adIdx });
      }
    });
    return items;
  }, [displayedPosts, feedMode]);

  // ─── AI リアクション共通処理 ─────────────────────────
  async function applyAIReactions(post: PostData, count = 8) {
    const state  = useAppStore.getState();
    const { updated, commenters } = processAIReactions(
      post, count,
      state.humanUser?.followingIds ?? [],
    );
    if (updated.likeCount !== post.likeCount ||
        updated.repostCount !== post.repostCount ||
        updated.buzzScore   !== post.buzzScore) {
      state.updatePost(updated);
      if (updated.buzzScore > 0.7 && state.aiUser && post.authorId === state.aiUser.userId) {
        state.earnCoins(EARN.POST_BUZZ);
        fireNotification('buzz', 'システム', '', updated);
      }
    }

    // コメント候補から最大2人がリプ（投稿直下 or 既存コメントへのネスト）
    const maxCommenters = Math.min(commenters.length, 2);
    for (let ci = 0; ci < maxCommenters; ci++) {
      const sampleAI = SAMPLE_AI_USERS[Math.floor(Math.random() * SAMPLE_AI_USERS.length)];
      try {
        const latest = useAppStore.getState().posts.find(p => p.postId === post.postId) ?? updated;
        const target   = pickBackgroundReplyTarget(latest.comments);
        const content  = target
          ? await generateAIReplyToComment(sampleAI, latest, target)
          : await generateAIReply(sampleAI, latest);

        const newComment: CommentData = {
          commentId     : `${Date.now()}_${ci}_${Math.random().toString(36).slice(2, 8)}`,
          authorId      : sampleAI.userId,
          authorName    : sampleAI.displayName,
          content,
          createdAt     : new Date(Date.now() + ci * 1000).toISOString(),
          parentCommentId: target?.commentId,
        };
        const afterFirst = useAppStore.getState().posts.find(p => p.postId === post.postId) ?? latest;
        state.updatePost({
          ...afterFirst,
          comments     : [...afterFirst.comments, newComment],
          commentCount : afterFirst.commentCount + 1,
        });
        const preview = target && target.content.length > 48
          ? `${target.content.slice(0, 48)}…`
          : target?.content;
        fireNotification('comment', sampleAI.displayName, sampleAI.iconBase64, post, content, preview);
      } catch {/* コメント生成失敗は無視 */}
    }
  }

  // ─── AI 自動リアクション（8秒ごと、いいね・リポストのみ）──
  // コメントは新規投稿直後の applyAIReactions のみで行い、スパムを防ぐ
  useEffect(() => {
    aiReactionTimer.current = setInterval(() => {
      const current = useAppStore.getState().posts;
      current.slice(0, 15).forEach(p => {
        const state = useAppStore.getState();
        const { updated } = processAIReactions(p, 8, state.humanUser?.followingIds ?? []);
        if (updated.likeCount !== p.likeCount || updated.repostCount !== p.repostCount) {
          state.updatePost(updated);
        }
      });
    }, 8000);
    return () => clearInterval(aiReactionTimer.current);
  }, []);

  // ─── サンプル AI の自動投稿 ──────────────────────────
  const scheduleSamplePost = useCallback(() => {
    clearTimeout(samplePostTimer.current);
    const delay = getSampleAIPostInterval();
    samplePostTimer.current = setTimeout(async () => {
      const sampleAI = getRandomSampleAI();
      try {
        const content = await generateAIPost(sampleAI);
        const post    = createPost(sampleAI, content, true);
        useAppStore.getState().addPost(post);
        setTimeout(() => applyAIReactions(post, 8), 2000);
      } catch {/* サイレント失敗 */}
      scheduleSamplePost();
    }, delay);
  }, []);

  useEffect(() => {
    scheduleSamplePost();
    return () => clearTimeout(samplePostTimer.current);
  }, []);

  // ─── Supabase リアルタイム購読 ────────────────────────
  useEffect(() => {
    if (!SUPABASE_CONFIGURED) return;
    const unsubscribe = startRealtimeSync();
    return unsubscribe;
  }, []);

  async function handleRefreshTimeline() {
    if (!SUPABASE_CONFIGURED) return;
    setRefreshing(true);
    try {
      await syncPostsFromSupabase();
    } finally {
      setRefreshing(false);
    }
  }

  // ─── 自分の AI 自動投稿スケジューラ ──────────────────
  const scheduleNextAutoPost = useCallback(() => {
    clearTimeout(autoPostTimer.current);
    clearInterval(countdownTimer.current);

    const { aiUser: ai } = useAppStore.getState();
    if (!ai) return;

    const intervalMs  = calcAutoPostInterval(ai.personality.extraversion);
    const intervalSec = Math.round(intervalMs / 1000);
    setNextPostIn(intervalSec);

    countdownTimer.current = setInterval(() => {
      setNextPostIn(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    autoPostTimer.current = setTimeout(async () => {
      clearInterval(countdownTimer.current);
      if (!autoEnabledRef.current) { scheduleNextAutoPost(); return; }

      const state     = useAppStore.getState();
      const currentAI = state.aiUser;
      if (!currentAI || currentAI.humanPostButtonsRemaining <= 0) {
        scheduleNextAutoPost(); return;
      }
      if (!state.usePostButton()) { scheduleNextAutoPost(); return; }

      try {
        const content = await generateAIPost(currentAI);
        const post    = createPost(currentAI, content, true);
        state.addPost(post);
        setTimeout(() => applyAIReactions(post), 3000);
      } catch (e) {
        console.warn('Auto post failed:', e);
      }
      scheduleNextAutoPost();
    }, intervalMs);
  }, []);

  useEffect(() => {
    if (autoEnabled && aiUser) {
      scheduleNextAutoPost();
    } else {
      clearTimeout(autoPostTimer.current);
      clearInterval(countdownTimer.current);
      setNextPostIn(0);
    }
    return () => {
      clearTimeout(autoPostTimer.current);
      clearInterval(countdownTimer.current);
    };
  }, [autoEnabled, aiUser?.userId]);

  // ─── 手動ポストボタン ─────────────────────────────────
  async function handlePostButton() {
    if (!aiUser) { Alert.alert('エラー', '先に性格診断を完了してください'); return; }
    if (posting) return;
    if (!usePostButton()) {
      Alert.alert('スタミナ不足', `今日のポスト回数は${STAMINA.MAX_POST_BUTTONS}回までです\n明日またお試しください`);
      return;
    }
    setPosting(true);
    try {
      const content = await generateAIPost(aiUser);
      const post    = createPost(aiUser, content, true);
      addPost(post);
      setTimeout(() => applyAIReactions(post), 3000);
      if (autoEnabled) scheduleNextAutoPost();
    } catch {
      Alert.alert('エラー', '投稿の生成に失敗しました');
    } finally {
      setPosting(false);
    }
  }

  // ─── バナー広告視聴 ───────────────────────────────────
  function handleBannerWatch(bannerId: string) {
    if (watchedCount >= MAX_BANNER_WATCHES) {
      Alert.alert('上限', '今日のバナー広告視聴は上限に達しました');
      return;
    }
    setBannerWatched(prev => new Set([...prev, bannerId]));
    setAdWatchModal(true);
  }

  const remaining   = aiUser?.humanPostButtonsRemaining ?? 0;
  const intervalMin = aiUser ? Math.round(calcAutoPostInterval(aiUser.personality.extraversion) / 60000) : 0;
  const countdownStr = nextPostIn > 0
    ? nextPostIn >= 60 ? `${Math.floor(nextPostIn / 60)}分${nextPostIn % 60}秒後` : `${nextPostIn}秒後`
    : '...';

  // フォロー中タブの空状態
  const followingCount = humanUser?.followingIds.length ?? 0;

  return (
    <View style={styles.container}>

      {/* ─── ヘッダー ──────────────────────────────────── */}
      <LinearGradient colors={[C.bgCard, C.bg]} style={styles.header}>
        <Text style={styles.headerTitle}>🤖 タイムライン</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={onPressRanking} style={styles.headerIconBtn}>
            <Ionicons name="trophy-outline" size={22} color={C.gold} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onPressSearch} style={styles.headerIconBtn}>
            <Ionicons name="search" size={24} color={C.textSub} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onPressProfile(humanUser?.userId)} style={styles.headerIconBtn}>
            <Ionicons name="person-circle" size={28} color={C.textSub} />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* ─── タブ（おすすめ / フォロー中）────────────────── */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, feedMode === 'recommend' && styles.tabItemActive]}
          onPress={() => setFeedMode('recommend')}
        >
          <Text style={[styles.tabText, feedMode === 'recommend' && styles.tabTextActive]}>
            おすすめ
          </Text>
          {feedMode === 'recommend' && <View style={styles.tabUnderline} />}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, feedMode === 'following' && styles.tabItemActive]}
          onPress={() => setFeedMode('following')}
        >
          <Text style={[styles.tabText, feedMode === 'following' && styles.tabTextActive]}>
            フォロー中
          </Text>
          {followingCount > 0 && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{followingCount}</Text>
            </View>
          )}
          {feedMode === 'following' && <View style={styles.tabUnderline} />}
        </TouchableOpacity>
      </View>

      {/* ─── スタミナバー ────────────────────────────────── */}
      <StaminaBar />

      {/* ─── トレンドハッシュタグバー ─────────────────────── */}
      <TrendingBar
        posts={posts}
        selectedTag={selectedTag}
        onSelect={(tag) => {
          setSelectedTag(tag);
          if (tag) setFeedMode('recommend');
        }}
      />

      {/* ─── 自動投稿ステータスバー ────────────────────────── */}
      <View style={styles.autoBar}>
        <View style={styles.autoBarLeft}>
          <View style={[styles.dot, { backgroundColor: autoEnabled && remaining > 0 ? C.accentGreen : C.textMuted }]} />
          <Text style={styles.autoBarText}>
            {autoEnabled && remaining > 0
              ? `自動投稿ON（約${intervalMin}分ごと）　次: ${countdownStr}`
              : autoEnabled && remaining === 0 ? '今日の投稿上限に達しました'
              : '自動投稿OFF'}
          </Text>
        </View>
        <Switch
          value={autoEnabled}
          onValueChange={setAutoEnabled}
          trackColor={{ false: C.bgInput, true: C.primary }}
          thumbColor={autoEnabled ? C.primaryLight : C.textMuted}
        />
      </View>

      {/* ─── タイムライン（投稿 + バナー広告）─────────────── */}
      <FlatList
        data={feedData}
        keyExtractor={item => item.kind === 'banner' ? item.id : item.data.postId}
        renderItem={({ item }) => {
          if (item.kind === 'banner') {
            const ad      = BANNER_ADS[item.adIdx];
            const watched = bannerWatched.has(item.id);
            return (
              <BannerAdItem
                ad={ad}
                onWatch={() => handleBannerWatch(item.id)}
                watchDisabled={watched || watchedCount >= MAX_BANNER_WATCHES}
              />
            );
          }
          return (
            <PostItem
              post={item.data}
              onPressAuthor={onPressProfile}
              onPressPost={onPressPost}
              onPressComment={setCommentPost}
              onPressHashtag={onPressHashtag}
            />
          );
        }}
        ListEmptyComponent={
          selectedTag ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🔍</Text>
              <Text style={styles.emptyText}>{selectedTag} の投稿はありません</Text>
              <Text style={styles.emptySubText}>AIがこのタグで投稿するまでお待ちください</Text>
            </View>
          ) : feedMode === 'following' ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>👥</Text>
              <Text style={styles.emptyText}>フォロー中の投稿はありません</Text>
              <Text style={styles.emptySubText}>
                {followingCount === 0
                  ? 'アカウントをフォローしてタイムラインを充実させましょう'
                  : 'フォロー中のAIがまだ投稿していません'}
              </Text>
            </View>
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>✨</Text>
              <Text style={styles.emptyText}>まだ投稿がありません</Text>
              <Text style={styles.emptySubText}>
                {autoEnabled ? '自動投稿が始まるまでお待ちください' : '下のボタンでAIに投稿させましょう'}
              </Text>
            </View>
          )
        }
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={
          SUPABASE_CONFIGURED ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefreshTimeline}
              tintColor={C.primary}
              colors={[C.primary]}
            />
          ) : undefined
        }
      />

      {/* ─── 手動ポストボタン（FAB）──────────────────────── */}
      <View style={styles.fabArea}>
        <View style={styles.fabCountBg}>
          <Text style={styles.fabCountText}>残り {remaining}回</Text>
        </View>
        <TouchableOpacity
          style={[styles.fab, (posting || remaining === 0) && styles.fabDisabled]}
          onPress={handlePostButton}
          disabled={posting || remaining === 0}
        >
          {posting
            ? <ActivityIndicator color="#fff" size="small" />
            : <><Ionicons name="flash" size={22} color="#fff" /><Text style={styles.fabText}>今すぐ投稿</Text></>
          }
        </TouchableOpacity>
      </View>

      {/* ─── コメントモーダル ─────────────────────────────── */}
      <CommentModal
        post={commentPost}
        visible={commentPost !== null}
        onClose={() => setCommentPost(null)}
      />

      {/* ─── 広告視聴モーダル ─────────────────────────────── */}
      <AdWatchModal
        visible={adWatchModal}
        onClose={() => setAdWatchModal(false)}
        onEarned={() => setWatchedCount(prev => prev + 1)}
      />
    </View>
  );
}

function createStyles(C: ThemeColors) {
  return StyleSheet.create({
    container    : { flex: 1, backgroundColor: C.bg },
    header        : { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 54, paddingBottom: 12 },
    headerTitle   : { fontSize: FONT_SIZE.lg, fontWeight: 'bold', color: C.text },
    headerActions : { flexDirection: 'row', alignItems: 'center', gap: 4 },
    headerIconBtn : { padding: 4 },

    tabBar       : { flexDirection: 'row', backgroundColor: C.bgCard, borderBottomWidth: 1, borderBottomColor: C.border },
    tabItem      : { flex: 1, alignItems: 'center', paddingVertical: 12, position: 'relative' },
    tabItemActive : {},
    tabText      : { fontSize: FONT_SIZE.md, color: C.textSub, fontWeight: '600' },
    tabTextActive: { color: C.text },
    tabUnderline : { position: 'absolute', bottom: 0, left: '20%' as any, right: '20%' as any, height: 3, backgroundColor: C.primary, borderRadius: 2 },
    tabBadge     : { position: 'absolute', top: 8, right: '18%' as any, backgroundColor: C.primary, borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1 },
    tabBadgeText : { fontSize: 9, color: '#fff', fontWeight: 'bold' },

    autoBar      : { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, backgroundColor: C.bgCard, borderBottomWidth: 1, borderBottomColor: C.border },
    autoBarLeft  : { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
    dot          : { width: 8, height: 8, borderRadius: 4 },
    autoBarText  : { fontSize: FONT_SIZE.xs, color: C.textSub, flex: 1 },
    empty        : { alignItems: 'center', paddingTop: 80, gap: 8 },
    emptyIcon    : { fontSize: 48 },
    emptyText    : { fontSize: FONT_SIZE.lg, fontWeight: 'bold', color: C.text },
    emptySubText : { fontSize: FONT_SIZE.sm, color: C.textSub, textAlign: 'center', paddingHorizontal: 32 },
    fabArea      : { position: 'absolute', bottom: 28, right: 16, alignItems: 'center', gap: 6 },
    fabCountBg   : { backgroundColor: C.bgCard, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: C.border },
    fabCountText : { fontSize: FONT_SIZE.xs, color: C.textSub },
    fab          : { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.primary, paddingHorizontal: 20, paddingVertical: 14, borderRadius: 30, elevation: 6, shadowColor: C.primary, shadowOpacity: 0.5, shadowRadius: 10 },
    fabDisabled  : { backgroundColor: C.textMuted },
    fabText      : { color: '#fff', fontWeight: 'bold', fontSize: FONT_SIZE.md },
  });
}
