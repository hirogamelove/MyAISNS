import React, { useState, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, Image,
  StyleSheet, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { FONT_SIZE } from '../constants';
import { useAppStore } from '../store/useAppStore';
import { SAMPLE_AI_USERS } from '../services/sampleAIService';
import { resolveIconUri, diceBearUrl } from '../services/iconService';
import { calcTrending } from '../components/TrendingBar';
import { PostData, AIUserData } from '../types';
import { useTheme, ThemeColors } from '../theme';

interface Props {
  onBack          : () => void;
  onPressProfile  : (userId?: string) => void;
  onSelectTag     : (tag: string) => void;
  initialQuery?   : string;
}

type Styles = ReturnType<typeof createStyles>;

function UserRow({
  user, isFollowing, onFollow, onPress, styles, C,
}: {
  user: AIUserData;
  isFollowing: boolean;
  onFollow: (userId: string) => void;
  onPress: (userId: string) => void;
  styles: Styles;
  C: ThemeColors;
}) {
  const uri = resolveIconUri(user.iconBase64) ?? diceBearUrl(user.username);
  return (
    <TouchableOpacity style={styles.userRow} onPress={() => onPress(user.userId)}>
      <Image source={{ uri }} style={styles.userAvatar} />
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{user.displayName}</Text>
        <Text style={styles.userHandle}>@{user.username}</Text>
        <Text style={styles.userHobbies} numberOfLines={1}>
          {user.personality.hobbies.slice(0, 3).join(' · ')}
        </Text>
      </View>
      <TouchableOpacity
        style={[styles.followBtn, isFollowing && styles.followBtnActive]}
        onPress={() => onFollow(user.userId)}
      >
        <Text style={[styles.followBtnText, isFollowing && styles.followBtnTextActive]}>
          {isFollowing ? 'フォロー中' : 'フォロー'}
        </Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

function PostRow({ post, onPressAuthor, styles, C }: {
  post: PostData;
  onPressAuthor: (id: string) => void;
  styles: Styles;
  C: ThemeColors;
}) {
  const uri = resolveIconUri(post.authorIconBase64) ?? diceBearUrl(post.authorHandle);
  const preview = post.content.slice(0, 80) + (post.content.length > 80 ? '…' : '');
  return (
    <TouchableOpacity style={styles.postRow} onPress={() => onPressAuthor(post.authorId)}>
      <Image source={{ uri }} style={styles.postAvatar} />
      <View style={styles.postBody}>
        <View style={styles.postHeader}>
          <Text style={styles.postAuthor}>{post.authorName}</Text>
          <Text style={styles.postHandle}>@{post.authorHandle}</Text>
        </View>
        <Text style={styles.postContent}>{preview}</Text>
        <View style={styles.postStats}>
          <Ionicons name="heart" size={12} color={C.like} />
          <Text style={styles.statNum}>{post.likeCount}</Text>
          <Ionicons name="repeat" size={12} color={C.repost} style={{ marginLeft: 8 }} />
          <Text style={styles.statNum}>{post.repostCount}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function TagRow({ tag, count, onPress, styles, C }: {
  tag: string; count: number; onPress: (t: string) => void;
  styles: Styles; C: ThemeColors;
}) {
  return (
    <TouchableOpacity style={styles.tagRow} onPress={() => onPress(tag)}>
      <View style={styles.tagIconWrap}>
        <Ionicons name="trending-up" size={18} color={C.primary} />
      </View>
      <View style={styles.tagInfo}>
        <Text style={styles.tagName}>{tag}</Text>
        <Text style={styles.tagCount}>{count}件の投稿</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={C.textMuted} />
    </TouchableOpacity>
  );
}

function SectionHeader({ title, icon, styles, C }: {
  title: string; icon: string;
  styles: Styles; C: ThemeColors;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Ionicons name={icon as any} size={15} color={C.primary} />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

export default function SearchScreen({ onBack, onPressProfile, onSelectTag, initialQuery }: Props) {
  const C = useTheme();
  const styles = useMemo(() => createStyles(C), [C]);

  const { posts, humanUser, followUser, unfollowUser } = useAppStore();
  const [query, setQuery] = useState(initialQuery ?? '');
  const inputRef = useRef<TextInput>(null);

  const allUsers: AIUserData[] = useMemo(() => {
    const { aiUser } = useAppStore.getState();
    return aiUser ? [...SAMPLE_AI_USERS, aiUser] : [...SAMPLE_AI_USERS];
  }, []);

  const followingSet = useMemo(
    () => new Set(humanUser?.followingIds ?? []),
    [humanUser?.followingIds],
  );

  const trending = useMemo(() => calcTrending(posts, 15), [posts]);

  const q = query.trim().toLowerCase();

  const matchedUsers = useMemo<AIUserData[]>(() => {
    if (!q) return [...allUsers].sort((a, b) => b.followersCount - a.followersCount).slice(0, 8);
    return allUsers.filter(u =>
      u.displayName.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q) ||
      u.personality.hobbies.some(h => h.toLowerCase().includes(q)),
    );
  }, [q, allUsers]);

  const matchedPosts = useMemo<PostData[]>(() => {
    if (!q) return [];
    return posts
      .filter(p => p.content.toLowerCase().includes(q))
      .sort((a, b) => b.buzzScore - a.buzzScore)
      .slice(0, 20);
  }, [q, posts]);

  const matchedTags = useMemo(() => {
    if (!q) return trending;
    const filter = q.startsWith('#') ? q : '#' + q;
    return trending.filter(t => t.tag.includes(filter.toLowerCase()) || t.tag.includes(q));
  }, [q, trending]);

  const handleFollow = useCallback((userId: string) => {
    if (followingSet.has(userId)) {
      unfollowUser(userId);
    } else {
      followUser(userId);
    }
  }, [followingSet, followUser, unfollowUser]);

  const handleTagPress = useCallback((tag: string) => {
    onSelectTag(tag);
    onBack();
  }, [onSelectTag, onBack]);

  const isEmpty = q === '';

  return (
    <View style={styles.container}>
      <LinearGradient colors={[C.bgCard, C.bg]} style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={C.text} />
        </TouchableOpacity>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={16} color={C.textMuted} style={styles.searchIcon} />
          <TextInput
            ref={inputRef}
            style={styles.searchInput}
            placeholder="ユーザー、投稿、#タグを検索..."
            placeholderTextColor={C.textMuted}
            value={query}
            onChangeText={setQuery}
            autoFocus
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} style={styles.clearBtn}>
              <Ionicons name="close-circle" size={18} color={C.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">

        {isEmpty && (
          <>
            {trending.length > 0 && (
              <View style={styles.section}>
                <SectionHeader title="トレンド" icon="trending-up" styles={styles} C={C} />
                {trending.slice(0, 10).map(t => (
                  <TagRow key={t.tag} tag={t.tag} count={t.count} onPress={handleTagPress} styles={styles} C={C} />
                ))}
              </View>
            )}

            <View style={styles.section}>
              <SectionHeader title="おすすめユーザー" icon="people" styles={styles} C={C} />
              {matchedUsers.map(u => (
                <UserRow
                  key={u.userId}
                  user={u}
                  isFollowing={followingSet.has(u.userId)}
                  onFollow={handleFollow}
                  onPress={onPressProfile}
                  styles={styles}
                  C={C}
                />
              ))}
            </View>
          </>
        )}

        {!isEmpty && (
          <>
            <View style={styles.section}>
              <SectionHeader title={`ユーザー（${matchedUsers.length}件）`} icon="person" styles={styles} C={C} />
              {matchedUsers.length === 0 ? (
                <Text style={styles.emptySection}>一致するユーザーが見つかりません</Text>
              ) : (
                matchedUsers.map(u => (
                  <UserRow
                    key={u.userId}
                    user={u}
                    isFollowing={followingSet.has(u.userId)}
                    onFollow={handleFollow}
                    onPress={onPressProfile}
                    styles={styles}
                    C={C}
                  />
                ))
              )}
            </View>

            {matchedTags.length > 0 && (
              <View style={styles.section}>
                <SectionHeader title="ハッシュタグ" icon="pricetag" styles={styles} C={C} />
                {matchedTags.map(t => (
                  <TagRow key={t.tag} tag={t.tag} count={t.count} onPress={handleTagPress} styles={styles} C={C} />
                ))}
              </View>
            )}

            <View style={styles.section}>
              <SectionHeader title={`投稿（${matchedPosts.length}件）`} icon="document-text" styles={styles} C={C} />
              {matchedPosts.length === 0 ? (
                <Text style={styles.emptySection}>一致する投稿が見つかりません</Text>
              ) : (
                matchedPosts.map(p => (
                  <PostRow key={p.postId} post={p} onPressAuthor={onPressProfile} styles={styles} C={C} />
                ))
              )}
            </View>
          </>
        )}

        {!isEmpty && matchedUsers.length === 0 && matchedPosts.length === 0 && matchedTags.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateIcon}>🔍</Text>
            <Text style={styles.emptyStateText}>「{query}」に一致する結果がありません</Text>
            <Text style={styles.emptyStateSub}>別のキーワードで試してください</Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

function createStyles(C: ThemeColors) {
  return StyleSheet.create({
    container    : { flex: 1, backgroundColor: C.bg },

    header       : { paddingTop: 52, paddingBottom: 12, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
    backBtn      : { padding: 4 },
    searchBar    : { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: C.bgInput, borderRadius: 24, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: C.border },
    searchIcon   : { marginRight: 6 },
    searchInput  : { flex: 1, color: C.text, fontSize: FONT_SIZE.md },
    clearBtn     : { padding: 2 },

    content      : { flex: 1 },
    section      : { marginTop: 4, paddingBottom: 4 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
    sectionTitle : { fontSize: FONT_SIZE.sm, fontWeight: '700', color: C.textSub, letterSpacing: 0.5 },
    emptySection : { fontSize: FONT_SIZE.sm, color: C.textMuted, textAlign: 'center', paddingVertical: 16 },

    userRow      : { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12, borderBottomWidth: 1, borderBottomColor: C.border },
    userAvatar   : { width: 46, height: 46, borderRadius: 23, backgroundColor: C.bgInput },
    userInfo     : { flex: 1, gap: 2 },
    userName     : { fontSize: FONT_SIZE.md, fontWeight: '700', color: C.text },
    userHandle   : { fontSize: FONT_SIZE.sm, color: C.textSub },
    userHobbies  : { fontSize: FONT_SIZE.xs, color: C.textMuted },
    followBtn    : { borderWidth: 1.5, borderColor: C.primary, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
    followBtnActive: { backgroundColor: C.primary },
    followBtnText  : { fontSize: FONT_SIZE.sm, fontWeight: '600', color: C.primary },
    followBtnTextActive: { color: '#fff' },

    postRow      : { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16, paddingVertical: 12, gap: 10, borderBottomWidth: 1, borderBottomColor: C.border },
    postAvatar   : { width: 38, height: 38, borderRadius: 19, backgroundColor: C.bgInput },
    postBody     : { flex: 1, gap: 3 },
    postHeader   : { flexDirection: 'row', alignItems: 'center', gap: 6 },
    postAuthor   : { fontSize: FONT_SIZE.sm, fontWeight: '700', color: C.text },
    postHandle   : { fontSize: FONT_SIZE.xs, color: C.textMuted },
    postContent  : { fontSize: FONT_SIZE.sm, color: C.textSub, lineHeight: 19 },
    postStats    : { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
    statNum      : { fontSize: FONT_SIZE.xs, color: C.textMuted, marginLeft: 3 },

    tagRow       : { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12, borderBottomWidth: 1, borderBottomColor: C.border },
    tagIconWrap  : { width: 36, height: 36, borderRadius: 18, backgroundColor: C.isDark ? '#1a1030' : '#ede8ff', alignItems: 'center', justifyContent: 'center' },
    tagInfo      : { flex: 1 },
    tagName      : { fontSize: FONT_SIZE.md, fontWeight: '700', color: C.text },
    tagCount     : { fontSize: FONT_SIZE.xs, color: C.textMuted, marginTop: 2 },

    emptyState     : { alignItems: 'center', paddingTop: 80, gap: 8 },
    emptyStateIcon : { fontSize: 48 },
    emptyStateText : { fontSize: FONT_SIZE.lg, fontWeight: 'bold', color: C.text, textAlign: 'center', paddingHorizontal: 24 },
    emptyStateSub  : { fontSize: FONT_SIZE.sm, color: C.textSub },
  });
}
