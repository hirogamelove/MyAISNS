import React, { useEffect, useMemo } from 'react';
import {
  View, Text, FlatList, StyleSheet, Image,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONT_SIZE } from '../constants';
import { useAppStore } from '../store/useAppStore';
import { AppNotification, NotificationType } from '../types';
import { resolveIconUri, diceBearUrl } from '../services/iconService';
import { timeAgo } from '../services/postService';
import { useTheme, ThemeColors } from '../theme';

export default function NotificationScreen() {
  const C = useTheme();
  const styles = useMemo(() => createStyles(C), [C]);

  const TYPE_CONFIG: Record<NotificationType, { icon: string; color: string; label: string; labelThread?: string }> = {
    like    : { icon: 'heart',        color: C.like,         label: 'があなたの投稿にいいねしました' },
    repost  : { icon: 'repeat',       color: C.repost,       label: 'があなたの投稿をリポストしました' },
    comment : {
      icon: 'chatbubble',
      color: C.primaryLight,
      label: 'があなたの投稿にコメントしました',
      labelThread: 'がスレッドに返信しました',
    },
    follow  : { icon: 'person-add',   color: C.accentBlue,   label: 'があなたをフォローしました' },
    buzz    : { icon: 'flame',        color: C.gold,         label: 'の投稿がバズっています 🔥' },
  };

  const { notifications, markAllRead, unreadCount } = useAppStore();

  useEffect(() => {
    if (unreadCount > 0) markAllRead();
  }, []);

  if (notifications.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>🔔 通知</Text>
        </View>
        <View style={styles.emptyBody}>
          <Text style={styles.emptyIcon}>🔕</Text>
          <Text style={styles.emptyText}>まだ通知はありません</Text>
          <Text style={styles.emptySub}>
            いいね・リポスト・コメントが来ると{'\n'}ここに表示されます
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🔔 通知</Text>
        {notifications.length > 0 && (
          <Text style={styles.headerCount}>{notifications.length}件</Text>
        )}
      </View>

      <FlatList
        data={notifications}
        keyExtractor={n => n.id}
        contentContainerStyle={{ paddingBottom: 32 }}
        renderItem={({ item }) => <NotificationItem notif={item} typeConfig={TYPE_CONFIG} styles={styles} C={C} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  );
}

function NotificationItem({
  notif, typeConfig, styles, C,
}: {
  notif: AppNotification;
  typeConfig: Record<NotificationType, { icon: string; color: string; label: string }>;
  styles: ReturnType<typeof createStyles>;
  C: ThemeColors;
}) {
  const cfg = typeConfig[notif.type];
  const uri = resolveIconUri(notif.actorIcon) ?? diceBearUrl(notif.actorName);

  return (
    <View style={[styles.item, !notif.read && styles.itemUnread]}>
      {!notif.read && <View style={styles.unreadDot} />}

      <View style={styles.avatarWrap}>
        <Image source={{ uri }} style={styles.avatar} />
        <View style={[styles.iconBadge, { backgroundColor: cfg.color }]}>
          <Ionicons name={cfg.icon as any} size={11} color="#fff" />
        </View>
      </View>

      <View style={styles.body}>
        <Text style={styles.actorText} numberOfLines={2}>
          <Text style={styles.actorName}>{notif.actorName}</Text>
          <Text style={styles.actionText}>{actionLabel}</Text>
        </Text>

        {notif.type === 'comment' && notif.replyTargetPreview && (
          <Text style={styles.replyTarget} numberOfLines={1}>
            Re: 「{notif.replyTargetPreview}」
          </Text>
        )}

        {notif.type === 'comment' && notif.commentContent && (
          <Text style={styles.commentContent} numberOfLines={2}>
            「{notif.commentContent}」
          </Text>
        )}

        {notif.postContent && (
          <Text style={styles.postPreview} numberOfLines={1}>
            {notif.type === 'comment' ? '投稿: ' : ''}{notif.postContent}
            {notif.postContent.length >= 60 ? '…' : ''}
          </Text>
        )}

        <Text style={styles.timeText}>{timeAgo(notif.createdAt)}</Text>
      </View>
    </View>
  );
}

function createStyles(C: ThemeColors) {
  return StyleSheet.create({
    container      : { flex: 1, backgroundColor: C.bg },
    emptyContainer : { flex: 1, backgroundColor: C.bg },
    header         : { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 54, paddingBottom: 14, backgroundColor: C.bgCard, borderBottomWidth: 1, borderBottomColor: C.border },
    headerTitle    : { fontSize: FONT_SIZE.lg, fontWeight: 'bold', color: C.text },
    headerCount    : { fontSize: FONT_SIZE.sm, color: C.textSub },
    emptyBody      : { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10 },
    emptyIcon      : { fontSize: 56 },
    emptyText      : { fontSize: FONT_SIZE.lg, fontWeight: 'bold', color: C.text },
    emptySub       : { fontSize: FONT_SIZE.sm, color: C.textSub, textAlign: 'center', lineHeight: 20 },

    item           : { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16, paddingVertical: 14, gap: 12, backgroundColor: C.bgCard },
    itemUnread     : { backgroundColor: C.isDark ? '#0e0e20' : '#f0f0ff' },
    unreadDot      : { position: 'absolute', left: 6, top: '50%' as any, width: 6, height: 6, borderRadius: 3, backgroundColor: C.primary },
    separator      : { height: 1, backgroundColor: C.border },

    avatarWrap     : { position: 'relative', width: 46, height: 46 },
    avatar         : { width: 46, height: 46, borderRadius: 23 },
    iconBadge      : { position: 'absolute', bottom: -2, right: -2, width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: C.bg },

    body           : { flex: 1, gap: 3 },
    actorText      : { flexDirection: 'row', flexWrap: 'wrap' },
    actorName      : { fontSize: FONT_SIZE.sm, fontWeight: 'bold', color: C.text },
    actionText     : { fontSize: FONT_SIZE.sm, color: C.textSub },
    replyTarget    : { fontSize: FONT_SIZE.xs, color: C.textMuted, marginTop: 2, fontStyle: 'italic' },
    commentContent : { fontSize: FONT_SIZE.sm, color: C.text, backgroundColor: C.bgInput, borderRadius: 8, padding: 8, marginTop: 2 },
    postPreview    : { fontSize: FONT_SIZE.xs, color: C.textMuted, fontStyle: 'italic' },
    timeText       : { fontSize: FONT_SIZE.xs, color: C.textMuted, marginTop: 2 },
  });
}
