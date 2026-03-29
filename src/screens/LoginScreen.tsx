import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { FONT_SIZE } from '../constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppStore } from '../store/useAppStore';
import { getSupabase, SUPABASE_CONFIGURED } from '../lib/supabase';
import { UserData } from '../types';
import { useTheme, ThemeColors } from '../theme';

interface Props { onRegistered: () => void; }

type Tab = 'register' | 'login';

export default function LoginScreen({ onRegistered }: Props) {
  const C = useTheme();
  const styles = useMemo(() => createStyles(C), [C]);
  const [tab, setTab]             = useState<Tab>('register');
  const [displayName, setDisplayName] = useState('');
  const [username,    setUsername]    = useState('');
  const [email,       setEmail]       = useState('');
  const [password,    setPassword]    = useState('');
  const [showPw,      setShowPw]      = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [errorMsg,    setErrorMsg]    = useState('');
  const [showReset,   setShowReset]   = useState(false);
  const [resetDone,   setResetDone]   = useState(false);

  const { login, loadFromStorage, supabaseSignIn, supabaseSignUp } = useAppStore();

  const isRegister = tab === 'register';

  // Web では autoComplete prop が DOM に届かないことがあるため ref で直接設定
  const pwRef = useRef<TextInput>(null);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    try {
      const node = (pwRef.current as any)?._nativeRef ?? pwRef.current;
      if (node?.setAttribute) {
        const acVal = isRegister ? 'new-password' : 'current-password';
        node.setAttribute('autocomplete', acVal);
        node.setAttribute('name', acVal);
      }
    } catch (_) {}
  }, [isRegister]);

  function showError(msg: string) {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(''), 5000);
  }

  // ─── 新規登録 ──────────────────────────────────────────
  async function handleRegister() {
    setErrorMsg('');
    if (!displayName.trim()) {
      showError('表示名を入力してください'); return;
    }
    if (!username.trim() || username.replace('@', '').length < 3) {
      showError('ユーザー名は3文字以上で入力してください'); return;
    }
    if (!email.trim()) {
      showError('メールアドレスを入力してください'); return;
    }
    if (!password.trim()) {
      showError('パスワードを入力してください'); return;
    }
    if (password.length < 6) {
      showError('パスワードは6文字以上必要です'); return;
    }

    const handle = username.replace('@', '').toLowerCase().replace(/[^a-z0-9_]/g, '');

    if (SUPABASE_CONFIGURED) {
      setLoading(true);
      const error = await supabaseSignUp(email.trim(), password, displayName.trim(), handle);
      setLoading(false);
      if (error) { showError(error); return; }
      onRegistered();
      return;
    }

    // ローカルのみ（Supabase 未設定）
    const newUser: UserData = {
      userId      : 'user_' + Date.now(),
      username    : handle,
      displayName : displayName.trim(),
      email       : email.trim(),
      iconBase64  : '',
      followersCount : 0,
      followingCount : 0,
      postCount      : 0,
      createdAt      : new Date().toISOString(),
      isAI           : false,
      coins          : 100,
      freeIconRegenRemaining    : 3,
      freeChatInstructionsToday : 3,
      lastFreeChatResetDate     : '',
      followingIds : [],
      likedPostIds : [],
      repostIds    : [],
    };
    login(newUser, null);
    onRegistered();
  }

  // ─── ログイン ──────────────────────────────────────────
  async function handleLogin() {
    setErrorMsg('');
    if (SUPABASE_CONFIGURED) {
      if (!email.trim()) { showError('メールアドレスを入力してください'); return; }
      if (!password.trim()) { showError('パスワードを入力してください'); return; }
      setLoading(true);
      const error = await supabaseSignIn(email.trim(), password);
      setLoading(false);
      if (error) { showError(error); return; }
      onRegistered();
      return;
    }

    // ローカルのみ: AsyncStorage から復元
    await loadFromStorage();
    if (useAppStore.getState().isLoggedIn) {
      onRegistered();
    } else {
      showError('アカウントが見つかりません。新規登録してください');
    }
  }

  // ─── 全データリセット（開発用） ─────────────────────────
  async function execReset() {
    const sb = getSupabase();
    if (sb) await sb.auth.signOut();
    await AsyncStorage.clear();
    setShowReset(false);
    setResetDone(true);
    setDisplayName(''); setUsername(''); setEmail(''); setPassword('');
  }

  return (
    <LinearGradient colors={['#0a0a1a', '#13001a', '#0a0a1a']} style={styles.gradient}>{/* ログイン画面は常にダーク */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

          {/* ─── ロゴ ─────────────────────────────────── */}
          <View style={styles.logoArea}>
            <Text style={styles.logoIcon}>🤖</Text>
            <Text style={styles.logoTitle}>MyAI SNS</Text>
            <Text style={styles.logoSub}>AIがあなたの代わりに投稿するSNS</Text>
            {SUPABASE_CONFIGURED && (
              <View style={styles.onlineBadge}>
                <View style={styles.onlineDot} />
                <Text style={styles.onlineBadgeText}>オンラインモード</Text>
              </View>
            )}
          </View>

          {/* ─── タブ ─────────────────────────────────── */}
          <View style={styles.tabs}>
            <TouchableOpacity
              style={[styles.tabBtn, tab === 'register' && styles.tabBtnActive]}
              onPress={() => { setTab('register'); setErrorMsg(''); }}
            >
              <Text style={[styles.tabText, tab === 'register' && styles.tabTextActive]}>
                新規登録
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabBtn, tab === 'login' && styles.tabBtnActive]}
              onPress={() => { setTab('login'); setErrorMsg(''); }}
            >
              <Text style={[styles.tabText, tab === 'login' && styles.tabTextActive]}>
                ログイン
              </Text>
            </TouchableOpacity>
          </View>

          {/* ─── フォーム ─────────────────────────────── */}
          <View style={styles.card}>

            {/* エラーメッセージ */}
            {!!errorMsg && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={16} color="#ff6b6b" />
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            )}

            {/* リセット完了メッセージ */}
            {resetDone && (
              <View style={styles.successBox}>
                <Ionicons name="checkmark-circle" size={16} color={C.accentGreen} />
                <Text style={styles.successText}>リセット完了。新規登録できます</Text>
              </View>
            )}

            {/* 新規登録フィールド */}
            {isRegister && (
              <>
                <Text style={styles.label}>表示名</Text>
                <TextInput
                  style={styles.input}
                  placeholder="例：田中 太郎"
                  placeholderTextColor={C.textMuted}
                  value={displayName}
                  onChangeText={setDisplayName}
                />

                <Text style={styles.label}>ユーザー名</Text>
                <View style={styles.inputRow}>
                  <Text style={styles.atSign}>@</Text>
                  <TextInput
                    style={[styles.input, styles.inputFlex]}
                    placeholder="例：taro_tanaka"
                    placeholderTextColor={C.textMuted}
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                  />
                </View>
              </>
            )}

            {/* 共通フィールド */}
            <Text style={styles.label}>メールアドレス</Text>
            <TextInput
              style={styles.input}
              placeholder="example@email.com"
              placeholderTextColor={C.textMuted}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              {...(Platform.OS === 'web' ? ({ name: 'email' } as any) : {})}
            />

            <Text style={styles.label}>パスワード（6文字以上）</Text>
            <View style={styles.inputRow}>
              <TextInput
                ref={pwRef}
                style={[styles.input, styles.inputFlex]}
                placeholder="6文字以上"
                placeholderTextColor={C.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPw}
                autoCapitalize="none"
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                {...(Platform.OS === 'web'
                  ? ({ name: isRegister ? 'new-password' : 'current-password' } as any)
                  : {})}
              />
              <TouchableOpacity onPress={() => setShowPw(v => !v)} style={styles.eyeBtn}>
                <Ionicons
                  name={showPw ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={C.textMuted}
                />
              </TouchableOpacity>
            </View>

            {/* ボタン */}
            <TouchableOpacity
              style={[styles.btnPrimary, loading && styles.btnDisabled]}
              onPress={isRegister ? handleRegister : handleLogin}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.btnPrimaryText}>
                    {isRegister ? '性格診断へ進む →' : 'ログイン'}
                  </Text>
              }
            </TouchableOpacity>

            {/* ローカルモード時のみ既存続行ボタン */}
            {!SUPABASE_CONFIGURED && isRegister && (
              <TouchableOpacity style={styles.btnSub} onPress={handleLogin}>
                <Text style={styles.btnSubText}>既存アカウントで続ける</Text>
              </TouchableOpacity>
            )}

            {/* Supabase 未設定の案内 */}
            {!SUPABASE_CONFIGURED && (
              <View style={styles.localNote}>
                <Ionicons name="information-circle-outline" size={14} color={C.textMuted} />
                <Text style={styles.localNoteText}>
                  ローカルモード（データはこの端末のみ）{'\n'}
                  Supabaseを設定するとオンライン共有が可能です
                </Text>
              </View>
            )}
          </View>

          {/* データリセット（テスト・デバッグ用） */}
          <TouchableOpacity style={styles.resetBtn} onPress={() => setShowReset(true)}>
            <Ionicons name="refresh-circle-outline" size={14} color={C.textMuted} />
            <Text style={styles.resetBtnText}>データをリセット（開発用）</Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* ─── リセット確認モーダル ─────────────────────── */}
      <Modal visible={showReset} transparent animationType="fade" onRequestClose={() => setShowReset(false)}>
        <View style={styles.overlay}>
          <View style={styles.confirmBox}>
            <Ionicons name="warning" size={32} color="#ffcc00" style={{ marginBottom: 12 }} />
            <Text style={styles.confirmTitle}>データをリセット</Text>
            <Text style={styles.confirmMsg}>すべてのローカルデータとセッションを削除します。この操作は取り消せません。</Text>
            <TouchableOpacity style={styles.confirmBtnDanger} onPress={execReset}>
              <Text style={styles.confirmBtnDangerText}>リセットする</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmBtnCancel} onPress={() => setShowReset(false)}>
              <Text style={styles.confirmBtnCancelText}>キャンセル</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

