import React, { useRef, useState, useMemo, useEffect } from 'react';
import {
  View, Text, FlatList, Image, TouchableOpacity,
  TextInput, StyleSheet, KeyboardAvoidingView, Platform,
  ActivityIndicator, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { FONT_SIZE } from '../constants';
import { useAppStore } from '../store/useAppStore';
import { PostData, CommentData } from '../types';
import { resolveIconUri } from '../services/iconService';
import { useTheme, ThemeColors } from '../theme';
import { timeAgo, formatCount, recalcBuzz } from '../services/postService';
import { flattenCommentThread } from '../services/commentThread';
import { appendNestedAiReplies } from '../services/threadAiReplies';
import { SAMPLE_AI_USERS } from '../services/sampleAIService';

interface Props {
  post    : PostData;
  onBack  : () => void;
  onPressAuthor : (userId: string) => void;
}

// authorId → icon URL を引くマップ
const SAMPLE_ICON_MAP = new Map(SAMPLE_AI_USERS.map(u => [u.userId, u.iconBase64]));

function AuthorAvatar({ authorId, authorName, size = 38 }: { authorId: string; authorName: string; size?: number }) {
  const C = useTheme();
  const { aiUser, humanUser } = useAppStore();
  const iconStr = SAMPLE_ICON_MAP.get(authorId)
    ?? (aiUser?.userId === authorId ? aiUser.iconBase64 : '')
    ?? (humanUser?.userId === authorId ? humanUser.iconBase64 : '');
  const uri = resolveIconUri(iconStr);
  const r   = size / 2;
  if (uri) return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: r }} />;
  return (
    <View style={{ width: size, height: size, borderRadius: r, backgroundColor: C.primary, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: size * 0.35 }}>{authorName.slice(0, 1)}</Text>
    </View>
  );
}

