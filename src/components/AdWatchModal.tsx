import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT_SIZE, EARN } from '../constants';
import { useAppStore } from '../store/useAppStore';

interface Props {
  visible: boolean;
  onClose: () => void;
  onEarned?: () => void;
}

const AD_DURATION = 5;

const AD_SCENES = [
  { emoji: '🪙', text: 'コインを集めてアバターをパワーアップ！', sub: 'MyAI SNS プレミアム' },
  { emoji: '🎮', text: '話題のゲームが今なら無料ダウンロード！', sub: 'GameWorld App' },
  { emoji: '🍜', text: 'あなたの近くのグルメをAIが発見', sub: 'YumAI グルメアプリ' },
  { emoji: '💄', text: 'AIがあなたに似合うコーデを提案', sub: 'StyleAI ファッション' },
  { emoji: '🏋️', text: '専用トレーニングプランを今すぐ開始', sub: 'SmartGym AI' },
];

export default function AdWatchModal({ visible, onClose, onEarned }: Props) {
  const { earnCoins } = useAppStore();
  const [phase, setPhase]       = useState<'watching' | 'done'>('watching');
  const [countdown, setCountdown] = useState(AD_DURATION);
  const [adScene]               = useState(() => AD_SCENES[Math.floor(Math.random() * AD_SCENES.length)]);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const timerRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const animRef      = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (!visible) return;

    setPhase('watching');
    setCountdown(AD_DURATION);
    progressAnim.setValue(0);

    animRef.current = Animated.timing(progressAnim, {
      toValue: 1,
      duration: AD_DURATION * 1000,
      useNativeDriver: false,
    });
    animRef.current.start();

    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          setPhase('done');
          earnCoins(EARN.WATCH_AD);
          onEarned?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      animRef.current?.stop();
    };
  }, [visible]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  function handleClose() {
    if (timerRef.current) clearInterval(timerRef.current);
    animRef.current?.stop();
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>

          {phase === 'watching' ? (
            <>
              {/* ヘッダー */}
              <View style={styles.header}>
                <Text style={styles.headerTitle}>📺 広告視聴中</Text>
                <View style={styles.skipBadge}>
                  <Text style={styles.skipText}>{countdown}秒後スキップ可</Text>
                </View>
              </View>

              {/* 広告コンテンツ（シミュレーション） */}
              <View style={styles.adScreen}>
                <Text style={styles.adEmoji}>{adScene.emoji}</Text>
                <Text style={styles.adText}>{adScene.text}</Text>
                <Text style={styles.adSub}>{adScene.sub}</Text>
              </View>

              {/* プログレスバー */}
              <View style={styles.progressBg}>
                <Animated.View style={[styles.progressFill, { width: progressWidth as any }]} />
              </View>
              <Text style={styles.progressLabel}>
                視聴後に <Text style={styles.earnHighlight}>🪙 {EARN.WATCH_AD} コイン</Text> を獲得できます
              </Text>
            </>
          ) : (
            <>
              {/* 完了画面 */}
              <View style={styles.doneArea}>
                <Text style={styles.doneEmoji}>🎉</Text>
                <Text style={styles.doneTitle}>視聴完了！</Text>
                <View style={styles.doneEarnCard}>
                  <Text style={styles.doneEarnLabel}>獲得コイン</Text>
                  <Text style={styles.doneEarnAmount}>+{EARN.WATCH_AD} 🪙</Text>
                </View>
                <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
                  <Text style={styles.closeBtnText}>閉じる</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay       : { flex: 1, backgroundColor: 'rgba(0,0,0,0.88)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card          : { backgroundColor: COLORS.bgCard, borderRadius: 20, padding: 20, width: '100%', borderWidth: 1, borderColor: COLORS.border },
  header        : { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  headerTitle   : { fontSize: FONT_SIZE.md, fontWeight: 'bold', color: COLORS.text },
  skipBadge     : { backgroundColor: COLORS.bgInput, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  skipText      : { fontSize: FONT_SIZE.xs, color: COLORS.textSub },
  adScreen      : { width: '100%', height: 160, backgroundColor: '#0a0a14', borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 16, gap: 8, borderWidth: 1, borderColor: COLORS.border },
  adEmoji       : { fontSize: 52 },
  adText        : { fontSize: FONT_SIZE.md, color: COLORS.text, fontWeight: '600', textAlign: 'center', paddingHorizontal: 16 },
  adSub         : { fontSize: FONT_SIZE.xs, color: COLORS.primary },
  progressBg    : { height: 6, backgroundColor: COLORS.bgInput, borderRadius: 3, overflow: 'hidden', marginBottom: 8 },
  progressFill  : { height: '100%', backgroundColor: COLORS.gold, borderRadius: 3 },
  progressLabel : { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, textAlign: 'center' },
  earnHighlight : { color: COLORS.gold, fontWeight: 'bold' },
  doneArea      : { alignItems: 'center', paddingVertical: 8, gap: 12 },
  doneEmoji     : { fontSize: 56 },
  doneTitle     : { fontSize: FONT_SIZE.xl, fontWeight: 'bold', color: COLORS.text },
  doneEarnCard  : { backgroundColor: '#1a1200', borderRadius: 14, paddingHorizontal: 32, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: COLORS.adBorder },
  doneEarnLabel : { fontSize: FONT_SIZE.xs, color: COLORS.textSub, marginBottom: 4 },
  doneEarnAmount: { fontSize: FONT_SIZE.xxl, color: COLORS.gold, fontWeight: 'bold' },
  closeBtn      : { backgroundColor: COLORS.primary, borderRadius: 14, paddingHorizontal: 40, paddingVertical: 12, marginTop: 4 },
  closeBtnText  : { color: '#fff', fontWeight: 'bold', fontSize: FONT_SIZE.md },
});
