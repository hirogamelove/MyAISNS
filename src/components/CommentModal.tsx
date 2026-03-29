import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  View, Text, Modal, TouchableOpacity, FlatList,
  TextInput, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONT_SIZE } from '../constants';
import { useTheme, ThemeColors } from '../theme';
import { PostData, CommentData } from '../types';
import { useAppStore } from '../store/useAppStore';
import { timeAgo } from '../services/postService';
import { flattenCommentThread } from '../services/commentThread';
import { appendNestedAiReplies } from '../services/threadAiReplies';

interface Props {
  post: PostData | null;
  visible: boolean;
  onClose: () => void;
}

export default function CommentModal({ post, visible, onClose }: Props) {
  const C = useTheme();
  const styles = useMemo(() => createStyles(C), [C]);
  const posts = useAppStore(s => s.posts);
  const { humanUser, aiUser, updatePost } = useAppStore();

  const effectivePost = useMemo(() => {
    if (!post) return null;
    return posts.find(p => p.postId === post.postId) ?? post;
  }, [posts, post]);

  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState<CommentData | null>(null);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!visible) {
      setReplyingTo(null);
      setInput('');
    }
  }, [visible, post?.postId]);

  const threadRows = useMemo(
    () => (effectivePost ? flattenCommentThread(effectivePost.comments) : []),
    [effectivePost],
  );

  if (!effectivePost) return null;

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
      ...effectivePost,
      comments    : [...effectivePost.comments, userComment],
      commentCount: effectivePost.commentCount + 1,
    };
    updatePost(updated);
    setInput('');
    setReplyingTo(null);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);

    void appendNestedAiReplies(updated, userComment, aiUser ?? null, updatePost);

    setSending(false);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>💬 スレッド</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={24} color={C.textSub} />
          </TouchableOpacity>
        </View>

        <View style={styles.originalPost}>
          <Text style={styles.originalAuthor}>{effectivePost.authorName}</Text>
          <Text style={styles.originalContent} numberOfLines={3}>{effectivePost.content}</Text>
        </View>

        <FlatList
          ref={listRef}
          data={threadRows}
          keyExtractor={({ item }) => item.commentId}
          contentContainerStyle={{ padding: 16, paddingBottom: 8, gap: 0 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>まだリプがありません</Text>
              <Text style={styles.emptySubText}>下から返信できます</Text>
            </View>
          }
          renderItem={({ item: { item, depth } }) => (
            <View style={[styles.comment, { marginLeft: depth * 12 }]}>
              <View style={styles.commentAvatar}>
                <Text style={styles.commentAvatarText}>{item.authorName.slice(0, 1)}</Text>
              </View>
              <View style={styles.commentBody}>
                <View style={styles.commentHeader}>
                  <Text style={styles.commentAuthor}>{item.authorName}</Text>
                  <Text style={styles.commentTime}>{timeAgo(item.createdAt)}</Text>
                </View>
                <Text style={styles.commentContent}>{item.content}</Text>
                {humanUser && (
                  <TouchableOpacity style={styles.replyLink} onPress={() => setReplyingTo(item)}>
                    <Text style={styles.replyLinkText}>返信</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        />

        {replyingTo && humanUser && (
          <View style={styles.replyBanner}>
            <Text style={styles.replyBannerText} numberOfLines={1}>
              {replyingTo.authorName} へ返信
            </Text>
            <TouchableOpacity onPress={() => setReplyingTo(null)}>
              <Ionicons name="close-circle" size={22} color={C.textMuted} />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.inputArea}>
          <TextInput
            style={styles.input}
            placeholder={humanUser ? (replyingTo ? `${replyingTo.authorName}に返信…` : '投稿に返信…') : 'ログインが必要です'}
            placeholderTextColor={C.textMuted}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={200}
            editable={!!humanUser}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || sending || !humanUser) && styles.sendBtnDisabled]}
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
    </Modal>
  );
}

function createStyles(C: ThemeColors) {
  return StyleSheet.create({
    container      : { flex: 1, backgroundColor: C.bg },
    header         : { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.bgCard },
    headerTitle    : { fontSize: FONT_SIZE.lg, fontWeight: 'bold', color: C.text },
    originalPost   : { padding: 16, backgroundColor: C.bgInput, borderBottomWidth: 1, borderBottomColor: C.border },
    originalAuthor : { fontSize: FONT_SIZE.sm, fontWeight: 'bold', color: C.primary, marginBottom: 4 },
    originalContent: { fontSize: FONT_SIZE.sm, color: C.textSub, lineHeight: 20 },
    empty          : { alignItems: 'center', paddingTop: 40, gap: 6 },
    emptyText      : { color: C.textSub, fontSize: FONT_SIZE.md },
    emptySubText   : { color: C.textMuted, fontSize: FONT_SIZE.sm },
    comment        : { flexDirection: 'row', gap: 10, marginBottom: 12 },
    commentAvatar  : { width: 36, height: 36, borderRadius: 18, backgroundColor: C.primary, justifyContent: 'center', alignItems: 'center' },
    commentAvatarText: { color: '#fff', fontWeight: 'bold', fontSize: FONT_SIZE.sm },
    commentBody    : { flex: 1, backgroundColor: C.bgCard, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: C.border },
    commentHeader  : { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    commentAuthor  : { fontSize: FONT_SIZE.sm, fontWeight: 'bold', color: C.text },
    commentTime    : { fontSize: FONT_SIZE.xs, color: C.textMuted },
    commentContent : { fontSize: FONT_SIZE.sm, color: C.text, lineHeight: 20 },
    replyLink      : { alignSelf: 'flex-start', marginTop: 6 },
    replyLinkText  : { fontSize: FONT_SIZE.xs, color: C.primary, fontWeight: '600' },
    replyBanner    : { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 8, backgroundColor: C.bgInput, borderTopWidth: 1, borderTopColor: C.border },
    replyBannerText: { flex: 1, fontSize: FONT_SIZE.sm, color: C.textSub, marginRight: 8 },
    inputArea      : { flexDirection: 'row', padding: 12, gap: 10, backgroundColor: C.bgCard, borderTopWidth: 1, borderTopColor: C.border },
    input          : { flex: 1, backgroundColor: C.bgInput, borderRadius: 12, padding: 12, color: C.text, fontSize: FONT_SIZE.md, maxHeight: 100, borderWidth: 1, borderColor: C.border },
    sendBtn        : { width: 44, height: 44, borderRadius: 22, backgroundColor: C.primary, justifyContent: 'center', alignItems: 'center', alignSelf: 'flex-end' },
    sendBtnDisabled: { backgroundColor: C.textMuted },
  });
}
