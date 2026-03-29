import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Modal, ActivityIndicator, KeyboardAvoidingView, Platform,
  Animated, ScrollView, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONT_SIZE } from '../constants';
import {
  CoinPack, CardBrand,
  detectCardBrand, formatCardNumber, formatExpiry,
  validateCard, processPayment, CARD_BRAND_EMOJI,
} from '../services/stripeService';
import { useAppStore } from '../store/useAppStore';
import { isStripeCheckoutEnabled, openStripeCheckout } from '../services/revenueStripe';

interface Props {
  visible : boolean;
  pack    : CoinPack | null;
  onClose : () => void;
  onSuccess: (pack: CoinPack) => void;
}

type Phase = 'form' | 'processing' | 'success' | 'error';

// ─── ブランドアイコン ──────────────────────────────────────
function BrandBadge({ brand }: { brand: CardBrand }) {
  const colors: Record<CardBrand, [string, string]> = {
    visa       : ['#1a1f71', '#1a1f71'],
    mastercard : ['#eb001b', '#f79e1b'],
    amex       : ['#007bc1', '#007bc1'],
    jcb        : ['#003087', '#009f6b'],
    unknown    : [COLORS.bgInput, COLORS.bgInput],
  };
  const [c1, c2] = colors[brand];
  return (
    <LinearGradient
      colors={[c1, c2]}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
      style={brandStyles.badge}
    >
      <Text style={brandStyles.text}>{CARD_BRAND_EMOJI[brand]}</Text>
    </LinearGradient>
  );
}
const brandStyles = StyleSheet.create({
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, minWidth: 60, alignItems: 'center' },
  text : { color: '#fff', fontSize: FONT_SIZE.xs, fontWeight: 'bold' },
});

