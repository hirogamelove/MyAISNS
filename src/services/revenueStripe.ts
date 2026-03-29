/**
 * Stripe Checkout（本番収益）フロント側
 *
 * 使い方:
 *   1. Vercel 等に server-examples の API をデプロイし STRIPE_SECRET_KEY を設定
 *   2. Stripe Dashboard で Price（price_xxx）を作成し COIN_PACKS の priceId と一致させる
 *   3. .env に以下を設定してビルド:
 *        EXPO_PUBLIC_USE_STRIPE_CHECKOUT=1
 *        （任意）EXPO_PUBLIC_STRIPE_CHECKOUT_API_URL=https://xxx/api/stripe-checkout
 *        （任意）EXPO_PUBLIC_STRIPE_VERIFY_API_URL=https://xxx/api/stripe-verify
 *
 * Web では success_url が同一オリジンに戻るため、App で session_id を検知して verify する。
 */
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ExpoLinking from 'expo-linking';
import { PROXY_BASE_URL } from '../constants';
import type { CoinPack } from './stripeService';

const USE_CHECKOUT = process.env.EXPO_PUBLIC_USE_STRIPE_CHECKOUT === '1';

const CHECKOUT_URL =
  process.env.EXPO_PUBLIC_STRIPE_CHECKOUT_API_URL?.trim()
  || `${PROXY_BASE_URL}/api/stripe-checkout`;

const VERIFY_URL =
  process.env.EXPO_PUBLIC_STRIPE_VERIFY_API_URL?.trim()
  || `${PROXY_BASE_URL}/api/stripe-verify`;

const SESSION_DONE_PREFIX = '@stripe_paid_session:';

export function isStripeCheckoutEnabled(): boolean {
  return USE_CHECKOUT;
}

function buildCheckoutReturnUrls(): { successUrl: string; cancelUrl: string } {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const { origin, pathname } = window.location;
    const base = `${origin}${pathname || '/'}`;
    const sep = base.includes('?') ? '&' : '?';
    return {
      successUrl: `${base}${sep}stripe_checkout=1&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${base}${sep}stripe_checkout=cancel`,
    };
  }

  const successBase = ExpoLinking.createURL('stripe-return');
  const cancelBase = ExpoLinking.createURL('stripe-cancel');
  const sep = successBase.includes('?') ? '&' : '?';
  return {
    successUrl: `${successBase}${sep}session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl : cancelBase,
  };
}

export async function openStripeCheckout(pack: CoinPack): Promise<{ ok: boolean; error?: string }> {
  const coins = pack.coins + (pack.bonus ?? 0);
  const { successUrl, cancelUrl } = buildCheckoutReturnUrls();

  try {
    const res = await fetch(CHECKOUT_URL, {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({
        packId   : pack.id,
        priceId  : pack.priceId,
        coins,
        priceJpy : pack.priceJpy,
        successUrl,
        cancelUrl,
      }),
    });

    const raw = await res.text();
    let data: { url?: string; error?: string };
    try {
      data = JSON.parse(raw) as { url?: string; error?: string };
    } catch {
      return { ok: false, error: raw.slice(0, 120) || `HTTP ${res.status}` };
    }

    if (!res.ok) {
      return { ok: false, error: data.error || raw || `HTTP ${res.status}` };
    }
    if (!data.url) {
      return { ok: false, error: '決済ページのURLが返りませんでした' };
    }

    if (Platform.OS === 'web') {
      window.location.assign(data.url);
      return { ok: true };
    }

    await WebBrowser.openBrowserAsync(data.url);
    return { ok: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '通信エラー';
    return { ok: false, error: msg };
  }
}

export type VerifyResult =
  | { ok: true; coins: number }
  | { ok: false; error: string };

const verifyInflight = new Map<string, Promise<VerifyResult>>();

export async function verifyStripeCheckoutSession(sessionId: string): Promise<VerifyResult> {
  const existing = verifyInflight.get(sessionId);
  if (existing) return existing;

  const promise = (async (): Promise<VerifyResult> => {
    const key = SESSION_DONE_PREFIX + sessionId;
    const done = await AsyncStorage.getItem(key);
    if (done === '1') {
      return { ok: false, error: 'already_granted' };
    }

    try {
      const res = await fetch(`${VERIFY_URL}?session_id=${encodeURIComponent(sessionId)}`);
      const data = (await res.json()) as { ok?: boolean; coins?: number; error?: string };

      if (!res.ok || !data.ok) {
        return { ok: false, error: data.error || `検証に失敗しました (${res.status})` };
      }
      const coins = typeof data.coins === 'number' ? data.coins : 0;
      if (coins <= 0) {
        return { ok: false, error: '付与コイン数が不正です' };
      }

      await AsyncStorage.setItem(key, '1');
      return { ok: true, coins };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '通信エラー';
      return { ok: false, error: msg };
    }
  })();

  verifyInflight.set(sessionId, promise);
  try {
    return await promise;
  } finally {
    verifyInflight.delete(sessionId);
  }
}

/** URL / 初期URL から session_id を取り出す */
export function extractStripeSessionId(url: string | null): string | null {
  if (!url) return null;
  try {
    const withProto = /^[a-z][a-z0-9+.-]*:/i.test(url) ? url : `https://dummy.invalid/${url.replace(/^\//, '')}`;
    const u = new URL(withProto);
    const sid = u.searchParams.get('session_id');
    if (sid && sid.startsWith('cs_')) return sid;
  } catch { /* ignore */ }

  const m = url.match(/session_id=(cs_[a-zA-Z0-9_]+)/);
  return m ? m[1] : null;
}