export default function PostDetailScreen({ post: initialPost, onBack, onPressAuthor }: Props) {
  const C = useTheme();
  const styles = useMemo(() => createStyles(C), [C]);
  const { humanUser, aiUser, updatePost, useLike } = useAppStore();
  const [post, setPost]     = useState<PostData>(initialPost);
  const [input, setInput]   = useState('');
  const [sending, setSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState<CommentData | null>(null);
  const listRef = useRef<FlatList>(null);
  const [likeAnim] = useState(new Animated.Value(1));

  const threadRows = useMemo(() => flattenCommentThread(post.comments), [post.comments]);

  const storePost = useAppStore(s => s.posts.find(p => p.postId === initialPost.postId));
  useEffect(() => {
    if (storePost) setPost(storePost);
  }, [storePost]);

  const isLiked    = humanUser ? post.likedByIds.includes(humanUser.userId) : false;

  // ─── いいね ──────────────────────────────────────────────
  function handleLike() {
    if (!humanUser) return;
    const already = post.likedByIds.includes(humanUser.userId);
    if (!already && !useLike()) return;
    const updated = recalcBuzz({
      ...post,
      likedByIds: already
        ? post.likedByIds.filter(id => id !== humanUser.userId)
        : [...post.likedByIds, humanUser.userId],
      likeCount: already ? post.likeCount - 1 : post.likeCount + 1,
    });
    setPost(updated);
    updatePost(updated);
    Animated.sequence([
      Animated.timing(likeAnim, { toValue: 1.4, duration: 100, useNativeDriver: true }),
      Animated.timing(likeAnim, { toValue: 1,   duration: 100, useNativeDriver: true }),
    ]).start();
  }

  // ─── コメント送信（人間はリプのみ。投稿への返信 or コメントへのネスト返信） ─
  async function handleSend() {
    if (!input.trim() || !humanUser || sending) return;
    setSending(true);

    const userComment: CommentData = {
      commentId     : `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      authorId      : humanUser.userId,
      authorName    : humanUser.displayName,
      content       : input.trim(),
      createdAt     : new Date().toISOString(),
      parentCommentId: replyingTo?.commentId,
    };
    const updated: PostData = {
      ...post,
      comments    : [...post.comments, userComment],
      commentCount: post.commentCount + 1,
    };
    setPost(updated);
    updatePost(updated);
    setInput('');
    setReplyingTo(null);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);

    void appendNestedAiReplies(updated, userComment, aiUser ?? null, p => {
      setPost(p);
      updatePost(p);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    });

    setSending(false);
  }

  // ─── ヘッダー（元の投稿） ─────────────────────────────────
  const Header = (
    <View>
      {/* リポストラベル */}
      {post.isRepost && (
        <View style={styles.repostLabel}>
          <Ionicons name="repeat" size={13} color={C.repost} />
          <Text style={styles.repostLabelText}>{post.repostAuthorName} がリポスト</Text>
        </View>
      )}

      {/* 著者行 */}
      <TouchableOpacity style={styles.authorRow} onPress={() => onPressAuthor(post.authorId)}>
        <AuthorAvatar authorId={post.authorId} authorName={post.authorName} size={46} />
        <View style={styles.authorInfo}>
          <View style={styles.authorNameRow}>
            <Text style={styles.authorName}>{post.authorName}</Text>
            {post.isAIAuthor && <View style={styles.aiBadge}><Text style={styles.aiBadgeText}>AI</Text></View>}
          </View>
          <Text style={styles.handle}>{post.authorHandle}</Text>
        </View>
        <Text style={styles.time}>{timeAgo(post.createdAt)}</Text>
      </TouchableOpacity>

      {/* 本文 */}
      <Text style={styles.content}>{post.content}</Text>

      {/* スタッツバー */}
      <View style={styles.statsBar}>
        <Text style={styles.statItem}>
          <Text style={styles.statNum}>{formatCount(post.likeCount)}</Text>
          <Text style={styles.statLabel}> いいね</Text>
        </Text>
        <Text style={styles.statItem}>
          <Text style={styles.statNum}>{formatCount(post.repostCount)}</Text>
          <Text style={styles.statLabel}> リポスト</Text>
        </Text>
        <Text style={styles.statItem}>
          <Text style={styles.statNum}>{formatCount(post.commentCount)}</Text>
          <Text style={styles.statLabel}> コメント</Text>
        </Text>
      </View>

      {/* アクションボタン */}
      <View style={styles.actions}>
        {/* いいね */}
        <TouchableOpacity style={styles.actionBtn} onPress={handleLike}>
          <Animated.View style={{ transform: [{ scale: likeAnim }] }}>
            <Ionicons name={isLiked ? 'heart' : 'heart-outline'} size={22} color={isLiked ? C.like : C.textSub} />
          </Animated.View>
          <Text style={[styles.actionLabel, isLiked && { color: C.like }]}>
            {isLiked ? 'いいね済み' : 'いいね'}
          </Text>
        </TouchableOpacity>

      </View>

      <View style={styles.divider} />
      <Text style={styles.commentsLabel}>💬 スレッド {post.commentCount > 0 ? `(${post.commentCount})` : ''}</Text>
    </View>
  );

  return (
    <LinearGradient colors={[C.bg, C.bgCard, C.bg]} style={styles.gradient}>
      {/* ページヘッダー */}
      <View style={styles.pageHeader}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.pageTitle}>スレッド</Text>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {/* コメントリスト */}
        <FlatList
          ref={listRef}
          data={threadRows}
          keyExtractor={({ item }) => item.commentId}
          ListHeaderComponent={Header}
          contentContainerStyle={{ paddingBottom: 8 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyComments}>
              <Text style={styles.emptyText}>まだリプがありません</Text>
              <Text style={styles.emptySubText}>下から返信できます 👇</Text>
            </View>
          }
          renderItem={({ item: { item, depth }, index }) => (
            <View style={[styles.commentRow, { marginLeft: depth * 14 }, index === 0 && { borderTopWidth: 0 }]}>
              <View style={styles.threadLineCol}>
                <TouchableOpacity onPress={() => onPressAuthor(item.authorId)} activeOpacity={0.7}>
                  <AuthorAvatar authorId={item.authorId} authorName={item.authorName} size={34} />
                </TouchableOpacity>
                {index < threadRows.length - 1 && <View style={styles.threadLine} />}
              </View>
              <View style={styles.commentBody}>
                <TouchableOpacity onPress={() => onPressAuthor(item.authorId)} activeOpacity={0.7}>
                  <View style={styles.commentHeader}>
                    <Text style={styles.commentAuthor} numberOfLines={1}>{item.authorName}</Text>
                    <Text style={styles.commentTime}>{timeAgo(item.createdAt)}</Text>
                  </View>
                </TouchableOpacity>
                <Text style={styles.commentContent}>{item.content}</Text>
                {humanUser && (
                  <TouchableOpacity
                    style={styles.replyLink}
                    onPress={() => setReplyingTo(item)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.replyLinkText}>返信</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        />

        {/* 入力エリア（人間はリプのみ） */}
        {replyingTo && humanUser && (
          <View style={styles.replyBanner}>
            <Text style={styles.replyBannerText} numberOfLines={1}>
              {replyingTo.authorName} へ返信
            </Text>
            <TouchableOpacity onPress={() => setReplyingTo(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={22} color={C.textMuted} />
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.inputArea}>
          {humanUser && (
            <AuthorAvatar authorId={humanUser.userId} authorName={humanUser.displayName} size={34} />
          )}
          <TextInput
            style={styles.input}
            placeholder={humanUser ? (replyingTo ? `${replyingTo.authorName}に返信…` : '投稿に返信…') : 'ログインが必要です'}
            placeholderTextColor={C.textMuted}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={200}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!input.trim() || sending || !humanUser}
          >
            {sending
              ? <ActivityIndicator color="#fff" size="small" />
              : <Ionicons name="send" size={18} color="#fff" />
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

function createStyles(C: ThemeColors) {
  return StyleSheet.create({
    gradient      : { flex: 1 },
    pageHeader    : { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.border },
    backBtn       : { padding: 4, width: 36 },
    pageTitle     : { fontSize: FONT_SIZE.lg, fontWeight: 'bold', color: C.text },
    repostLabel    : { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingTop: 12 },
    repostLabelText: { fontSize: FONT_SIZE.xs, color: C.repost },
    authorRow      : { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16, paddingBottom: 10 },
    authorInfo     : { flex: 1 },
    authorNameRow  : { flexDirection: 'row', alignItems: 'center', gap: 6 },
    authorName     : { fontSize: FONT_SIZE.md, fontWeight: 'bold', color: C.text },
    aiBadge        : { backgroundColor: C.primary, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
    aiBadgeText    : { color: '#fff', fontSize: FONT_SIZE.xs, fontWeight: 'bold' },
    handle         : { fontSize: FONT_SIZE.sm, color: C.textSub, marginTop: 2 },
    time           : { fontSize: FONT_SIZE.xs, color: C.textMuted },
    content        : { fontSize: FONT_SIZE.lg, color: C.text, lineHeight: 26, paddingHorizontal: 16, paddingBottom: 16 },
    statsBar       : { flexDirection: 'row', gap: 20, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: C.border },
    statItem       : {},
    statNum        : { fontSize: FONT_SIZE.md, fontWeight: 'bold', color: C.text },
    statLabel      : { fontSize: FONT_SIZE.sm, color: C.textSub },
    actions        : { flexDirection: 'row', gap: 4, paddingHorizontal: 8, paddingVertical: 8, borderTopWidth: 1, borderTopColor: C.border },
    actionBtn      : { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 12 },
    actionLabel    : { fontSize: FONT_SIZE.sm, color: C.textSub },
    divider        : { height: 1, backgroundColor: C.border, marginTop: 4 },
    commentsLabel  : { fontSize: FONT_SIZE.sm, fontWeight: '700', color: C.textMuted, paddingHorizontal: 16, paddingVertical: 12, letterSpacing: 0.5 },
    commentRow     : { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 12, gap: 10 },
    threadLineCol  : { alignItems: 'center', gap: 4 },
    threadLine     : { width: 2, flex: 1, backgroundColor: C.border, marginTop: 4, minHeight: 24 },
    commentBody    : { flex: 1, paddingBottom: 16 },
    commentHeader  : { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    commentAuthor  : { fontSize: FONT_SIZE.sm, fontWeight: 'bold', color: C.text, flex: 1 },
    commentTime    : { fontSize: FONT_SIZE.xs, color: C.textMuted },
    commentContent : { fontSize: FONT_SIZE.sm, color: C.text, lineHeight: 20 },
    replyLink      : { alignSelf: 'flex-start', marginTop: 6 },
    replyLinkText  : { fontSize: FONT_SIZE.xs, color: C.primary, fontWeight: '600' },
    replyBanner    : { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: C.bgInput, borderTopWidth: 1, borderTopColor: C.border },
    replyBannerText: { flex: 1, fontSize: FONT_SIZE.sm, color: C.textSub, marginRight: 8 },
    emptyComments  : { alignItems: 'center', paddingVertical: 40, gap: 8 },
    emptyText      : { fontSize: FONT_SIZE.md, color: C.textSub },
    emptySubText   : { fontSize: FONT_SIZE.sm, color: C.textMuted },
    inputArea      : { flexDirection: 'row', alignItems: 'flex-end', gap: 10, padding: 12, backgroundColor: C.bgCard, borderTopWidth: 1, borderTopColor: C.border },
    input          : { flex: 1, backgroundColor: C.bgInput, borderRadius: 12, padding: 12, color: C.text, fontSize: FONT_SIZE.md, maxHeight: 100, borderWidth: 1, borderColor: C.border },
    sendBtn        : { width: 42, height: 42, borderRadius: 21, backgroundColor: C.primary, justifyContent: 'center', alignItems: 'center' },
    sendBtnDisabled: { backgroundColor: C.textMuted },
  });
}
