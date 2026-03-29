import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, StatusBar, Platform, Alert } from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from './src/store/useAppStore';
import { FONT_SIZE } from './src/constants';
import { SUPABASE_CONFIGURED } from './src/lib/supabase';
import { ThemeContext, getColors } from './src/theme';
import LoginScreen            from './src/screens/LoginScreen';
import QuizScreen             from './src/screens/QuizScreen';
import FollowSuggestScreen    from './src/screens/FollowSuggestScreen';
import HomeScreen             from './src/screens/HomeScreen';
import ChatScreen             from './src/screens/ChatScreen';
import ShopScreen             from './src/screens/ShopScreen';
import ProfileScreen          from './src/screens/ProfileScreen';
import NotificationScreen     from './src/screens/NotificationScreen';
import SearchScreen          from './src/screens/SearchScreen';
import AITuneScreen          from './src/screens/AITuneScreen';
import RankingScreen         from './src/screens/RankingScreen';
import PostDetailScreen      from './src/screens/PostDetailScreen';
import {
  isStripeCheckoutEnabled,
  extractStripeSessionId,
  verifyStripeCheckoutSession,
} from './src/services/revenueStripe';

type Screen = 'login' | 'quiz' | 'followSuggest' | 'home' | 'chat' | 'notifications' | 'shop' | 'profile' | 'search' | 'aitune' | 'ranking' | 'postdetail';

export default function App() {
  const { isLoggedIn, aiUser, loadFromStorage, unreadCount, themeMode, accentColor } = useAppStore();
  const themeColors = useMemo(() => getColors(themeMode, accentColor), [themeMode, accentColor]);
  const [screen, setScreen]           = useState<Screen>('login');
  const [profileUserId, setProfileUserId] = useState<string | undefined>();
  const [pendingTag, setPendingTag]    = useState<string | null>(null);
  const [searchQuery, setSearchQuery]  = useState<string>('');
  const [detailPost, setDetailPost]    = useState<import('./src/types').PostData | null>(null);
  const [prevScreen, setPrevScreen]    = useState<Screen>('home');

  // 起動時にデータ復元
  useEffect(() => {
    loadFromStorage().then(() => {
      const s = useAppStore.getState();
      if (s.isLoggedIn && s.aiUser) setScreen('home');
      else if (s.isLoggedIn)        setScreen('quiz');
    });
  }, []);

  useEffect(() => {
    WebBrowser.maybeCompleteAuthSession();
  }, []);

  // Stripe Checkout 戻り: session_id を検証してコイン付与（EXPO_PUBLIC_USE_STRIPE_CHECKOUT=1 のとき）
  useEffect(() => {
    if (!isStripeCheckoutEnabled()) return;

    const processing = new Set<string>();

    async function handleReturn(url: string | null) {
      const sid = extractStripeSessionId(url);
      if (!sid || processing.has(sid)) return;
      processing.add(sid);
      try {
        const r = await verifyStripeCheckoutSession(sid);
        if (!r.ok) {
          if (r.error !== 'already_granted' && r.error !== 'not_paid') {
            Alert.alert('決済の確認', r.error);
          }
          return;
        }
        useAppStore.getState().earnCoins(r.coins);
        Alert.alert('決済完了', `🪙 ${r.coins.toLocaleString()} コインを付与しました`);
      } finally {
        processing.delete(sid);
      }
    }

    Linking.getInitialURL().then(handleReturn);
    const sub = Linking.addEventListener('url', ev => { handleReturn(ev.url); });

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      void handleReturn(window.location.href);
      try {
        const u = new URL(window.location.href);
        if (u.searchParams.get('session_id')?.startsWith('cs_')) {
          u.searchParams.delete('session_id');
          u.searchParams.delete('stripe_checkout');
          window.history.replaceState({}, '', `${u.pathname}${u.search}${u.hash}`);
        }
      } catch { /* ignore */ }
    }

    return () => { sub.remove(); };
  }, []);

  function handleRegistered() {
    setScreen('quiz');
  }

  // クイズ完了 → おすすめフォロー画面へ
  function handleQuizComplete() {
    setScreen('followSuggest');
  }

  // フォロー選択完了 → ホームへ
  function handleFollowComplete() {
    setScreen('home');
  }

  function handlePressProfile(userId?: string) {
    setProfileUserId(userId);
    setScreen('profile');
  }

  function handleSelectTag(tag: string) {
    setPendingTag(tag);
    setScreen('home');
  }

  // ポスト本文のハッシュタグタップ → 検索画面へ（クエリ付き）
  function handlePressHashtag(tag: string) {
    setSearchQuery(tag);
    setScreen('search');
  }

  const showNav = ['home', 'chat', 'notifications', 'shop', 'profile'].includes(screen);

  return (
    <ThemeContext.Provider value={themeColors}>
    <SafeAreaView style={[styles.root, { backgroundColor: themeColors.bg }]}>
      <StatusBar barStyle={themeColors.isDark ? 'light-content' : 'dark-content'} backgroundColor={themeColors.bg} />

      {/* ─── 画面コンテンツ ─────────────────────────────── */}
      <View style={styles.content}>
        {screen === 'login'         && <LoginScreen onRegistered={handleRegistered} />}
        {screen === 'quiz'          && <QuizScreen onComplete={handleQuizComplete} />}
        {screen === 'followSuggest' && <FollowSuggestScreen onComplete={handleFollowComplete} />}
        {screen === 'home'          && <HomeScreen onPressProfile={handlePressProfile} onPressSearch={() => { setSearchQuery(''); setScreen('search'); }} onPressRanking={() => setScreen('ranking')} onPressHashtag={handlePressHashtag} onPressPost={p => { setDetailPost(p); setPrevScreen('home'); setScreen('postdetail'); }} pendingTag={pendingTag} onClearPendingTag={() => setPendingTag(null)} />}
        {screen === 'postdetail'    && detailPost && <PostDetailScreen post={detailPost} onBack={() => setScreen(prevScreen)} onPressAuthor={handlePressProfile} />}
        {screen === 'ranking'       && <RankingScreen onBack={() => setScreen('home')} onPressProfile={handlePressProfile} />}
        {screen === 'search'        && <SearchScreen onBack={() => setScreen('home')} onPressProfile={handlePressProfile} onSelectTag={handleSelectTag} initialQuery={searchQuery} />}
        {screen === 'chat'          && <ChatScreen />}
        {screen === 'notifications' && <NotificationScreen />}
        {screen === 'shop'          && <ShopScreen />}
        {screen === 'profile'       && <ProfileScreen userId={profileUserId} onPressProfile={handlePressProfile} onLogout={() => setScreen('login')} onPressTune={() => setScreen('aitune')} />}
        {screen === 'aitune'        && <AITuneScreen onBack={() => setScreen('profile')} />}
      </View>

      {/* ─── オンラインバッジ ─────────────────────────── */}
      {SUPABASE_CONFIGURED && showNav && (
        <View style={styles.onlineBanner}>
          <View style={[styles.onlineDot, { backgroundColor: themeColors.accentGreen }]} />
          <Text style={[styles.onlineBannerText, { color: themeColors.accentGreen }]}>オンライン共有モード</Text>
        </View>
      )}

      {/* ─── ボトムナビゲーション ──────────────────────── */}
      {showNav && (
        <View style={[styles.tabBar, { backgroundColor: themeColors.bgCard, borderTopColor: themeColors.border }]}>
          <TabBtn icon="home"          label="ホーム"      active={screen === 'home'}          onPress={() => setScreen('home')} />
          <TabBtn icon="chatbubble"    label="AI指示"      active={screen === 'chat'}          onPress={() => setScreen('chat')} />
          <TabBtn icon="notifications" label="通知"        active={screen === 'notifications'} badge={unreadCount} onPress={() => setScreen('notifications')} />
          <TabBtn icon="bag"           label="ショップ"    active={screen === 'shop'}          onPress={() => setScreen('shop')} />
          <TabBtn icon="person-circle" label="プロフィール" active={screen === 'profile'}       onPress={() => { setProfileUserId(undefined); setScreen('profile'); }} />
        </View>
      )}
    </SafeAreaView>
    </ThemeContext.Provider>
  );
}

