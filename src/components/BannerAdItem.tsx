import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT_SIZE, EARN, BANNER_EXTERNAL_CLICK_URL } from '../constants';

export interface BannerAd {
  id: string;
  brand: string;
  content: string;
  icon: string;
  cta: string;
}

export const BANNER_ADS: BannerAd[] = [
  {
    id: 'ad1', icon: '🪙', brand: 'AIコインプラス',
    content: '🎉 今だけ！コインが最大50%割増し！プレミアムパックを購入してアバターをアップグレードしよう',
    cta: '詳しく見る',
  },
  {
    id: 'ad2', icon: '🏃', brand: 'スマートジムAI',
    content: '💪 AIがあなた専用のトレーニングプランを提案。まずは1週間無料体験！',
    cta: '無料体験を始める',
  },
  {
    id: 'ad3', icon: '🍽️', brand: 'グルメアプリ YumAI',
    content: '🍜 近くのおすすめグルメをAIが発見。ダウンロード無料・今すぐ試す',
    cta: 'アプリを入手',
  },
  {
    id: 'ad4', icon: '✨', brand: 'PhotoBoost AI',
    content: '📸 AIが瞬時に写真を高画質化。プロ級の仕上がりを1タップで体験',
    cta: '今すぐ試す',
  },
  {
    id: 'ad5', icon: '🎧', brand: 'MusicMood',
    content: '🎵 気分に合った音楽をAIが選曲。1ヶ月間無料で全曲聴き放題！',
    cta: '無料で聴く',
  },
  {
    id: 'ad6', icon: '💎', brand: 'スタイルAI',
    content: '👗 AIがあなたの体型・好みからコーデを提案。ファッションをもっと楽しもう',
    cta: 'コーデを見る',
  },
];

interface Props {
  ad: BannerAd;
  onWatch: () => void;
  watchDisabled?: boolean;
}

export default function BannerAdItem({ ad, onWatch, watchDisabled }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.sponsorBadge}>
          <Ionicons name="megaphone" size={10} color={COLORS.gold} />
          <Text style={styles.sponsorText}>スポンサー</Text>
        </View>
        <Text style={styles.brand}>{ad.brand}</Text>
      </View>

      <View style={styles.body}>
        <Text style={styles.adIcon}>{ad.icon}</Text>
        <Text style={styles.content}>{ad.content}</Text>
      </View>

      <View style={styles.footer}>
        {BANNER_EXTERNAL_CLICK_URL ? (
          <TouchableOpacity
            onPress={() => { void Linking.openURL(BANNER_EXTERNAL_CLICK_URL); }}
            activeOpacity={0.7}
          >
            <Text style={styles.cta}>{ad.cta} →</Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.cta}>{ad.cta} →</Text>
        )}
        <TouchableOpacity
          style={[styles.watchBtn, watchDisabled && styles.watchBtnDisabled]}
          onPress={onWatch}
          disabled={watchDisabled}
          activeOpacity={0.7}
        >
          <Ionicons name="play-circle" size={14} color={watchDisabled ? COLORS.textMuted : COLORS.gold} />
          <Text style={[styles.watchText, watchDisabled && styles.watchTextDisabled]}>
            {watchDisabled ? '視聴済み' : `動画を見て +${EARN.WATCH_AD}🪙`}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container     : { marginHorizontal: 8, marginVertical: 4, backgroundColor: COLORS.adBg, borderRadius: 14, borderWidth: 1, borderColor: COLORS.adBorder, padding: 14 },
  header        : { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  sponsorBadge  : { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#2a1800', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: COLORS.adBorder },
  sponsorText   : { fontSize: FONT_SIZE.xs, color: COLORS.gold, fontWeight: 'bold' },
  brand         : { fontSize: FONT_SIZE.sm, color: COLORS.textSub },
  body          : { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  adIcon        : { fontSize: 30, lineHeight: 36 },
  content       : { flex: 1, fontSize: FONT_SIZE.sm, color: COLORS.text, lineHeight: 20 },
  footer        : { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cta           : { fontSize: FONT_SIZE.sm, color: COLORS.primaryLight },
  watchBtn      : { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#1a1200', borderRadius: 8, borderWidth: 1, borderColor: COLORS.adBorder, paddingHorizontal: 10, paddingVertical: 6 },
  watchBtnDisabled: { borderColor: COLORS.border, backgroundColor: COLORS.bgInput },
  watchText     : { fontSize: FONT_SIZE.xs, color: COLORS.gold, fontWeight: '600' },
  watchTextDisabled: { color: COLORS.textMuted },
});
