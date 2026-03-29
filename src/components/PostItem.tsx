import React, { useState, useMemo } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { resolveIconUri, diceBearUrl } from '../services/iconService';
import { Ionicons } from '@expo/vector-icons';
import { PostData } from '../types';
import { FONT_SIZE } from '../constants';
import { useTheme, ThemeColors } from '../theme';
import { timeAgo, formatCount } from '../services/postService';
import { useAppStore } from '../store/useAppStore';
import { recalcBuzz } from '../services/postService';
import { SAMPLE_AI_USERS } from '../services/sampleAIService';

interface Props {
  post: PostData;
  onPressAuthor?:   (userId: string) => void;
  onPressComment?:  (post: PostData) => void;
  onPressPost?:     (post: PostData) => void;
  onPressHashtag?:  (tag: string) => void;
}

// サンプルAIユーザーの userId → 現在のアイコン URL を引くマップ（常に最新スタイルを使う）
const SAMPLE_AI_ICON_MAP = new Map(SAMPLE_AI_USERS.map(u => [u.userId, u.iconBase64]));

/** 本文をハッシュタグ部分とそれ以外に分割してタップ可能にレンダリング */
function renderContent(
  content: string,
  contentStyle: any,
  hashtagStyle: any,
  onPressHashtag?: (tag: string) => void,
) {
  const parts = content.split(/(#[\w\u3040-\u9fff\u30a0-\u30ff]+)/g);
  return (
    <Text style={contentStyle}>
      {parts.map((part, i) =>
        part.startsWith('#') ? (
          <Text
            key={i}
            style={hashtagStyle}
            onPress={() => onPressHashtag?.(part.slice(1))}
          >
            {part}
          </Text>
        ) : (
          <Text key={i}>{part}</Text>
        ),
      )}
    </Text>
  );
}

export default function PostItem({ post, onPressAuthor, onPressComment, onPressPost, onPressHashtag }: Props) {
  const C = useTheme();
  const styles = useMemo(() => createStyles(C), [C]);
  const { humanUser, updatePost, useLike } = useAppStore();
  const [likeAnim] = useState(new Animated.Value(1));

  // サンプルAIの投稿は保存済みURLではなく現在のアイコンを優先
  const authorIcon = useMemo(() => {
    return SAMPLE_AI_ICON_MAP.get(post.authorId) ?? post.authorIconBase64;
  }, [post.authorId, post.authorIconBase64]);

  const isLiked = humanUser ? post.likedByIds.includes(humanUser.userId) : false;

  // ─── いいね ────────────────────────────────────────────
  function handleLike() {
    if (!humanUser) return;
    const alreadyLiked = post.likedByIds.includes(humanUser.userId);
    if (!alreadyLiked && !useLike()) return;

    const newLikedByIds = alreadyLiked
      ? post.likedByIds.filter(id => id !== humanUser.userId)
      : [...post.likedByIds, humanUser.userId];
    const updated = recalcBuzz({
      ...post,
      likedByIds: newLikedByIds,
      likeCount : alreadyLiked ? post.likeCount - 1 : post.likeCount + 1,
    });
    updatePost(updated);

    Animated.sequence([
      Animated.timing(likeAnim, { toValue: 1.4, duration: 100, useNativeDriver: true }),
      Animated.timing(likeAnim, { toValue: 1,   duration: 100, useNativeDriver: true }),
    ]).start();
  }

  return (
    <View style={[styles.container, post.isAd && styles.adContainer]}>
      {/* リポストヘッダー */}
      {post.isRepost && (
        <View style={styles.repostHeader}>
          <Ionicons name="repeat" size={12} color={C.repost} />
          <Text style={styles.repostText}> {post.repostAuthorName} がリポスト</Text>
        </View>
      )}

      {/* 広告ラベル */}
      {post.isAd && (
        <View style={styles.adBadge}>
          <Text style={styles.adBadgeText}>広告</Text>
        </View>
      )}

      <View style={styles.row}>
        {/* アバター */}
        <TouchableOpacity onPress={() => onPressAuthor?.(post.authorId)}>
          {(() => {
            const uri = resolveIconUri(authorIcon)
              ?? (post.isAIAuthor ? diceBearUrl(post.authorHandle || post.authorName) : null);
            return uri
              ? <Image source={{ uri }} style={styles.avatar} />
              : <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarInitial}>{post.authorName.slice(0, 2)}</Text>
                </View>;
          })()}
        </TouchableOpacity>

        <View style={styles.body}>
          {/* 著者情報 */}
          <View style={styles.authorRow}>
            <Text style={styles.authorName}>{post.authorName}</Text>
            {post.isAIAuthor && <View style={styles.aiBadge}><Text style={styles.aiBadgeText}>AI</Text></View>}
            <Text style={styles.handle}>{post.authorHandle}</Text>
            <Text style={styles.time}> · {timeAgo(post.createdAt)}</Text>
          </View>

          {/* 本文（タップで詳細画面、ハッシュタグはタップで検索） */}
          <TouchableOpacity onPress={() => onPressPost?.(post)} activeOpacity={0.85}>
            {renderContent(post.content, styles.content, styles.hashtag, onPressHashtag)}
          </TouchableOpacity>

          {/* アクションボタン */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.actionBtn} onPress={handleLike}>
              <Animated.View style={{ transform: [{ scale: likeAnim }] }}>
              <Ionicons
                name={isLiked ? 'heart' : 'heart-outline'}
                size={18}
                color={isLiked ? C.like : C.textMuted}
              />
              </Animated.View>
              <Text style={[styles.actionCount, isLiked && { color: C.like }]}>
                {formatCount(post.likeCount)}
              </Text>
            </TouchableOpacity>

            <View style={styles.actionBtn} accessibilityLabel="リポスト数">
              <Ionicons name="repeat" size={18} color={C.textMuted} />
              <Text style={styles.actionCount}>{formatCount(post.repostCount)}</Text>
            </View>

            <TouchableOpacity style={styles.actionBtn} onPress={() => (onPressPost ?? onPressComment)?.(post)}>
              <Ionicons name="chatbubble-outline" size={18} color={C.textMuted} />
              <Text style={styles.actionCount}>{formatCount(post.commentCount)}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

function createStyles(C: ThemeColors) {
  return StyleSheet.create({
    container       : { backgroundColor: C.bgCard, borderBottomWidth: 1, borderBottomColor: C.border, padding: 14 },
    adContainer     : { backgroundColor: C.adBg, borderColor: C.adBorder, borderWidth: 1, borderRadius: 8, marginHorizontal: 8, marginVertical: 4 },
    repostHeader    : { flexDirection: 'row', alignItems: 'center', marginBottom: 6, paddingLeft: 40 },
    repostText      : { fontSize: FONT_SIZE.xs, color: C.repost },
    adBadge         : { alignSelf: 'flex-start', backgroundColor: C.adBorder, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, marginBottom: 6 },
    adBadgeText     : { fontSize: FONT_SIZE.xs, color: '#ffd700' },
    row             : { flexDirection: 'row', gap: 10 },
    avatar          : { width: 44, height: 44, borderRadius: 22 },
    avatarPlaceholder: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.primary, justifyContent: 'center', alignItems: 'center' },
    avatarInitial   : { color: '#fff', fontWeight: 'bold', fontSize: FONT_SIZE.md },
    body            : { flex: 1 },
    authorRow       : { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4, marginBottom: 4 },
    authorName      : { fontWeight: 'bold', color: C.text, fontSize: FONT_SIZE.md },
    aiBadge         : { backgroundColor: C.primary, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
    aiBadgeText     : { color: '#fff', fontSize: FONT_SIZE.xs, fontWeight: 'bold' },
    handle          : { color: C.textSub, fontSize: FONT_SIZE.sm },
    time            : { color: C.textMuted, fontSize: FONT_SIZE.xs },
    content         : { color: C.text, fontSize: FONT_SIZE.md, lineHeight: 22, marginBottom: 10 },
    hashtag         : { color: C.primary, fontWeight: '600' },
    actions         : { flexDirection: 'row', gap: 24 },
    actionBtn       : { flexDirection: 'row', alignItems: 'center', gap: 4 },
    actionCount     : { color: C.textMuted, fontSize: FONT_SIZE.sm },
  });
}
