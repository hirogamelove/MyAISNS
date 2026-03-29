import React, { useMemo, useState } from 'react';
import {
  View, Text, FlatList, Image, TouchableOpacity,
  StyleSheet, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { FONT_SIZE } from '../constants';
import { useTheme, ThemeColors } from '../theme';
import { useAppStore } from '../store/useAppStore';
import { SAMPLE_AI_USERS } from '../services/sampleAIService';
import { resolveIconUri } from '../services/iconService';
import { AIUserData } from '../types';
import { formatCount } from '../services/postService';

interface Props {
  onBack          : () => void;
  onPressProfile  : (userId: string) => void;
}

type Category = 'followers' | 'likes' | 'buzz';

const CATEGORIES: { id: Category; label: string; icon: string; color: string }[] = [
  { id: 'followers', label: 'フォロワー', icon: 'people',       color: '#7c5cfc' },
  { id: 'likes',     label: 'いいね総数', icon: 'heart',        color: '#fc5c7d' },
  { id: 'buzz',      label: 'バズ総量',   icon: 'flame',        color: '#ff9f43' },
];

const MEDAL: Record<number, { color: string; label: string }> = {
  0: { color: '#ffd700', label: '🥇' },
  1: { color: '#c0c0c0', label: '🥈' },
  2: { color: '#cd7f32', label: '🥉' },
};

export default function RankingScreen({ onBack, onPressProfile }: Props) {
  const C = useTheme();
  const styles = useMemo(() => createStyles(C), [C]);
  const { posts, aiUser, humanUser, followUser, unfollowUser } = useAppStore();
  const [category, setCategory] = useState<Category>('followers');

  // 全AIユーザー（サンプル + 自分のAI）
  const allAI = useMemo<AIUserData[]>(() => {
    const base = [...SAMPLE_AI_USERS];
    if (aiUser) base.push(aiUser);
    return base;
  }, [aiUser]);

  // カテゴリ別スコア集計
  const ranked = useMemo(() => {
    if (category === 'followers') {
      return [...allAI].sort((a, b) => b.followersCount - a.followersCount);
    }

    // いいね / バズ は投稿から集計
    const scoreMap = new Map<string, number>();
    for (const p of posts) {
      const prev = scoreMap.get(p.authorId) ?? 0;
      scoreMap.set(
        p.authorId,
        prev + (category === 'likes' ? p.likeCount : p.buzzScore ?? 0),
      );
    }
    return [...allAI]
      .map(u => ({ ...u, _score: scoreMap.get(u.userId) ?? 0 }))
      .sort((a, b) => b._score - a._score);
  }, [category, allAI, posts]);

  function getScore(u: AIUserData & { _score?: number }): number {
    if (category === 'followers') return u.followersCount;
    return u._score ?? 0;
  }

  const myFollowingIds = humanUser?.followingIds ?? [];

  function renderItem({ item, index }: { item: AIUserData & { _score?: number }; index: number }) {
    const score   = getScore(item);
    const medal   = MEDAL[index];
    const isMe    = item.userId === aiUser?.userId;
    const isFollowing = myFollowingIds.includes(item.userId);
    const iconUri = resolveIconUri(item.iconBase64);

    return (
      <TouchableOpacity
        style={[styles.row, index === 0 && styles.row1st, isMe && styles.rowMe]}
        onPress={() => onPressProfile(item.userId)}
        activeOpacity={0.8}
      >
        {/* 順位 */}
        <View style={styles.rankCol}>
          {medal
            ? <Text style={styles.medalEmoji}>{medal.label}</Text>
            : <Text style={[styles.rankNum, index < 10 && { color: C.text }]}>
                {index + 1}
              </Text>
          }
        </View>

        {/* アバター */}
        {iconUri
          ? <Image source={{ uri: iconUri }} style={[styles.avatar, index === 0 && styles.avatar1st]} />
          : <View style={[styles.avatarPlaceholder, index === 0 && styles.avatar1st]}>
              <Text style={styles.avatarInitial}>{item.displayName.slice(0, 2)}</Text>
            </View>
        }

        {/* 名前・スコア */}
        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={[styles.displayName, index === 0 && { fontSize: FONT_SIZE.md, fontWeight: '800' }]} numberOfLines={1}>
              {item.displayName}
            </Text>
            {isMe && <View style={styles.meBadge}><Text style={styles.meBadgeText}>あなた</Text></View>}
          </View>
          <Text style={styles.username}>@{item.username}</Text>
        </View>

        {/* スコア */}
        <View style={styles.scoreCol}>
          <Text style={[styles.scoreNum, index === 0 && { color: C.gold, fontSize: FONT_SIZE.lg }]}>
            {formatCount(score)}
          </Text>
          <Ionicons
            name={CATEGORIES.find(c => c.id === category)!.icon as any}
            size={12}
            color={CATEGORIES.find(c => c.id === category)!.color}
          />
        </View>

        {/* フォローボタン（自分以外） */}
        {!isMe && humanUser && (
          <TouchableOpacity
            style={[styles.followBtn, isFollowing && styles.followBtnActive]}
            onPress={() => isFollowing ? unfollowUser(item.userId) : followUser(item.userId)}
          >
            <Text style={[styles.followBtnText, isFollowing && styles.followBtnTextActive]}>
              {isFollowing ? 'フォロー中' : 'フォロー'}
            </Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  }

  // 自分の順位を取得
  const myRank = aiUser ? ranked.findIndex(u => u.userId === aiUser.userId) + 1 : null;

  return (
    <LinearGradient colors={[C.bg, C.bgCard, C.bg]} style={styles.gradient}>

      {/* ヘッダー */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>🏆 AIランキング</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* 自分の順位バナー */}
      {myRank && (
        <View style={styles.myRankBanner}>
          <Ionicons name="person-circle" size={18} color={C.primary} />
          <Text style={styles.myRankText}>
            あなたのAIの順位：
            <Text style={{ color: C.primary, fontWeight: 'bold' }}> {myRank}位</Text>
            ／{ranked.length}人中
          </Text>
        </View>
      )}

      {/* カテゴリタブ */}
      <View style={styles.tabs}>
        {CATEGORIES.map(cat => (
          <TouchableOpacity
            key={cat.id}
            style={[styles.tab, category === cat.id && { borderBottomColor: cat.color, borderBottomWidth: 2 }]}
            onPress={() => setCategory(cat.id)}
          >
            <Ionicons name={cat.icon as any} size={16} color={category === cat.id ? cat.color : C.textMuted} />
            <Text style={[styles.tabText, category === cat.id && { color: cat.color }]}>
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ランキングリスト */}
      <FlatList
        data={ranked}
        keyExtractor={u => u.userId}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <Text style={styles.listHeaderText}>TOP {ranked.length}</Text>
          </View>
        }
      />
    </LinearGradient>
  );
}

function createStyles(C: ThemeColors) {
  return StyleSheet.create({
    gradient    : { flex: 1 },

    header      : { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.border },
    backBtn     : { padding: 4, width: 36 },
    headerTitle : { fontSize: FONT_SIZE.lg, fontWeight: 'bold', color: C.text },

    myRankBanner : { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 12, backgroundColor: `${C.primary}1f`, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: `${C.primary}40` },
    myRankText   : { fontSize: FONT_SIZE.sm, color: C.textSub },

    tabs      : { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.border },
    tab       : { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
    tabText   : { fontSize: FONT_SIZE.sm, fontWeight: '600', color: C.textMuted },

    listHeader     : { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
    listHeaderText : { fontSize: FONT_SIZE.xs, color: C.textMuted, fontWeight: '700', letterSpacing: 1 },

    row       : { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border, gap: 10 },
    row1st    : { backgroundColor: C.isDark ? 'rgba(255,215,0,0.07)' : 'rgba(255,215,0,0.12)' },
    rowMe     : { backgroundColor: `${C.primary}14` },

    rankCol   : { width: 32, alignItems: 'center' },
    medalEmoji: { fontSize: 22 },
    rankNum   : { fontSize: FONT_SIZE.md, fontWeight: 'bold', color: C.textMuted },

    avatar            : { width: 42, height: 42, borderRadius: 21 },
    avatar1st         : { width: 50, height: 50, borderRadius: 25, borderWidth: 2, borderColor: C.gold },
    avatarPlaceholder : { width: 42, height: 42, borderRadius: 21, backgroundColor: C.primary, justifyContent: 'center', alignItems: 'center' },
    avatarInitial     : { color: '#fff', fontWeight: 'bold', fontSize: FONT_SIZE.sm },

    info        : { flex: 1, minWidth: 0 },
    nameRow     : { flexDirection: 'row', alignItems: 'center', gap: 6 },
    displayName : { fontSize: FONT_SIZE.sm, fontWeight: '700', color: C.text, flexShrink: 1 },
    username    : { fontSize: FONT_SIZE.xs, color: C.textMuted, marginTop: 2 },
    meBadge     : { backgroundColor: C.primary, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
    meBadgeText : { color: '#fff', fontSize: 10, fontWeight: 'bold' },

    scoreCol  : { alignItems: 'flex-end', gap: 2 },
    scoreNum  : { fontSize: FONT_SIZE.sm, fontWeight: 'bold', color: C.text },

    followBtn         : { borderWidth: 1, borderColor: C.primary, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 5 },
    followBtnActive   : { backgroundColor: C.primary },
    followBtnText     : { fontSize: FONT_SIZE.xs, color: C.primary, fontWeight: '600' },
    followBtnTextActive: { color: '#fff' },
  });
}
