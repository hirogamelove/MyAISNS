import React, { useState, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert,
  Modal, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { FONT_SIZE, EARN, COST } from '../constants';
import { useAppStore } from '../store/useAppStore';
import { useTheme, ThemeColors } from '../theme';
import AdWatchModal from '../components/AdWatchModal';
import PaymentModal from '../components/PaymentModal';
import { createAdPost } from '../services/postService';
import { COIN_PACKS, CoinPack } from '../services/stripeService';

const MAX_WATCH_ADS = 5;

type Styles = ReturnType<typeof createStyles>;

// ─── コインパックカード ────────────────────────────────────
function PackCard({ pack, onPress, styles, C }: { pack: CoinPack; onPress: () => void; styles: Styles; C: ThemeColors }) {
  const isPopular  = pack.id === 'popular';
  const isPremium  = pack.id === 'premium';

  return (
    <TouchableOpacity
      style={[styles.packCard, isPopular && styles.packCardPopular, isPremium && styles.packCardPremium]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {pack.badge && (
        <View style={[styles.packBadge, isPremium && styles.packBadgePremium]}>
          <Text style={styles.packBadgeText}>{pack.badge}</Text>
        </View>
      )}

      <View style={styles.packTop}>
        <View style={styles.packCoinArea}>
          <Text style={styles.packCoinEmoji}>🪙</Text>
          <Text style={[styles.packCoins, isPremium && { color: C.gold }]}>
            {pack.coins.toLocaleString()}
          </Text>
          {pack.bonus && pack.bonus > 0 ? (
            <View style={styles.packBonus}>
              <Text style={styles.packBonusText}>+{pack.bonus} おまけ</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.packPriceArea}>
          <Text style={[styles.packPrice, isPremium && { color: C.primary }]}>
            ¥{pack.priceJpy.toLocaleString()}
          </Text>
          <Text style={styles.packPriceNote}>
            約 ¥{(pack.priceJpy / (pack.coins + (pack.bonus ?? 0)) * 100).toFixed(1)} / 100コイン
          </Text>
        </View>
      </View>

      <Text style={styles.packLabel}>{pack.label}</Text>

      <LinearGradient
        colors={isPremium ? ['#7c5cfc', '#5c3cdc'] : isPopular ? ['#2a1a4a', '#1a0a3a'] : [C.bgInput, C.bgInput]}
        style={styles.packBtn}
      >
        <Ionicons name="card" size={15} color="#fff" />
        <Text style={styles.packBtnText}>購入する</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

// ─── 残高バー ─────────────────────────────────────────────
function CoinBalanceBar({ coins, styles, C }: { coins: number; styles: Styles; C: ThemeColors }) {
  return (
    <LinearGradient colors={C.isDark ? ['#1a0a3a', '#0a0a1a'] : ['#ede8ff', '#f5f6fa']} style={styles.balanceBar}>
      <View style={styles.balanceLeft}>
        <Text style={styles.balanceLabel}>現在のコイン残高</Text>
        <Text style={styles.balanceCoins}>🪙 {coins.toLocaleString()}</Text>
      </View>
      <View style={styles.balanceRight}>
        <Text style={styles.balanceSub}>できること</Text>
        <Text style={styles.balanceDesc}>
          アイコン再生成 {Math.floor(coins / COST.ICON_REGEN)}回
        </Text>
      </View>
    </LinearGradient>
  );
}

export default function ShopScreen() {
  const C = useTheme();
  const styles = useMemo(() => createStyles(C), [C]);
  const { humanUser, aiUser, earnCoins, spendCoins, addPost } = useAppStore();

  const [watchAdsToday, setWatchAdsToday]   = useState(0);
  const [adModalVisible, setAdModalVisible] = useState(false);
  const [selectedPack, setSelectedPack]     = useState<CoinPack | null>(null);
  const [paymentVisible, setPaymentVisible] = useState(false);

  // 広告出稿モーダル
  const [adPostModal, setAdPostModal] = useState(false);
  const [adContent, setAdContent]     = useState('');
  const [adPosting, setAdPosting]     = useState(false);

  const coins = humanUser?.coins ?? 0;
  const freeRegen = humanUser?.freeIconRegenRemaining ?? 0;
  const freeChat  = humanUser?.freeChatInstructionsToday ?? 0;

  // ─── 広告視聴 ──────────────────────────────────────────
  function handleWatchAd() {
    if (watchAdsToday >= MAX_WATCH_ADS) {
      Alert.alert('上限', `今日の広告視聴は${MAX_WATCH_ADS}回までです`);
      return;
    }
    setAdModalVisible(true);
  }

  // ─── デイリーボーナス ───────────────────────────────────
  function handleDailyLogin() {
    earnCoins(EARN.DAILY_LOGIN);
    Alert.alert('ログインボーナス！', `🪙 ${EARN.DAILY_LOGIN} コイン獲得しました！`);
  }

  // ─── コインパック購入ボタン ─────────────────────────────
  function handlePackPress(pack: CoinPack) {
    setSelectedPack(pack);
    setPaymentVisible(true);
  }

  function handlePaymentSuccess(pack: CoinPack) {
    const total = pack.coins + (pack.bonus ?? 0);
    Alert.alert(
      '購入完了 🎉',
      `${pack.label}を購入しました！\n🪙 ${total.toLocaleString()} コインが追加されました`,
    );
  }

  // ─── 広告出稿 ──────────────────────────────────────────
  async function handleCreateAdPost() {
    if (!humanUser) return;
    if (!adContent.trim()) {
      Alert.alert('入力エラー', '広告テキストを入力してください');
      return;
    }
    if (humanUser.coins < COST.AD_POST) {
      Alert.alert('コイン不足', `広告出稿には🪙${COST.AD_POST}コイン必要です`);
      return;
    }
    setAdPosting(true);
    if (!spendCoins(COST.AD_POST)) {
      Alert.alert('コイン不足', `広告出稿には🪙${COST.AD_POST}コイン必要です`);
      setAdPosting(false);
      return;
    }
    const adPost = createAdPost(humanUser, adContent.trim());
    addPost(adPost);
    setAdPosting(false);
    setAdPostModal(false);
    setAdContent('');
    Alert.alert('出稿完了！', 'タイムラインに広告が掲載されました 📣');
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 50 }}>

      {/* ─── ヘッダー ─────────────────────────────────── */}
      <LinearGradient colors={[C.bgCard, C.bg]} style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>🛍️ ショップ</Text>
          <Text style={styles.headerSub}>コインを獲得・使用できます</Text>
        </View>
      </LinearGradient>

      {/* ─── コイン残高バー ───────────────────────────── */}
      <CoinBalanceBar coins={coins} styles={styles} C={C} />

      {/* ─── 無料で獲得 ──────────────────────────────── */}
      <Text style={styles.sectionTitle}>無料で獲得</Text>
      <View style={styles.card}>

        {/* デイリーログイン */}
        <TouchableOpacity style={styles.earnRow} onPress={handleDailyLogin}>
          <LinearGradient colors={['#1a0a3a', '#0a0020']} style={styles.earnIconWrap}>
            <Text style={styles.earnEmoji}>📅</Text>
          </LinearGradient>
          <View style={styles.earnInfo}>
            <Text style={styles.earnLabel}>デイリーログインボーナス</Text>
            <Text style={styles.earnSub}>毎日受け取れます</Text>
          </View>
          <View style={styles.earnReward}>
            <Text style={styles.earnCoins}>+{EARN.DAILY_LOGIN}</Text>
            <Text style={styles.earnCoinLabel}>🪙</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.divider} />

        {/* 広告視聴 */}
        <TouchableOpacity
          style={[styles.earnRow, watchAdsToday >= MAX_WATCH_ADS && styles.disabled]}
          onPress={handleWatchAd}
          disabled={watchAdsToday >= MAX_WATCH_ADS}
        >
          <LinearGradient colors={['#1a0a00', '#0a0500']} style={styles.earnIconWrap}>
            <Text style={styles.earnEmoji}>📺</Text>
          </LinearGradient>
          <View style={styles.earnInfo}>
            <Text style={styles.earnLabel}>動画広告を視聴</Text>
            <View style={styles.adProgressRow}>
              {Array.from({ length: MAX_WATCH_ADS }).map((_, i) => (
                <View
                  key={i}
                  style={[styles.adDot, i < watchAdsToday && styles.adDotFilled]}
                />
              ))}
              <Text style={styles.adProgressText}>
                {watchAdsToday}/{MAX_WATCH_ADS}
              </Text>
            </View>
          </View>
          {watchAdsToday < MAX_WATCH_ADS ? (
            <View style={styles.earnReward}>
              <Text style={styles.earnCoins}>+{EARN.WATCH_AD}</Text>
              <Text style={styles.earnCoinLabel}>🪙</Text>
            </View>
          ) : (
            <View style={styles.completeBadge}>
              <Ionicons name="checkmark-circle" size={18} color={C.accentGreen} />
              <Text style={styles.completeText}>完了</Text>
            </View>
          )}
        </TouchableOpacity>

      </View>

      {/* ─── コインの使い道 ───────────────────────────── */}
      <Text style={styles.sectionTitle}>コインの使い道</Text>
      <View style={styles.usageGrid}>
        <UsageCard icon="🖼️" label="アイコン再生成" cost={freeRegen > 0 ? `無料 残${freeRegen}回` : `🪙${COST.ICON_REGEN}`} color={C.primaryLight} styles={styles} />
        <UsageCard icon="💬" label="AI指示"         cost={freeChat > 0 ? `無料 残${freeChat}回` : `🪙${COST.CHAT_INSTRUCTION}/回`} color={C.accentBlue} styles={styles} />
        <UsageCard icon="📣" label="広告出稿"        cost={`🪙${COST.AD_POST}/件`} color={C.gold} styles={styles} />
      </View>

      {/* ─── 広告出稿 ────────────────────────────────── */}
      <Text style={styles.sectionTitle}>広告を出稿する</Text>
      <View style={styles.adPostCard}>
        <View style={styles.adPostHeader}>
          <Text style={styles.adPostIcon}>📣</Text>
          <View style={styles.adPostInfo}>
            <Text style={styles.adPostTitle}>スポンサー投稿を作成</Text>
            <Text style={styles.adPostDesc}>
              タイムラインに「広告」バッジ付きで表示。{'\n'}AIユーザーもリアクションします。
            </Text>
          </View>
        </View>
        <View style={styles.adCostRow}>
          <View style={styles.adCostBadge}>
            <Text style={styles.adCostText}>🪙 {COST.AD_POST}</Text>
          </View>
          <Text style={styles.adCoinsLeft}>残高 {coins} コイン</Text>
        </View>
        <TouchableOpacity
          style={[styles.adPostBtn, coins < COST.AD_POST && styles.btnDisabled]}
          onPress={() => setAdPostModal(true)}
          disabled={coins < COST.AD_POST}
        >
          <Ionicons name="megaphone" size={16} color="#fff" />
          <Text style={styles.adPostBtnText}>
            {coins < COST.AD_POST ? 'コイン不足' : '広告を作成する'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ─── コインパック ─────────────────────────────── */}
      <Text style={styles.sectionTitle}>コインを購入</Text>
      <Text style={styles.sectionSub}>決済はSSL暗号化で安全に処理されます</Text>
      {COIN_PACKS.map(pack => (
        <PackCard key={pack.id} pack={pack} onPress={() => handlePackPress(pack)} styles={styles} C={C} />
      ))}

      {/* ─── モーダル群 ──────────────────────────────── */}
      <AdWatchModal
        visible={adModalVisible}
        onClose={() => setAdModalVisible(false)}
        onEarned={() => setWatchAdsToday(w => w + 1)}
      />

      <PaymentModal
        visible={paymentVisible}
        pack={selectedPack}
        onClose={() => setPaymentVisible(false)}
        onSuccess={handlePaymentSuccess}
      />

      {/* 広告出稿モーダル */}
      <Modal visible={adPostModal} transparent animationType="slide" onRequestClose={() => setAdPostModal(false)}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.adModal}>
            <View style={styles.adModalHandle} />
            <View style={styles.adModalHeader}>
              <Text style={styles.adModalTitle}>📣 広告テキストを入力</Text>
              <TouchableOpacity onPress={() => { setAdPostModal(false); setAdContent(''); }}>
                <Ionicons name="close" size={24} color={C.textSub} />
              </TouchableOpacity>
            </View>
            <Text style={styles.adModalHint}>100文字以内で宣伝内容を書いてください。タイムラインに「スポンサー」バッジ付きで表示されます。</Text>
            <TextInput
              style={styles.adInput}
              placeholder="例：新作アプリをリリースしました！ #アプリ"
              placeholderTextColor={C.textMuted}
              value={adContent}
              onChangeText={setAdContent}
              multiline maxLength={100} autoFocus
            />
            <Text style={styles.charCount}>{adContent.length} / 100</Text>
            <View style={styles.adModalFooter}>
              <View>
                <Text style={styles.adCostLabel}>費用</Text>
                <Text style={styles.adCostValue}>🪙 {COST.AD_POST}</Text>
              </View>
              <TouchableOpacity
                style={[styles.submitBtn, (!adContent.trim() || adPosting || coins < COST.AD_POST) && styles.btnDisabled]}
                onPress={handleCreateAdPost}
                disabled={!adContent.trim() || adPosting || coins < COST.AD_POST}
              >
                <Text style={styles.submitBtnText}>{adPosting ? '処理中...' : '出稿する'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </ScrollView>
  );
}

// ─── 使い道カード ─────────────────────────────────────────
function UsageCard({ icon, label, cost, color, styles }: { icon: string; label: string; cost: string; color: string; styles: Styles }) {
  return (
    <View style={[styles.usageCard, { borderTopColor: color }]}>
      <Text style={styles.usageIcon}>{icon}</Text>
      <Text style={styles.usageLabel}>{label}</Text>
      <Text style={[styles.usageCost, { color }]}>{cost}</Text>
    </View>
  );
}

function createStyles(C: ThemeColors) {
  return StyleSheet.create({
    container     : { flex: 1, backgroundColor: C.bg },

    header        : { paddingTop: 54, paddingBottom: 16, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: C.border },
    headerTitle   : { fontSize: FONT_SIZE.xl, fontWeight: 'bold', color: C.text },
    headerSub     : { fontSize: FONT_SIZE.sm, color: C.textSub, marginTop: 2 },

    balanceBar    : { margin: 16, borderRadius: 18, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: C.isDark ? '#3a1a5a' : C.border },
    balanceLeft   : { gap: 3 },
    balanceLabel  : { fontSize: FONT_SIZE.xs, color: C.textSub },
    balanceCoins  : { fontSize: FONT_SIZE.xxl, fontWeight: 'bold', color: C.text },
    balanceRight  : { alignItems: 'flex-end', gap: 3 },
    balanceSub    : { fontSize: FONT_SIZE.xs, color: C.textMuted },
    balanceDesc   : { fontSize: FONT_SIZE.sm, color: C.textSub, fontWeight: '600' },

    sectionTitle  : { fontSize: FONT_SIZE.md, fontWeight: 'bold', color: C.textSub, paddingHorizontal: 16, marginTop: 20, marginBottom: 8 },
    sectionSub    : { fontSize: FONT_SIZE.xs, color: C.textMuted, paddingHorizontal: 16, marginBottom: 10, marginTop: -4 },

    card          : { marginHorizontal: 16, backgroundColor: C.bgCard, borderRadius: 18, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
    divider       : { height: 1, backgroundColor: C.border },
    earnRow       : { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 },
    disabled      : { opacity: 0.45 },
    earnIconWrap  : { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
    earnEmoji     : { fontSize: 22 },
    earnInfo      : { flex: 1 },
    earnLabel     : { color: C.text, fontWeight: '700', fontSize: FONT_SIZE.md },
    earnSub       : { color: C.textSub, fontSize: FONT_SIZE.xs, marginTop: 2 },
    earnReward    : { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
    earnCoins     : { color: C.gold, fontWeight: 'bold', fontSize: FONT_SIZE.lg },
    earnCoinLabel : { fontSize: FONT_SIZE.md },

    adProgressRow : { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
    adDot         : { width: 8, height: 8, borderRadius: 4, backgroundColor: C.bgInput, borderWidth: 1, borderColor: C.border },
    adDotFilled   : { backgroundColor: C.gold, borderColor: C.gold },
    adProgressText: { fontSize: FONT_SIZE.xs, color: C.textMuted, marginLeft: 4 },
    completeBadge : { flexDirection: 'row', alignItems: 'center', gap: 4 },
    completeText  : { fontSize: FONT_SIZE.xs, color: C.accentGreen, fontWeight: '600' },

    usageGrid     : { flexDirection: 'row', marginHorizontal: 16, gap: 10 },
    usageCard     : { flex: 1, backgroundColor: C.bgCard, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: C.border, borderTopWidth: 3, alignItems: 'center', gap: 4 },
    usageIcon     : { fontSize: 24 },
    usageLabel    : { fontSize: FONT_SIZE.xs, color: C.textSub, textAlign: 'center', fontWeight: '600' },
    usageCost     : { fontSize: FONT_SIZE.xs, fontWeight: 'bold', textAlign: 'center' },

    adPostCard    : { marginHorizontal: 16, backgroundColor: C.adBg, borderRadius: 18, borderWidth: 1, borderColor: C.adBorder, padding: 16 },
    adPostHeader  : { flexDirection: 'row', gap: 12, marginBottom: 12 },
    adPostIcon    : { fontSize: 36 },
    adPostInfo    : { flex: 1 },
    adPostTitle   : { fontSize: FONT_SIZE.md, fontWeight: 'bold', color: C.text, marginBottom: 4 },
    adPostDesc    : { fontSize: FONT_SIZE.xs, color: C.textSub, lineHeight: 18 },
    adCostRow     : { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
    adCostBadge   : { backgroundColor: C.isDark ? '#2a1800' : '#fffbe6', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: C.adBorder },
    adCostText    : { color: C.gold, fontWeight: 'bold', fontSize: FONT_SIZE.sm },
    adCoinsLeft   : { fontSize: FONT_SIZE.xs, color: C.textSub },
    adPostBtn     : { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.primary, borderRadius: 12, paddingVertical: 12 },
    adPostBtnText : { color: '#fff', fontWeight: 'bold', fontSize: FONT_SIZE.md },

    packCard         : { marginHorizontal: 16, marginBottom: 12, backgroundColor: C.bgCard, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: C.border, position: 'relative', overflow: 'hidden' },
    packCardPopular  : { borderColor: C.primary },
    packCardPremium  : { borderColor: C.gold },
    packBadge        : { position: 'absolute', top: 12, right: 12, backgroundColor: C.primary, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
    packBadgePremium : { backgroundColor: '#7a5500' },
    packBadgeText    : { color: '#fff', fontSize: FONT_SIZE.xs, fontWeight: 'bold' },
    packTop          : { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10 },
    packCoinArea     : { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
    packCoinEmoji    : { fontSize: 24 },
    packCoins        : { fontSize: FONT_SIZE.xxl, fontWeight: 'bold', color: C.text },
    packBonus        : { backgroundColor: C.isDark ? '#0a2a0a' : '#e8fff0', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: C.accentGreen },
    packBonusText    : { fontSize: 10, color: C.accentGreen, fontWeight: 'bold' },
    packPriceArea    : { alignItems: 'flex-end' },
    packPrice        : { fontSize: FONT_SIZE.xl, fontWeight: 'bold', color: C.text },
    packPriceNote    : { fontSize: 10, color: C.textMuted, marginTop: 2 },
    packLabel        : { fontSize: FONT_SIZE.sm, color: C.textSub, marginBottom: 12 },
    packBtn          : { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, paddingVertical: 12 },
    packBtnText      : { color: '#fff', fontWeight: 'bold', fontSize: FONT_SIZE.md },

    btnDisabled   : { backgroundColor: C.textMuted },

    modalOverlay  : { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
    adModal       : { backgroundColor: C.bgCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
    adModalHandle : { width: 44, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: 'center', marginBottom: 16 },
    adModalHeader : { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    adModalTitle  : { fontSize: FONT_SIZE.lg, fontWeight: 'bold', color: C.text },
    adModalHint   : { fontSize: FONT_SIZE.xs, color: C.textSub, marginBottom: 12, lineHeight: 18 },
    adInput       : { backgroundColor: C.bgInput, borderRadius: 14, padding: 14, color: C.text, fontSize: FONT_SIZE.md, minHeight: 90, borderWidth: 1, borderColor: C.border, textAlignVertical: 'top' },
    charCount     : { textAlign: 'right', fontSize: FONT_SIZE.xs, color: C.textMuted, marginTop: 4, marginBottom: 14 },
    adModalFooter : { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
    adCostLabel   : { fontSize: FONT_SIZE.xs, color: C.textSub },
    adCostValue   : { fontSize: FONT_SIZE.md, color: C.gold, fontWeight: 'bold' },
    submitBtn     : { backgroundColor: C.primary, borderRadius: 12, paddingHorizontal: 28, paddingVertical: 12 },
    submitBtnText : { color: '#fff', fontWeight: 'bold', fontSize: FONT_SIZE.md },
  });
}