interface TabBtnProps {
  icon: string;
  label: string;
  active: boolean;
  badge?: number;
  onPress: () => void;
}
function TabBtn({ icon, label, active, badge, onPress }: TabBtnProps) {
  const C = React.useContext(ThemeContext);
  return (
    <TouchableOpacity style={styles.tabBtn} onPress={onPress}>
      <View style={styles.tabIconWrap}>
        <Ionicons
          name={(active ? icon : icon + '-outline') as any}
          size={24}
          color={active ? C.primary : C.textMuted}
        />
        {!!badge && badge > 0 && (
          <View style={[styles.badge, { backgroundColor: C.accent }]}>
            <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
          </View>
        )}
      </View>
      <Text style={[styles.tabLabel, { color: active ? C.primary : C.textMuted }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root         : { flex: 1 },
  content      : { flex: 1 },
  onlineBanner     : { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 4, backgroundColor: 'rgba(67,233,123,0.12)', borderTopWidth: 1, borderTopColor: 'rgba(67,233,123,0.3)' },
  onlineDot        : { width: 6, height: 6, borderRadius: 3 },
  onlineBannerText : { fontSize: FONT_SIZE.xs, fontWeight: '600' },
  tabBar       : { flexDirection: 'row', paddingBottom: 4 },
  tabBtn       : { flex: 1, alignItems: 'center', paddingVertical: 8, gap: 2 },
  tabIconWrap  : { position: 'relative' },
  badge        : { position: 'absolute', top: -4, right: -8, borderRadius: 8, minWidth: 16, paddingHorizontal: 3, paddingVertical: 1, alignItems: 'center' },
  badgeText    : { fontSize: 9, color: '#fff', fontWeight: 'bold' },
  tabLabel     : { fontSize: FONT_SIZE.xs },
  tabLabelActive: { fontWeight: '600' },
});
