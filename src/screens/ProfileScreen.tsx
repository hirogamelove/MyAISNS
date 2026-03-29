import React, { useState, useMemo } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, Modal, FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { FONT_SIZE, COST } from '../constants';
import { useAppStore } from '../store/useAppStore';
import { useTheme, ACCENT_COLORS, ThemeMode, AccentId, ThemeColors } from '../theme';
import { SUPABASE_CONFIGURED } from '../lib/supabase';
import PostItem from '../components/PostItem';
import { generateAvatarUrl } from '../services/avatarService';
import { SAMPLE_AI_USERS } from '../services/sampleAIService';
import { AIUserData, PostData } from '../types';
import { resolveIconUri, diceBearUrl } from '../services/iconService';

interface Props {
  userId?:          string;
  onPressComment?:  (post: any) => void;
  onPressProfile?:  (userId: string) => void;
  onLogout?:        () => void;
  onPressTune?:     () => void;
}

type ProfileTab = 'posts' | 'likes';

// ─── 7日間の投稿アクティビティ ─────────────────────────────
function ActivityGraph({ posts, authorId, C }: { posts: PostData[]; authorId: string; C: ThemeColors }) {
  const graphStyles = useMemo(() => createGraphStyles(C), [C]);
  const bars = useMemo(() => {
    const days: { label: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const label   = i === 0 ? '今日' : `${d.getMonth() + 1}/${d.getDate()}`;
      const count   = posts.filter(
        p => p.authorId === authorId && p.createdAt.startsWith(dateStr),
      ).length;
      days.push({ label, count });
    }
    return days;
  }, [posts, authorId]);

  const maxCount = Math.max(...bars.map(b => b.count), 1);

  return (
    <View style={graphStyles.container}>
      <View style={graphStyles.header}>
        <Ionicons name="bar-chart" size={14} color={C.primary} />
        <Text style={graphStyles.title}>7日間の投稿アクティビティ</Text>
      </View>
      <View style={graphStyles.bars}>
        {bars.map(({ label, count }) => (
          <View key={label} style={graphStyles.barCol}>
            <Text style={graphStyles.countLabel}>{count > 0 ? count : ''}</Text>
            <View style={graphStyles.barBg}>
              <View
                style={[
                  graphStyles.barFill,
                  { height: `${(count / maxCount) * 100}%` as any },
                ]}
              />
            </View>
            <Text style={graphStyles.dayLabel}>{label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function createGraphStyles(C: ThemeColors) {
  return StyleSheet.create({
    container  : { marginHorizontal: 16, marginBottom: 4, backgroundColor: C.bgCard, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: C.border },
    header     : { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
    title      : { fontSize: FONT_SIZE.sm, fontWeight: '700', color: C.textSub },
    bars       : { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 70 },
    barCol     : { flex: 1, alignItems: 'center', gap: 3 },
    countLabel : { fontSize: 9, color: C.textMuted, height: 12 },
    barBg      : { flex: 1, width: '100%', backgroundColor: C.bgInput, borderRadius: 4, overflow: 'hidden', justifyContent: 'flex-end' },
    barFill    : { backgroundColor: C.primary, borderRadius: 4, minHeight: 3 },
    dayLabel   : { fontSize: 9, color: C.textMuted },
  });
}

// ─── パーソナリティバー ───────────────────────────────────
function PersonalityBar({ label, value, color, C }: { label: string; value: number; color: string; C: ThemeColors }) {
  return (
    <View style={{ marginBottom: 8 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
        <Text style={{ color: C.textSub, fontSize: FONT_SIZE.xs }}>{label}</Text>
        <Text style={{ color, fontSize: FONT_SIZE.xs, fontWeight: 'bold' }}>{Math.round(value * 100)}%</Text>
      </View>
      <View style={{ height: 6, backgroundColor: C.bgInput, borderRadius: 3, overflow: 'hidden' }}>
        <View style={{ height: '100%', width: `${value * 100}%` as any, backgroundColor: color, borderRadius: 3 }} />
      </View>
    </View>
  );
}

// ─── フォロワー / フォロー中リストモーダル ────────────────
function UserListModal({
  visible, title, userIds, onClose, onPressUser,
}: {
  visible: boolean;
  title: string;
  userIds: string[];
  onClose: () => void;
  onPressUser: (id: string) => void;
}) {
  const C = useTheme();
  const modalStyles = useMemo(() => createModalStyles(C), [C]);
  const resolvedUsers = useMemo(() =>
    userIds.map(id => SAMPLE_AI_USERS.find(u => u.userId === id)).filter(Boolean) as AIUserData[],
  [userIds]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={modalStyles.overlay}>
        <View style={modalStyles.sheet}>
          <View style={modalStyles.handle} />
          <View style={modalStyles.titleRow}>
            <Text style={modalStyles.title}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color={C.textSub} />
            </TouchableOpacity>
          </View>

          {resolvedUsers.length === 0 ? (
            <View style={modalStyles.empty}>
              <Text style={modalStyles.emptyText}>まだいません</Text>
            </View>
          ) : (
            <FlatList
              data={resolvedUsers}
              keyExtractor={u => u.userId}
              renderItem={({ item }) => {
                const uri = resolveIconUri(item.iconBase64) ?? diceBearUrl(item.username);
                return (
                  <TouchableOpacity
                    style={modalStyles.userRow}
                    onPress={() => { onClose(); onPressUser(item.userId); }}
                  >
                    <Image source={{ uri }} style={modalStyles.avatar} />
                    <View style={modalStyles.userInfo}>
                      <Text style={modalStyles.userName}>{item.displayName}</Text>
                      <Text style={modalStyles.userHandle}>@{item.username}</Text>
                      {item.bio && <Text style={modalStyles.userBio} numberOfLines={1}>{item.bio}</Text>}
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={C.textMuted} />
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

function createModalStyles(C: ThemeColors) {
  return StyleSheet.create({
    overlay   : { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    sheet     : { backgroundColor: C.bgCard, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '75%', paddingBottom: 30 },
    handle    : { width: 40, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: 'center', marginTop: 10, marginBottom: 4 },
    titleRow  : { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
    title     : { fontSize: FONT_SIZE.lg, fontWeight: 'bold', color: C.text },
    empty     : { padding: 40, alignItems: 'center' },
    emptyText : { color: C.textMuted, fontSize: FONT_SIZE.sm },
    userRow   : { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12, borderBottomWidth: 1, borderBottomColor: C.border },
    avatar    : { width: 46, height: 46, borderRadius: 23, backgroundColor: C.bgInput },
    userInfo  : { flex: 1 },
    userName  : { fontSize: FONT_SIZE.md, fontWeight: '700', color: C.text },
    userHandle: { fontSize: FONT_SIZE.sm, color: C.textSub, marginTop: 1 },
    userBio   : { fontSize: FONT_SIZE.xs, color: C.textMuted, marginTop: 2 },
  });
}

// ─── メインコンポーネント ────────────────────────────────
export default function ProfileScreen({ userId, onPressComment, onPressProfile, onLogout, onPressTune }: Props) {
  const { humanUser, aiUser, posts, spendCoins, setHumanUser, setAIUser, followUser, unfollowUser, deleteAccount, supabaseSignOut, themeMode, accentColor, setThemeMode, setAccentColor } = useAppStore();
  const TC = useTheme();
  const styles = useMemo(() => createStyles(TC), [TC]);
  const [regenLoading, setRegenLoading]   = useState(false);
  const [activeTab, setActiveTab]         = useState<ProfileTab>('posts');
  const [listModal, setListModal]         = useState<{ title: string; ids: string[] } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [confirmModal, setConfirmModal]   = useState<'logout' | 'delete' | null>(null);

  // 表示対象ユーザーを解決
  const targetUser = useMemo((): AIUserData | null => {
    if (!userId || userId === humanUser?.userId || userId === aiUser?.userId) return null;
    return SAMPLE_AI_USERS.find(u => u.userId === userId) ?? null;
  }, [userId, humanUser?.userId, aiUser?.userId]);

  const isOwnProfile = targetUser === null;
  const isFollowing  = humanUser?.followingIds.includes(targetUser?.userId ?? '') ?? false;

  // 投稿タブ: 自分 or 相手の投稿
  const ownPosts = useMemo(() =>
    posts.filter(p => isOwnProfile ? p.authorId === aiUser?.userId : p.authorId === targetUser?.userId),
  [posts, isOwnProfile, aiUser?.userId, targetUser?.userId]);

  // いいねタブ: 自分がいいねした投稿（自プロフィールのみ）
  const likedPosts = useMemo(() =>
    isOwnProfile
      ? posts.filter(p => humanUser?.likedPostIds.includes(p.postId))
      : [],
  [posts, isOwnProfile, humanUser?.likedPostIds]);

  const displayedPosts = activeTab === 'likes' ? likedPosts : ownPosts;

  // ─── フォロー / アンフォロー ────────────────────────
  function handleFollow() {
    if (!targetUser) return;
    if (!isFollowing) {
      const ok = followUser(targetUser.userId);
      if (!ok) Alert.alert('上限', '今日のフォロー上限に達しました');
    } else {
      unfollowUser(targetUser.userId);
    }
  }

  // ─── フォロワー/フォロー中リスト表示 ─────────────────
  function openFollowingList() {
    if (isOwnProfile) {
      setListModal({ title: 'フォロー中', ids: humanUser?.followingIds ?? [] });
    } else {
      // サンプルAIのフォロー中: 他のサンプルからランダムに数人
      const others = SAMPLE_AI_USERS
        .filter(u => u.userId !== targetUser?.userId)
        .slice(0, Math.min(3, (targetUser?.followingCount ?? 0)));
      setListModal({ title: 'フォロー中', ids: others.map(u => u.userId) });
    }
  }

  function openFollowersList() {
    const allSample = SAMPLE_AI_USERS.filter(u => u.userId !== targetUser?.userId && u.userId !== aiUser?.userId);
    const sampleFollowers = allSample.slice(0, Math.min(5, isOwnProfile ? humanUser?.followersCount ?? 0 : targetUser?.followersCount ?? 0));
    setListModal({ title: 'フォロワー', ids: sampleFollowers.map(u => u.userId) });
  }

  function handleListUserPress(uid: string) {
    if (onPressProfile) onPressProfile(uid);
  }

  // ─── ログアウト実行 ────────────────────────────────────
  async function execLogout() {
    setConfirmModal(null);
    await supabaseSignOut();
    if (onLogout) onLogout();
  }

  // ─── アカウント削除実行 ────────────────────────────────
  async function execDelete() {
    setConfirmModal(null);
    setDeleteLoading(true);
    await deleteAccount();
    setDeleteLoading(false);
    if (onLogout) onLogout();
  }

  // ─── アイコン再生成 ─────────────────────────────────
  async function handleRegenIcon() {
    if (!aiUser || !humanUser) return;
    const free = humanUser.freeIconRegenRemaining;
    if (free <= 0 && !spendCoins(COST.ICON_REGEN)) {
      Alert.alert('コイン不足', `アイコン再生成には🪙${COST.ICON_REGEN}コイン必要です`);
      return;
    }
    setRegenLoading(true);
    if (free > 0) setHumanUser({ ...humanUser, freeIconRegenRemaining: free - 1 });

    try {
      let newIconUrl = await generateAvatarUrl(aiUser.personality, aiUser.displayName);
      if (!newIconUrl) newIconUrl = diceBearUrl(`${aiUser.username}_${Date.now()}`);
      setAIUser({ ...aiUser, iconBase64: newIconUrl });
      setHumanUser({ ...humanUser, iconBase64: newIconUrl, freeIconRegenRemaining: free > 0 ? free - 1 : free });
      Alert.alert('完了', 'アイコンを更新しました！');
    } catch {
      const fallback = diceBearUrl(`${aiUser.username}_${Date.now()}`);
      setAIUser({ ...aiUser, iconBase64: fallback });
      setHumanUser({ ...humanUser, iconBase64: fallback });
      Alert.alert('完了', 'アイコンを更新しました！');
    } finally {
      setRegenLoading(false);
    }
  }

  // ─── 表示用データ ─────────────────────────────────────
  const freeRegen   = humanUser?.freeIconRegenRemaining ?? 0;
  const iconBase64  = isOwnProfile
    ? (aiUser?.iconBase64 || humanUser?.iconBase64 || '')
    : (targetUser?.iconBase64 ?? '');
  const dispName    = isOwnProfile ? humanUser?.displayName : targetUser?.displayName;
  const dispHandle  = isOwnProfile ? humanUser?.username    : targetUser?.username;
  const bio         = isOwnProfile ? aiUser?.bio            : targetUser?.bio;
  const followers   = isOwnProfile ? (humanUser?.followersCount ?? 0)  : (targetUser?.followersCount ?? 0);
  const following   = isOwnProfile ? (humanUser?.followingCount ?? 0)  : (targetUser?.followingCount ?? 0);
  const personality = isOwnProfile ? aiUser?.personality : targetUser?.personality;
  const authorId    = isOwnProfile ? (aiUser?.userId ?? '') : (targetUser?.userId ?? '');

  // ヘッダーグラデーション: Big5の外向性・開放性で色を変える
  const gradColors = useMemo((): [string, string] => {
    if (!personality) return [TC.primary, TC.isDark ? '#1a0a3a' : '#e8e4f5'];
    const e = personality.extraversion;
    const o = personality.openness;
    if (e > 0.6 && o > 0.6) return ['#fc5c7d', '#6a3093'];
    if (e > 0.6)             return [TC.primary, TC.accentGreen];
    if (o > 0.6)             return [TC.accentBlue, TC.isDark ? '#1a0a3a' : '#e0f5f3'];
    return [TC.primary, TC.isDark ? '#1a0a3a' : '#e8e4f5'];
  }, [personality, TC]);

  const iconUri = resolveIconUri(iconBase64) ?? (aiUser ? diceBearUrl(aiUser.username) : null);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }}>

      {/* ─── ヘッダーバナー ────────────────────────────── */}
      <LinearGradient colors={gradColors} style={styles.banner}>
        <View style={styles.bannerOverlay} />
        {isOwnProfile && (
          <View style={styles.coinBadge}>
            <Text style={styles.coinBadgeText}>🪙 {humanUser?.coins ?? 0}</Text>
          </View>
        )}
      </LinearGradient>

      {/* ─── プロフィールエリア ──────────────────────────── */}
      <View style={styles.profileArea}>
        {/* アバター */}
        <View style={styles.avatarWrap}>
          {iconUri
            ? <Image source={{ uri: iconUri }} style={styles.avatar} />
            : <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitial}>{(dispName ?? '?').slice(0, 2)}</Text>
              </View>
          }
          {isOwnProfile && (
            <TouchableOpacity style={styles.editBadge} onPress={handleRegenIcon} disabled={regenLoading}>
              {regenLoading
                ? <ActivityIndicator size="small" color="#fff" />
                : <Ionicons name="camera" size={14} color="#fff" />
              }
            </TouchableOpacity>
          )}
        </View>

        {/* 名前・ハンドル・バッジ */}
        <Text style={styles.displayName}>{dispName ?? '---'}</Text>
        <Text style={styles.handle}>@{dispHandle ?? '---'}</Text>

        <View style={styles.badgeRow}>
          {!isOwnProfile && (
            <View style={styles.aiBadge}>
              <Ionicons name="hardware-chip" size={11} color="#fff" />
              <Text style={styles.aiBadgeText}>AI</Text>
            </View>
          )}
          {personality && (
            <View style={styles.hobbyChip}>
              <Text style={styles.hobbyChipText}>
                {personality.hobbies.slice(0, 2).join(' · ')}
              </Text>
            </View>
          )}
        </View>

        {/* バイオ */}
        {bio && <Text style={styles.bio}>{bio}</Text>}

        {/* スタッツ行（タップでリスト表示） */}
        <View style={styles.stats}>
          <TouchableOpacity style={styles.stat} onPress={openFollowingList}>
            <Text style={styles.statNum}>{following}</Text>
            <Text style={styles.statLabel}>フォロー</Text>
          </TouchableOpacity>
          <View style={styles.statDivider} />
          <TouchableOpacity style={styles.stat} onPress={openFollowersList}>
            <Text style={styles.statNum}>{followers}</Text>
            <Text style={styles.statLabel}>フォロワー</Text>
          </TouchableOpacity>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statNum}>{ownPosts.length}</Text>
            <Text style={styles.statLabel}>投稿</Text>
          </View>
        </View>

        {/* アクションボタン */}
        {!isOwnProfile ? (
          <TouchableOpacity
            style={[styles.actionBtn, isFollowing && styles.actionBtnActive]}
            onPress={handleFollow}
          >
            <Ionicons
              name={isFollowing ? 'checkmark' : 'person-add'}
              size={16}
              color={isFollowing ? '#fff' : TC.primary}
            />
            <Text style={[styles.actionBtnText, isFollowing && styles.actionBtnTextActive]}>
              {isFollowing ? 'フォロー中' : 'フォローする'}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.regenBtn} onPress={handleRegenIcon} disabled={regenLoading}>
            {regenLoading
              ? <ActivityIndicator color="#fff" size="small" />
              : <>
                  <Ionicons name="refresh" size={15} color="#fff" />
                  <Text style={styles.regenBtnText}>
                    {freeRegen > 0
                      ? `アイコン再生成（無料 残${freeRegen}回）`
                      : `アイコン再生成（🪙${COST.ICON_REGEN}）`}
                  </Text>
                </>
            }
          </TouchableOpacity>
        )}
      </View>

      {/* ─── 7日間投稿アクティビティ ─────────────────────── */}
      {authorId && <ActivityGraph posts={posts} authorId={authorId} C={TC} />}

      {/* ─── 性格パネル ──────────────────────────────────── */}
      {personality && (
        <View style={styles.personalityCard}>
          <Text style={styles.cardTitle}>🧠 {isOwnProfile ? 'AIの性格' : `${dispName}の性格`}</Text>
          <PersonalityBar label="開放性"   value={personality.openness}          color={TC.primaryLight} C={TC} />
          <PersonalityBar label="外向性"   value={personality.extraversion}      color={TC.accentBlue} C={TC} />
          <PersonalityBar label="協調性"   value={personality.agreeableness}     color={TC.accentGreen} C={TC} />
          <PersonalityBar label="誠実性"   value={personality.conscientiousness} color={TC.gold} C={TC} />
          <PersonalityBar label="感情安定" value={1 - personality.neuroticism}   color={TC.accent} C={TC} />

          {/* 趣味チップ */}
          {personality.hobbies.length > 0 && (
            <View style={styles.hobbiesRow}>
              {personality.hobbies.map(h => (
                <View key={h} style={styles.hobbiesBadge}>
                  <Text style={styles.hobbiesBadgeText}>{h}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* ─── タブ: 投稿 / いいね ──────────────────────────── */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'posts' && styles.tabItemActive]}
          onPress={() => setActiveTab('posts')}
        >
          <Ionicons name="document-text-outline" size={16} color={activeTab === 'posts' ? TC.primary : TC.textMuted} />
          <Text style={[styles.tabText, activeTab === 'posts' && styles.tabTextActive]}>
            投稿 {ownPosts.length > 0 && `(${ownPosts.length})`}
          </Text>
          {activeTab === 'posts' && <View style={styles.tabUnderline} />}
        </TouchableOpacity>

        {isOwnProfile && (
          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'likes' && styles.tabItemActive]}
            onPress={() => setActiveTab('likes')}
          >
            <Ionicons name="heart-outline" size={16} color={activeTab === 'likes' ? TC.accent : TC.textMuted} />
            <Text style={[styles.tabText, activeTab === 'likes' && styles.tabTextActive, activeTab === 'likes' && { color: TC.accent }]}>
              いいね {likedPosts.length > 0 && `(${likedPosts.length})`}
            </Text>
            {activeTab === 'likes' && <View style={[styles.tabUnderline, { backgroundColor: TC.accent }]} />}
          </TouchableOpacity>
        )}
      </View>

      {/* ─── 投稿リスト ──────────────────────────────────── */}
      {displayedPosts.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>{activeTab === 'likes' ? '🤍' : '📝'}</Text>
          <Text style={styles.emptyText}>
            {activeTab === 'likes' ? 'まだいいねした投稿がありません' : 'まだ投稿がありません'}
          </Text>
        </View>
      ) : (
        displayedPosts.map(post => (
          <PostItem key={post.postId} post={post} onPressComment={onPressComment} />
        ))
      )}

      {/* ─── アカウント設定（自分のプロフィールのみ）────── */}
      {isOwnProfile && (
        <View style={styles.settingsSection}>
          <Text style={styles.settingsSectionTitle}>アカウント設定</Text>

          {/* ─── テーマ設定 ────────────────────────────── */}
          <Text style={[styles.settingsSectionTitle, { marginTop: 8 }]}>テーマ設定</Text>

          {/* ライト / ダーク 切替 */}
          <View style={styles.settingsRow}>
            <Ionicons name={themeMode === 'dark' ? 'moon' : 'sunny'} size={20} color={TC.primary} />
            <Text style={styles.settingsRowText}>{themeMode === 'dark' ? 'ダークモード' : 'ライトモード'}</Text>
            <TouchableOpacity
              style={[styles.modeToggle, { backgroundColor: TC.primary }]}
              onPress={() => setThemeMode(themeMode === 'dark' ? 'light' : 'dark')}
            >
              <Text style={styles.modeToggleText}>{themeMode === 'dark' ? '☀️ ライト' : '🌙 ダーク'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.settingsDivider} />

          {/* アクセントカラー */}
          <View style={[styles.settingsRow, { alignItems: 'flex-start', paddingVertical: 12 }]}>
            <Ionicons name="color-palette-outline" size={20} color={TC.primary} style={{ marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.settingsRowText, { marginBottom: 10 }]}>アクセントカラー</Text>
              <View style={styles.accentGrid}>
                {ACCENT_COLORS.map(a => (
                  <TouchableOpacity
                    key={a.id}
                    style={[styles.accentDot, { backgroundColor: a.color },
                      accentColor === a.id && styles.accentDotActive]}
                    onPress={() => setAccentColor(a.id as AccentId)}
                  >
                    {accentColor === a.id && <Ionicons name="checkmark" size={14} color="#fff" />}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          <View style={styles.settingsDivider} />

          {/* AIチューニング */}
          <TouchableOpacity style={styles.settingsRow} onPress={onPressTune}>
            <Ionicons name="color-wand-outline" size={20} color={TC.primary} />
            <Text style={[styles.settingsRowText, { color: TC.primary }]}>AIをチューニング</Text>
            <Ionicons name="chevron-forward" size={16} color={TC.primary} />
          </TouchableOpacity>

          <View style={styles.settingsDivider} />

          {/* ログアウト */}
          <TouchableOpacity style={styles.settingsRow} onPress={() => setConfirmModal('logout')}>
            <Ionicons name="log-out-outline" size={20} color={TC.textSub} />
            <Text style={styles.settingsRowText}>ログアウト</Text>
            <Ionicons name="chevron-forward" size={16} color={TC.textMuted} />
          </TouchableOpacity>

          <View style={styles.settingsDivider} />

          {/* アカウント削除 */}
          <TouchableOpacity
            style={[styles.settingsRow, deleteLoading && { opacity: 0.5 }]}
            onPress={() => setConfirmModal('delete')}
            disabled={deleteLoading}
          >
            {deleteLoading
              ? <ActivityIndicator size="small" color={TC.accent} />
              : <Ionicons name="trash-outline" size={20} color={TC.accent} />
            }
            <Text style={[styles.settingsRowText, { color: TC.accent }]}>
              {deleteLoading ? '削除中...' : 'アカウントを削除する'}
            </Text>
            {!deleteLoading && <Ionicons name="chevron-forward" size={16} color={TC.accent} />}
          </TouchableOpacity>

          {SUPABASE_CONFIGURED && (
            <Text style={styles.settingsNote}>
              ※ メールアドレス・すべてのデータが完全に削除されます
            </Text>
          )}
        </View>
      )}

      {/* ─── ログアウト / 削除 確認モーダル ─────────────── */}
      <Modal
        visible={confirmModal !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmModal(null)}
      >
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmBox}>
            {confirmModal === 'logout' ? (
              <>
                <Ionicons name="log-out-outline" size={36} color={TC.textSub} />
                <Text style={styles.confirmTitle}>ログアウト</Text>
                <Text style={styles.confirmMsg}>ログアウトしますか？</Text>
                <TouchableOpacity style={styles.confirmBtnDanger} onPress={execLogout}>
                  <Text style={styles.confirmBtnDangerText}>ログアウト</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Ionicons name="trash-outline" size={36} color={TC.accent} />
                <Text style={styles.confirmTitle}>アカウントを削除</Text>
                <Text style={styles.confirmMsg}>
                  すべての投稿・プロフィール・コインが完全に削除されます。{'\n'}この操作は取り消せません。
                </Text>
                <TouchableOpacity style={styles.confirmBtnDanger} onPress={execDelete}>
                  <Text style={styles.confirmBtnDangerText}>完全に削除する</Text>
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity style={styles.confirmBtnCancel} onPress={() => setConfirmModal(null)}>
              <Text style={styles.confirmBtnCancelText}>キャンセル</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ─── フォロー/フォロワーリストモーダル ──────────── */}
      <UserListModal
        visible={listModal !== null}
        title={listModal?.title ?? ''}
        userIds={listModal?.ids ?? []}
        onClose={() => setListModal(null)}
        onPressUser={handleListUserPress}
      />
    </ScrollView>
  );
}

function createStyles(C: ThemeColors) {
  return StyleSheet.create({
    container        : { flex: 1, backgroundColor: C.bg },
    banner           : { height: 130, position: 'relative' },
    bannerOverlay    : { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.25)' },
    coinBadge        : { position: 'absolute', top: 14, right: 14, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 5 },
    coinBadgeText    : { color: C.gold, fontWeight: 'bold', fontSize: FONT_SIZE.sm },
    profileArea      : { alignItems: 'center', paddingHorizontal: 20, marginTop: -44, paddingBottom: 16 },
    avatarWrap       : { position: 'relative', borderWidth: 3, borderColor: C.bg, borderRadius: 50, marginBottom: 10 },
    avatar           : { width: 88, height: 88, borderRadius: 44 },
    avatarPlaceholder: { width: 88, height: 88, borderRadius: 44, backgroundColor: C.primary, justifyContent: 'center', alignItems: 'center' },
    avatarInitial    : { fontSize: 28, fontWeight: 'bold', color: '#fff' },
    editBadge        : { position: 'absolute', bottom: 0, right: 0, width: 26, height: 26, borderRadius: 13, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.bg },
    displayName      : { fontSize: FONT_SIZE.xl, fontWeight: 'bold', color: C.text },
    handle           : { fontSize: FONT_SIZE.sm, color: C.textSub, marginTop: 2 },
    badgeRow         : { flexDirection: 'row', gap: 8, marginTop: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' },
    aiBadge          : { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.primary, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
    aiBadgeText      : { color: '#fff', fontSize: FONT_SIZE.xs, fontWeight: 'bold' },
    hobbyChip        : { backgroundColor: C.bgInput, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: C.border },
    hobbyChipText    : { color: C.textSub, fontSize: FONT_SIZE.xs },
    bio              : { fontSize: FONT_SIZE.sm, color: C.textSub, textAlign: 'center', marginTop: 8, paddingHorizontal: 20, lineHeight: 20 },
    stats            : { flexDirection: 'row', alignItems: 'center', marginTop: 16, backgroundColor: C.bgCard, borderRadius: 14, paddingHorizontal: 8, paddingVertical: 10, borderWidth: 1, borderColor: C.border },
    stat             : { flex: 1, alignItems: 'center', paddingVertical: 2 },
    statDivider      : { width: 1, height: 32, backgroundColor: C.border },
    statNum          : { fontSize: FONT_SIZE.lg, fontWeight: 'bold', color: C.text },
    statLabel        : { fontSize: FONT_SIZE.xs, color: C.textSub, marginTop: 1 },
    actionBtn        : { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderColor: C.primary, borderRadius: 22, paddingHorizontal: 28, paddingVertical: 10, marginTop: 14 },
    actionBtnActive  : { backgroundColor: C.primary },
    actionBtnText    : { color: C.primary, fontWeight: 'bold', fontSize: FONT_SIZE.sm },
    actionBtnTextActive: { color: '#fff' },
    regenBtn         : { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.primary, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 10, marginTop: 14 },
    regenBtnText     : { color: '#fff', fontSize: FONT_SIZE.sm, fontWeight: '600' },
    personalityCard  : { margin: 16, backgroundColor: C.bgCard, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.border },
    cardTitle        : { fontSize: FONT_SIZE.md, fontWeight: 'bold', color: C.text, marginBottom: 14 },
    hobbiesRow       : { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
    hobbiesBadge     : { backgroundColor: C.bgInput, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: C.border },
    hobbiesBadgeText : { color: C.textSub, fontSize: FONT_SIZE.xs },
    tabBar           : { flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.border, backgroundColor: C.bgCard, marginTop: 8 },
    tabItem          : { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 12, position: 'relative' },
    tabItemActive    : {},
    tabText          : { fontSize: FONT_SIZE.sm, color: C.textMuted, fontWeight: '600' },
    tabTextActive    : { color: C.primary },
    tabUnderline     : { position: 'absolute', bottom: 0, left: '15%' as any, right: '15%' as any, height: 3, backgroundColor: C.primary, borderRadius: 2 },
    empty            : { alignItems: 'center', paddingTop: 60, gap: 8 },
    emptyIcon        : { fontSize: 40 },
    emptyText        : { color: C.textMuted, fontSize: FONT_SIZE.sm },
    settingsSection      : { margin: 16, marginTop: 20, backgroundColor: C.bgCard, borderRadius: 16, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
    settingsSectionTitle : { fontSize: FONT_SIZE.sm, fontWeight: '700', color: C.textMuted, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4, letterSpacing: 0.5 },
    settingsRow          : { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
    settingsRowText      : { flex: 1, fontSize: FONT_SIZE.md, color: C.textSub, fontWeight: '500' },
    settingsDivider      : { height: 1, backgroundColor: C.border, marginHorizontal: 16 },
    settingsNote         : { fontSize: FONT_SIZE.xs, color: C.textMuted, paddingHorizontal: 16, paddingBottom: 12, marginTop: 4 },
    modeToggle           : { borderRadius: 16, paddingHorizontal: 14, paddingVertical: 6 },
    modeToggleText       : { color: '#fff', fontSize: FONT_SIZE.xs, fontWeight: 'bold' },
    accentGrid           : { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
    accentDot            : { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    accentDotActive      : { borderWidth: 3, borderColor: '#fff', transform: [{ scale: 1.15 }] },
    confirmOverlay    : { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 32 },
    confirmBox        : { width: '100%', backgroundColor: C.bgCard, borderRadius: 20, padding: 28, alignItems: 'center', gap: 12, borderWidth: 1, borderColor: C.border },
    confirmTitle      : { fontSize: FONT_SIZE.xl, fontWeight: 'bold', color: C.text, textAlign: 'center' },
    confirmMsg        : { fontSize: FONT_SIZE.sm, color: C.textSub, textAlign: 'center', lineHeight: 22 },
    confirmBtnDanger  : { width: '100%', backgroundColor: C.accent, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
    confirmBtnDangerText: { color: '#fff', fontWeight: 'bold', fontSize: FONT_SIZE.md },
    confirmBtnCancel  : { width: '100%', backgroundColor: C.bgInput, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
    confirmBtnCancelText: { color: C.textSub, fontWeight: '600', fontSize: FONT_SIZE.md },
  });
}