// ─── フォームフィールド ────────────────────────────────────
function Field({
  label, value, onChangeText, placeholder, maxLength,
  keyboardType, autoCapitalize, error, rightElement,
}: {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder: string; maxLength?: number;
  keyboardType?: 'default' | 'numeric' | 'email-address';
  autoCapitalize?: 'none' | 'words' | 'characters';
  error?: boolean; rightElement?: React.ReactNode;
}) {
  return (
    <View style={fieldStyles.wrap}>
      <Text style={fieldStyles.label}>{label}</Text>
      <View style={[fieldStyles.inputRow, error && fieldStyles.inputRowError]}>
        <TextInput
          style={fieldStyles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={COLORS.textMuted}
          maxLength={maxLength}
          keyboardType={keyboardType ?? 'default'}
          autoCapitalize={autoCapitalize ?? 'none'}
        />
        {rightElement}
      </View>
      {error && <Text style={fieldStyles.errorText}>入力内容を確認してください</Text>}
    </View>
  );
}
const fieldStyles = StyleSheet.create({
  wrap         : { marginBottom: 14 },
  label        : { fontSize: FONT_SIZE.xs, color: COLORS.textSub, fontWeight: '600', marginBottom: 6, letterSpacing: 0.3 },
  inputRow     : { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.bgInput, borderRadius: 12, borderWidth: 1.5, borderColor: COLORS.border, paddingHorizontal: 14, paddingVertical: 10 },
  inputRowError: { borderColor: COLORS.accent },
  input        : { flex: 1, color: COLORS.text, fontSize: FONT_SIZE.md },
  errorText    : { fontSize: FONT_SIZE.xs, color: COLORS.accent, marginTop: 4 },
});

// ─── メインコンポーネント ────────────────────────────────
export default function PaymentModal({ visible, pack, onClose, onSuccess }: Props) {
  const { earnCoins } = useAppStore();

  const [phase, setPhase]     = useState<Phase>('form');
  const [cardNum, setCardNum] = useState('');
  const [expiry, setExpiry]   = useState('');
  const [cvc, setCvc]         = useState('');
  const [name, setName]       = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const [errorMsg, setErrorMsg]     = useState('');
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const stripeCheckoutOn = isStripeCheckoutEnabled();

  const checkAnim  = useRef(new Animated.Value(0)).current;
  const successScale = useRef(new Animated.Value(0)).current;

  // モーダルを開くたびにリセット
  useEffect(() => {
    if (visible) {
      setPhase('form');
      setCardNum(''); setExpiry(''); setCvc(''); setName('');
      setShowErrors(false); setErrorMsg('');
      setCheckoutBusy(false);
      checkAnim.setValue(0); successScale.setValue(0);
    }
  }, [visible]);

  useEffect(() => {
    if (phase === 'success') {
      Animated.spring(successScale, {
        toValue: 1, useNativeDriver: true, tension: 60, friction: 6,
      }).start();
    }
  }, [phase]);

  const brand  = detectCardBrand(cardNum);
  const valid  = validateCard(cardNum, expiry, cvc, name);
  const allOk  = valid.numberOk && valid.expiryOk && valid.cvcOk && valid.nameOk;
  const totalCoins = pack ? pack.coins + (pack.bonus ?? 0) : 0;

  async function handleStripeCheckout() {
    if (!pack) return;
    setCheckoutBusy(true);
    const r = await openStripeCheckout(pack);
    setCheckoutBusy(false);
    if (!r.ok) {
      Alert.alert('Checkout を開けませんでした', r.error ?? '不明なエラー');
      return;
    }
    if (Platform.OS !== 'web') {
      Alert.alert(
        '決済ページを開きました',
        'ブラウザで支払いが完了したらアプリに戻ると、コインが付与されます。',
      );
    }
  }

  async function handlePay() {
    if (!pack) return;
    setShowErrors(true);
    if (!allOk) return;

    setPhase('processing');
    const result = await processPayment(pack, cardNum, expiry, cvc, name);

    if (result.status === 'success') {
      earnCoins(totalCoins);
      setPhase('success');
    } else {
      setErrorMsg(result.message);
      setPhase('error');
    }
  }

  function handleSuccess() {
    if (pack) onSuccess(pack);
    onClose();
  }

  if (!pack) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>

          {/* ─── ヘッダー ────────────────────────────────── */}
          <View style={styles.handle} />
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>お支払い</Text>
              {stripeCheckoutOn ? (
                <View style={styles.prodBadge}>
                  <Ionicons name="card" size={11} color={COLORS.accentGreen} />
                  <Text style={styles.prodBadgeText}>Stripe Checkout</Text>
                </View>
              ) : (
                <View style={styles.testBadge}>
                  <Ionicons name="flask" size={11} color={COLORS.gold} />
                  <Text style={styles.testBadgeText}>テストモード</Text>
                </View>
              )}
            </View>
            {phase === 'form' && (
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color={COLORS.textSub} />
              </TouchableOpacity>
            )}
          </View>

          {/* ─── 商品サマリー ────────────────────────────── */}
          <LinearGradient colors={['#1a0a3a', '#0a0a1a']} style={styles.summary}>
            <View style={styles.summaryLeft}>
              <Text style={styles.summaryLabel}>{pack.label}</Text>
              <Text style={styles.summaryCoins}>🪙 {totalCoins.toLocaleString()} コイン</Text>
              {pack.bonus && pack.bonus > 0 ? (
                <Text style={styles.bonusText}>+{pack.bonus} ボーナスコイン含む</Text>
              ) : null}
            </View>
            <Text style={styles.summaryPrice}>¥{pack.priceJpy.toLocaleString()}</Text>
          </LinearGradient>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 30 }}
          >

            {/* ─── フォーム ─────────────────────────────── */}
            {phase === 'form' && (
              <View style={styles.form}>

                {stripeCheckoutOn ? (
                  <View style={styles.checkoutBlock}>
                    <TouchableOpacity
                      style={[styles.checkoutBtn, checkoutBusy && styles.checkoutBtnDisabled]}
                      onPress={handleStripeCheckout}
                      disabled={checkoutBusy}
                    >
                      {checkoutBusy ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="open-outline" size={18} color="#fff" />
                          <Text style={styles.checkoutBtnText}>
                            Stripe Checkout で ¥{pack.priceJpy.toLocaleString()} を支払う
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                    <Text style={styles.checkoutHint}>
                      本番用の決済ページです。Stripe の Price ID（price_xxx）を COIN_PACKS と一致させてください。
                    </Text>
                    <View style={styles.dividerWrap}>
                      <View style={styles.dividerLine} />
                      <Text style={styles.dividerText}>または 開発用モック</Text>
                      <View style={styles.dividerLine} />
                    </View>
                  </View>
                ) : null}

                {/* カード番号 */}
                <View style={fieldStyles.wrap}>
                  <Text style={fieldStyles.label}>カード番号</Text>
                  <View style={[
                    fieldStyles.inputRow,
                    showErrors && !valid.numberOk && fieldStyles.inputRowError,
                  ]}>
                    <TextInput
                      style={[fieldStyles.input, { letterSpacing: 2 }]}
                      value={cardNum}
                      onChangeText={v => setCardNum(formatCardNumber(v))}
                      placeholder="1234 5678 9012 3456"
                      placeholderTextColor={COLORS.textMuted}
                      maxLength={19}
                      keyboardType="numeric"
                    />
                    <BrandBadge brand={brand} />
                  </View>
                  {showErrors && !valid.numberOk && (
                    <Text style={fieldStyles.errorText}>有効なカード番号を入力してください</Text>
                  )}
                </View>

                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Field
                      label="有効期限"
                      value={expiry}
                      onChangeText={v => setExpiry(formatExpiry(v))}
                      placeholder="MM/YY"
                      maxLength={5}
                      keyboardType="numeric"
                      error={showErrors && !valid.expiryOk}
                    />
                  </View>
                  <View style={{ width: 12 }} />
                  <View style={{ flex: 1 }}>
                    <Field
                      label="セキュリティコード"
                      value={cvc}
                      onChangeText={v => setCvc(v.replace(/\D/g, '').slice(0, 4))}
                      placeholder="CVC"
                      maxLength={4}
                      keyboardType="numeric"
                      error={showErrors && !valid.cvcOk}
                    />
                  </View>
                </View>

                <Field
                  label="カード名義（ローマ字）"
                  value={name}
                  onChangeText={setName}
                  placeholder="TARO YAMADA"
                  autoCapitalize="characters"
                  error={showErrors && !valid.nameOk}
                />

                <TouchableOpacity style={styles.payBtn} onPress={handlePay}>
                  <Ionicons name="lock-closed" size={16} color="#fff" />
                  <Text style={styles.payBtnText}>
                    {stripeCheckoutOn
                      ? `（開発）モックで ¥${pack.priceJpy.toLocaleString()} を支払う`
                      : `¥${pack.priceJpy.toLocaleString()} を安全に支払う`}
                  </Text>
                </TouchableOpacity>

                <View style={styles.stripeRow}>
                  <Ionicons name="shield-checkmark" size={14} color={COLORS.textMuted} />
                  <Text style={styles.stripeText}>
                    {stripeCheckoutOn
                      ? '下はローカルモック • 本番は Checkout を利用'
                      : 'Powered by Stripe • 256bit SSL'}
                  </Text>
                </View>

                {!stripeCheckoutOn ? (
                  <View style={styles.testCardNote}>
                    <Text style={styles.testCardNoteTitle}>🧪 テストカード</Text>
                    <Text style={styles.testCardNoteText}>
                      カード番号: 4242 4242 4242 4242{'\n'}
                      有効期限: 任意の未来の日付　CVC: 任意3桁
                    </Text>
                  </View>
                ) : null}
              </View>
            )}

            {/* ─── 処理中 ───────────────────────────────── */}
            {phase === 'processing' && (
              <View style={styles.centerPhase}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.processingText}>決済処理中...</Text>
                <Text style={styles.processingSubText}>しばらくお待ちください</Text>
              </View>
            )}

            {/* ─── 成功 ─────────────────────────────────── */}
            {phase === 'success' && (
              <View style={styles.centerPhase}>
                <Animated.View style={[styles.successCircle, { transform: [{ scale: successScale }] }]}>
                  <Ionicons name="checkmark" size={44} color="#fff" />
                </Animated.View>
                <Text style={styles.successTitle}>支払い完了！</Text>
                <Text style={styles.successSub}>
                  🪙 {totalCoins.toLocaleString()} コインが追加されました
                </Text>
                {pack.bonus && pack.bonus > 0 ? (
                  <View style={styles.bonusBadge}>
                    <Text style={styles.bonusBadgeText}>🎉 ボーナス +{pack.bonus} コイン！</Text>
                  </View>
                ) : null}
                <TouchableOpacity style={styles.doneBtn} onPress={handleSuccess}>
                  <Text style={styles.doneBtnText}>ショップに戻る</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ─── エラー ───────────────────────────────── */}
            {phase === 'error' && (
              <View style={styles.centerPhase}>
                <View style={styles.errorCircle}>
                  <Ionicons name="close" size={44} color="#fff" />
                </View>
                <Text style={styles.errorTitle}>決済に失敗しました</Text>
                <Text style={styles.errorSub}>{errorMsg}</Text>
                <TouchableOpacity
                  style={styles.retryBtn}
                  onPress={() => setPhase('form')}
                >
                  <Ionicons name="refresh" size={16} color="#fff" />
                  <Text style={styles.retryBtnText}>もう一度試す</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelLink} onPress={onClose}>
                  <Text style={styles.cancelLinkText}>キャンセル</Text>
                </TouchableOpacity>
              </View>
            )}

          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay       : { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet         : { backgroundColor: COLORS.bgCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '92%', borderWidth: 1, borderColor: COLORS.border },
  handle        : { width: 44, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: 'center', marginTop: 10, marginBottom: 6 },

  header        : { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 20, paddingBottom: 12 },
  headerTitle   : { fontSize: FONT_SIZE.lg, fontWeight: 'bold', color: COLORS.text },
  testBadge     : { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  testBadgeText : { fontSize: FONT_SIZE.xs, color: COLORS.gold, fontWeight: '600' },
  prodBadge     : { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  prodBadgeText : { fontSize: FONT_SIZE.xs, color: COLORS.accentGreen, fontWeight: '600' },
  closeBtn      : { padding: 4 },

  checkoutBlock   : { marginBottom: 16 },
  checkoutBtn     : { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.accentGreen, borderRadius: 16, paddingVertical: 16 },
  checkoutBtnDisabled: { opacity: 0.7 },
  checkoutBtnText : { color: '#0a1f12', fontWeight: 'bold', fontSize: FONT_SIZE.md },
  checkoutHint    : { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 10, lineHeight: 16 },
  dividerWrap     : { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18, marginBottom: 4 },
  dividerLine     : { flex: 1, height: 1, backgroundColor: COLORS.border },
  dividerText     : { fontSize: FONT_SIZE.xs, color: COLORS.textSub },

  summary       : { marginHorizontal: 16, marginBottom: 20, borderRadius: 16, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#3a1a5a' },
  summaryLeft   : { gap: 3 },
  summaryLabel  : { fontSize: FONT_SIZE.sm, color: COLORS.textSub },
  summaryCoins  : { fontSize: FONT_SIZE.xl, fontWeight: 'bold', color: COLORS.text },
  bonusText     : { fontSize: FONT_SIZE.xs, color: COLORS.accentGreen },
  summaryPrice  : { fontSize: FONT_SIZE.xxl, fontWeight: 'bold', color: COLORS.primary },

  form          : { paddingHorizontal: 20 },
  row           : { flexDirection: 'row' },

  payBtn        : { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.primary, borderRadius: 16, paddingVertical: 16, marginTop: 4 },
  payBtnText    : { color: '#fff', fontWeight: 'bold', fontSize: FONT_SIZE.md },

  stripeRow     : { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 12 },
  stripeText    : { fontSize: FONT_SIZE.xs, color: COLORS.textMuted },

  testCardNote     : { marginTop: 16, padding: 14, backgroundColor: '#0f0a00', borderRadius: 12, borderWidth: 1, borderColor: '#3a2a00', borderStyle: 'dashed' },
  testCardNoteTitle: { fontSize: FONT_SIZE.sm, color: COLORS.gold, fontWeight: '700', marginBottom: 4 },
  testCardNoteText : { fontSize: FONT_SIZE.xs, color: COLORS.textSub, lineHeight: 18 },

  // 処理中
  centerPhase   : { paddingVertical: 40, paddingHorizontal: 24, alignItems: 'center', gap: 12 },
  processingText: { fontSize: FONT_SIZE.lg, fontWeight: 'bold', color: COLORS.text, marginTop: 8 },
  processingSubText: { fontSize: FONT_SIZE.sm, color: COLORS.textSub },

  // 成功
  successCircle : { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.accentGreen, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  successTitle  : { fontSize: FONT_SIZE.xl, fontWeight: 'bold', color: COLORS.text },
  successSub    : { fontSize: FONT_SIZE.md, color: COLORS.textSub, textAlign: 'center' },
  bonusBadge    : { backgroundColor: '#0a2a0a', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1, borderColor: COLORS.accentGreen },
  bonusBadgeText: { color: COLORS.accentGreen, fontWeight: 'bold', fontSize: FONT_SIZE.sm },
  doneBtn       : { backgroundColor: COLORS.primary, borderRadius: 14, paddingHorizontal: 32, paddingVertical: 13, marginTop: 8 },
  doneBtnText   : { color: '#fff', fontWeight: 'bold', fontSize: FONT_SIZE.md },

  // エラー
  errorCircle   : { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.accent, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  errorTitle    : { fontSize: FONT_SIZE.xl, fontWeight: 'bold', color: COLORS.text },
  errorSub      : { fontSize: FONT_SIZE.sm, color: COLORS.textSub, textAlign: 'center', lineHeight: 20 },
  retryBtn      : { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.primary, borderRadius: 14, paddingHorizontal: 28, paddingVertical: 12, marginTop: 8 },
  retryBtnText  : { color: '#fff', fontWeight: 'bold', fontSize: FONT_SIZE.md },
  cancelLink    : { paddingVertical: 10 },
  cancelLinkText: { fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
});