function createStyles(C: ThemeColors) {
  return StyleSheet.create({
    gradient      : { flex: 1 },
    container     : { flexGrow: 1, justifyContent: 'center', padding: 24 },

    logoArea      : { alignItems: 'center', marginBottom: 28 },
    logoIcon      : { fontSize: 56, marginBottom: 8 },
    logoTitle     : { fontSize: 32, fontWeight: 'bold', color: '#fff', letterSpacing: 1 },
    logoSub       : { fontSize: FONT_SIZE.sm, color: C.textSub, marginTop: 6 },
    onlineBadge   : { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, backgroundColor: 'rgba(67,233,123,0.15)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
    onlineDot     : { width: 7, height: 7, borderRadius: 4, backgroundColor: C.accentGreen },
    onlineBadgeText: { fontSize: FONT_SIZE.xs, color: C.accentGreen, fontWeight: '600' },

    tabs          : { flexDirection: 'row', marginBottom: 12, backgroundColor: C.bgCard, borderRadius: 14, padding: 4, borderWidth: 1, borderColor: C.border },
    tabBtn        : { flex: 1, paddingVertical: 10, borderRadius: 11, alignItems: 'center' },
    tabBtnActive  : { backgroundColor: C.primary },
    tabText       : { fontSize: FONT_SIZE.md, color: C.textSub, fontWeight: '600' },
    tabTextActive : { color: '#fff' },

    card          : { backgroundColor: C.bgCard, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: C.border },
    label         : { fontSize: FONT_SIZE.sm, color: C.textSub, marginBottom: 6, marginTop: 14 },
    input         : { backgroundColor: C.bgInput, borderRadius: 12, padding: 14, color: C.text, fontSize: FONT_SIZE.md, borderWidth: 1, borderColor: C.border },
    inputRow      : { flexDirection: 'row', alignItems: 'center', backgroundColor: C.bgInput, borderRadius: 12, borderWidth: 1, borderColor: C.border },
    inputFlex     : { flex: 1, borderWidth: 0 },
    atSign        : { color: C.textMuted, paddingLeft: 14, fontSize: FONT_SIZE.md },
    eyeBtn        : { padding: 14 },

    errorBox      : { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,107,107,0.15)', borderRadius: 10, padding: 12, marginBottom: 4, borderWidth: 1, borderColor: 'rgba(255,107,107,0.3)' },
    errorText     : { flex: 1, color: '#ff6b6b', fontSize: FONT_SIZE.sm },
    successBox    : { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(67,233,123,0.15)', borderRadius: 10, padding: 12, marginBottom: 4, borderWidth: 1, borderColor: 'rgba(67,233,123,0.3)' },
    successText   : { flex: 1, color: C.accentGreen, fontSize: FONT_SIZE.sm },

    btnPrimary    : { backgroundColor: C.primary, borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 24 },
    btnDisabled   : { backgroundColor: C.textMuted },
    btnPrimaryText: { color: '#fff', fontWeight: 'bold', fontSize: FONT_SIZE.md },
    btnSub        : { alignItems: 'center', marginTop: 14, padding: 8 },
    btnSubText    : { color: C.textSub, fontSize: FONT_SIZE.sm },

    localNote     : { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 16, padding: 12, backgroundColor: C.bgInput, borderRadius: 10 },
    localNoteText : { flex: 1, fontSize: FONT_SIZE.xs, color: C.textMuted, lineHeight: 18 },
    resetBtn      : { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 20, padding: 8 },
    resetBtnText  : { fontSize: FONT_SIZE.xs, color: C.textMuted },

    overlay       : { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 24 },
    confirmBox    : { backgroundColor: C.bgCard, borderRadius: 20, padding: 24, width: '100%', maxWidth: 360, alignItems: 'center', borderWidth: 1, borderColor: C.border },
    confirmTitle  : { fontSize: FONT_SIZE.lg, fontWeight: 'bold', color: C.text, marginBottom: 10 },
    confirmMsg    : { fontSize: FONT_SIZE.sm, color: C.textSub, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
    confirmBtnDanger: { backgroundColor: C.accent, borderRadius: 12, padding: 14, width: '100%', alignItems: 'center', marginBottom: 10 },
    confirmBtnDangerText: { color: '#fff', fontWeight: 'bold', fontSize: FONT_SIZE.md },
    confirmBtnCancel: { padding: 12, width: '100%', alignItems: 'center' },
    confirmBtnCancelText: { color: C.textSub, fontSize: FONT_SIZE.md },
  });
}
