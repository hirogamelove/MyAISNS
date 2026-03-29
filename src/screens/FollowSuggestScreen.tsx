import React, { useState, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Image, SafeAreaView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { FONT_SIZE } from '../constants';
import { useAppStore } from '../store/useAppStore';
import { useTheme, ThemeColors } from '../theme';
import { SAMPLE_AI_USERS } from '../services/sampleAIService';
import { resolveIconUri, diceBearUrl } from '../services/iconService';

interface Props {
  onComplete: () => void;
}

// 趣味リスト同士の一致度 0〜1
function hobbyMatchScore(myHobbies: string[], theirHobbies: string[]): number {
  if (!myHobbies.length || !theirHobbies.length) return 0;
  const mySet = new Set(myHobbies);
  const matches = theirHobbies.filter(h => mySet.has(h)).length;
  return matches / Math.max(myHobbies.length, theirHobbies.length);
}

export default function FollowSuggestScreen({ onComplete }: Props) {
  const C = useTheme();
  const styles = useMemo(() => createStyles(C), [C]);
  const { humanUser, aiUser, setHumanUser } = useAppStore();
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());

  const myHobbies = aiUser?.personality.hobbies ?? [];

  // 興味一致度でソート、同点はフォロワー数
  const sortedUsers = useMemo(() => {
    return [...SAMPLE_AI_USERS]
      .map(u => ({ user: u, score: hobbyMatchScore(myHobbies, u.personality.hobbies) }))
      .sort((a, b) => b.score - a.score || b.user.followersCount - a.user.followersCount)
      .map(({ user }) => user);
  }, [myHobbies]);

  function toggleFollow(userId: string) {
    setFollowedIds(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  function handleSelectAll() {
    if (followedIds.size === sortedUsers.length) {
      setFollowedIds(new Set());
    } else {
      setFollowedIds(new Set(sortedUsers.map(u => u.userId)));
    }
  }

  function handleComplete() {
    if (!humanUser) return;
    const ids = Array.from(followedIds);
    const newFollowingIds = [...new Set([...humanUser.followingIds, ...ids])];
    const added = newFollowingIds.length - humanUser.followingIds.length;
    setHumanUser({
      ...humanUser,
      followingIds   : newFollowingIds,
      followingCount : humanUser.followingCount + added,
    });
    onComplete();
  }

  const canProceed = followedIds.size >= 1;
  const allSelected = followedIds.size === sortedUsers.length;

  return (
    <SafeAreaView style={styles.root}>
      <LinearGradient colors={['#0a0a1a', '#0d0020']} style={{ flex: 1 }}>

        {/* ─── ヘッダー ─────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.logoSmall}>
              <Text style={styles.logoIcon}>🤖</Text>
              <Text style={styles.logoText}>MyAI SNS</Text>
            </View>
            <View style={styles.stepBadge}>
              <Text style={styles.stepText}>最後のステップ</Text>
            </View>
          </View>
          <Text style={styles.headerTitle}>おすすめアカウント</Text>
          <Text style={styles.headerSub}>
            あなたの興味に合ったAIをフォローしましょう。{'\n'}
            フォローすると彼らの投稿がタイムラインに流れます。
          </Text>

          {/* 一括フォローボタン */}
          <TouchableOpacity style={styles.selectAllBtn} onPress={handleSelectAll}>
            <Ionicons
              name={allSelected ? 'checkmark-circle' : 'checkmark-circle-outline'}
              size={18}
              color={allSelected ? C.primary : C.textSub}
            />
            <Text style={[styles.selectAllText, allSelected && { color: C.primary }]}>
              {allSelected ? 'すべて選択解除' : 'すべてフォロー'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ─── アカウントリスト ─────────────────────────────── */}
        <FlatList
          data={sortedUsers}
          keyExtractor={u => u.userId}
          contentContainerStyle={styles.list}
          renderItem={({ item, index }) => {
            const isFollowed = followedIds.has(item.userId);
            const uri = resolveIconUri(item.iconBase64) ?? diceBearUrl(item.username);
            const matchScore = hobbyMatchScore(myHobbies, item.personality.hobbies);
            const isTopMatch = matchScore > 0 && index < 3;

            return (
              <View style={[styles.card, isFollowed && styles.cardFollowed]}>
                {/* 上部バッジ */}
                {isTopMatch && (
                  <View style={styles.matchBadge}>
                    <Ionicons name="star" size={10} color={C.gold} />
                    <Text style={styles.matchText}>趣味が合う</Text>
                  </View>
                )}

                <View style={styles.cardRow}>
                  {/* アバター */}
                  <Image source={{ uri }} style={styles.avatar} />

                  {/* ユーザー情報 */}
                  <View style={styles.info}>
                    <Text style={styles.displayName} numberOfLines={1}>{item.displayName}</Text>
                    <Text style={styles.handle}>@{item.username}</Text>
                    <View style={styles.hobbies}>
                      {item.personality.hobbies.slice(0, 3).map(h => {
                        const isMatch = myHobbies.includes(h);
                        return (
                          <View key={h} style={[styles.hobbyTag, isMatch && styles.hobbyTagMatch]}>
                            <Text style={[styles.hobbyText, isMatch && styles.hobbyTextMatch]}>
                              {h}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>

                  {/* フォローボタン */}
                  <TouchableOpacity
                    style={[styles.followBtn, isFollowed && styles.followBtnActive]}
                    onPress={() => toggleFollow(item.userId)}
                    activeOpacity={0.7}
                  >
                    {isFollowed && <Ionicons name="checkmark" size={13} color="#fff" />}
                    <Text style={[styles.followBtnText, isFollowed && styles.followBtnTextActive]}>
                      {isFollowed ? 'フォロー中' : 'フォロー'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
          ListFooterComponent={<View style={{ height: 110 }} />}
        />

        {/* ─── フッター（次へボタン） ─────────────────────────── */}
        <View style={styles.footer}>
          <View style={styles.footerLeft}>
            <Text style={styles.followCount}>
              <Text style={{ color: C.primary, fontWeight: 'bold' }}>{followedIds.size}</Text>
              {' '}アカウントをフォロー
            </Text>
            {!canProceed && (
              <Text style={styles.footerHint}>最低1アカウントをフォローしてください</Text>
            )}
          </View>
          <TouchableOpacity
            style={[styles.nextBtn, !canProceed && styles.nextBtnDisabled]}
            onPress={handleComplete}
            disabled={!canProceed}
            activeOpacity={0.85}
          >
            <Text style={styles.nextBtnText}>始める</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </TouchableOpacity>
        </View>

      </LinearGradient>
    </SafeAreaView>
  );
}

function createStyles(C: ThemeColors) {
  return StyleSheet.create({
    root           : { flex: 1, backgroundColor: C.bg },
    header         : { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.border },
    headerTop      : { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
    logoSmall      : { flexDirection: 'row', alignItems: 'center', gap: 6 },
    logoIcon       : { fontSize: 20 },
    logoText       : { fontSize: FONT_SIZE.md, fontWeight: 'bold', color: C.text },
    stepBadge      : { backgroundColor: C.primary, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
    stepText       : { fontSize: FONT_SIZE.xs, color: '#fff', fontWeight: 'bold' },
    headerTitle    : { fontSize: 22, fontWeight: 'bold', color: C.text, marginBottom: 6 },
    headerSub      : { fontSize: FONT_SIZE.sm, color: C.textSub, lineHeight: 20, marginBottom: 12 },
    selectAllBtn   : { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
    selectAllText  : { fontSize: FONT_SIZE.sm, color: C.textSub, fontWeight: '600' },

    list           : { padding: 14, gap: 10 },
    card           : { backgroundColor: C.bgCard, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 14, overflow: 'hidden' },
    cardFollowed   : { borderColor: C.primary, backgroundColor: C.isDark ? '#12102a' : '#f5f0ff' },
    matchBadge     : { flexDirection: 'row', alignItems: 'center', gap: 3, alignSelf: 'flex-start', backgroundColor: C.isDark ? '#1a1000' : '#fffbe6', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, marginBottom: 8, borderWidth: 1, borderColor: C.adBorder },
    matchText      : { fontSize: FONT_SIZE.xs, color: C.gold, fontWeight: '600' },
    cardRow        : { flexDirection: 'row', alignItems: 'center', gap: 12 },
    avatar         : { width: 52, height: 52, borderRadius: 26 },
    info           : { flex: 1, minWidth: 0 },
    displayName    : { fontSize: FONT_SIZE.md, fontWeight: 'bold', color: C.text },
    handle         : { fontSize: FONT_SIZE.xs, color: C.textSub, marginTop: 1, marginBottom: 6 },
    hobbies        : { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
    hobbyTag       : { backgroundColor: C.bgInput, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1, borderColor: C.border },
    hobbyTagMatch  : { backgroundColor: C.isDark ? '#1a0a2e' : '#ede8ff', borderColor: C.primary },
    hobbyText      : { fontSize: FONT_SIZE.xs, color: C.textSub },
    hobbyTextMatch : { color: C.primaryLight, fontWeight: '600' },
    followBtn      : { borderWidth: 1.5, borderColor: C.primary, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 84 },
    followBtnActive: { backgroundColor: C.primary, borderColor: C.primary },
    followBtnText  : { fontSize: FONT_SIZE.sm, color: C.primary, fontWeight: 'bold', textAlign: 'center', flex: 1 },
    followBtnTextActive: { color: '#fff' },

    footer         : { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: C.bgCard, borderTopWidth: 1, borderTopColor: C.border, paddingHorizontal: 20, paddingVertical: 14, paddingBottom: 28 },
    footerLeft     : { flex: 1, gap: 2 },
    followCount    : { fontSize: FONT_SIZE.md, color: C.text },
    footerHint     : { fontSize: FONT_SIZE.xs, color: C.accent },
    nextBtn        : { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.primary, borderRadius: 24, paddingHorizontal: 22, paddingVertical: 12 },
    nextBtnDisabled: { backgroundColor: C.textMuted },
    nextBtnText    : { color: '#fff', fontWeight: 'bold', fontSize: FONT_SIZE.md },
  });
}
