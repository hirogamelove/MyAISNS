// ─────────────────────────────────────────────────────────────
//  Stripe 連携サービス
//
//  本番利用する場合:
//    1. Stripe ダッシュボードで商品・価格を作成
//    2. STRIPE_PUBLISHABLE_KEY に公開可能キーを設定
//    3. Vercel プロキシに /api/create-payment-intent エンドポイントを追加
//    4. processPayment() 内のシミュレーション部分を実Stripe呼び出しに差し替え
// ─────────────────────────────────────────────────────────────

export const STRIPE_PUBLISHABLE_KEY = '';  // ← pk_live_xxx または pk_test_xxx を入力

// ─── コインパック定義 ─────────────────────────────────────
export interface CoinPack {
  id       : string;
  label    : string;
  coins    : number;
  priceJpy : number;
  priceId  : string;   // Stripe Price ID (price_xxx)
  badge?   : string;   // 「一番人気」「お得」など
  bonus?   : number;   // ボーナスコイン数
}

export const COIN_PACKS: CoinPack[] = [
  {
    id       : 'starter',
    label    : 'スターターパック',
    coins    : 600,
    priceJpy : 480,
    priceId  : 'price_1TGKrkDRtmxtjbORQmeYLTRU',
    bonus    : 0,
  },
  {
    id       : 'popular',
    label    : '人気パック',
    coins    : 1500,
    priceJpy : 980,
    priceId  : 'price_1TGKt3DRtmxtjbORvvGqokm2',
    badge    : '一番人気',
    bonus    : 100,
  },
  {
    id       : 'premium',
    label    : 'プレミアムパック',
    coins    : 3500,
    priceJpy : 3500,
    priceId  : 'price_1TGKtgDRtmxtjbORKUKdgvbb',
    badge    : '最もお得',
    bonus    : 500,
  },
];

// ─── カード種別 ──────────────────────────────────────────
export type CardBrand = 'visa' | 'mastercard' | 'amex' | 'jcb' | 'unknown';

export function detectCardBrand(number: string): CardBrand {
  const n = number.replace(/\s/g, '');
  if (/^4/.test(n))                   return 'visa';
  if (/^5[1-5]/.test(n))              return 'mastercard';
  if (/^3[47]/.test(n))               return 'amex';
  if (/^35(2[89]|[3-8]\d)/.test(n))  return 'jcb';
  return 'unknown';
}

export const CARD_BRAND_EMOJI: Record<CardBrand, string> = {
  visa       : '💳 VISA',
  mastercard : '💳 MC',
  amex       : '💳 AMEX',
  jcb        : '💳 JCB',
  unknown    : '💳',
};

// ─── Luhn アルゴリズムでカード番号を検証 ────────────────
export function luhnCheck(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  if (digits.length < 13) return false;
  let sum = 0;
  let alternate = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i], 10);
    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

// ─── カード番号フォーマット（XXXX XXXX XXXX XXXX）────────
export function formatCardNumber(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 16);
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
}

// ─── 有効期限フォーマット（MM/YY）────────────────────────
export function formatExpiry(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (digits.length >= 3) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return digits;
}

// ─── バリデーション ──────────────────────────────────────
export interface CardValidation {
  numberOk  : boolean;
  expiryOk  : boolean;
  cvcOk     : boolean;
  nameOk    : boolean;
}

export function validateCard(
  number: string, expiry: string, cvc: string, name: string,
): CardValidation {
  const digits  = number.replace(/\s/g, '');
  const [mm, yy] = expiry.split('/');
  const now      = new Date();
  const expMonth = parseInt(mm, 10);
  const expYear  = 2000 + parseInt(yy ?? '0', 10);

  const expiryOk =
    !!mm && !!yy &&
    expMonth >= 1 && expMonth <= 12 &&
    (expYear > now.getFullYear() ||
      (expYear === now.getFullYear() && expMonth >= now.getMonth() + 1));

  return {
    numberOk : digits.length >= 13 && luhnCheck(digits),
    expiryOk,
    cvcOk    : cvc.replace(/\D/g, '').length >= 3,
    nameOk   : name.trim().length >= 2,
  };
}

// ─── 決済処理（現在はシミュレーション）──────────────────
export type PaymentResult =
  | { status: 'success' }
  | { status: 'error'; message: string };

export async function processPayment(
  _pack    : CoinPack,
  _number  : string,
  _expiry  : string,
  _cvc     : string,
  _name    : string,
): Promise<PaymentResult> {
  // ── 本番実装例（Stripe） ─────────────────────────────
  // if (STRIPE_PUBLISHABLE_KEY) {
  //   const { error, paymentMethod } = await stripe.createPaymentMethod({
  //     type: 'card',
  //     card: cardElement,
  //   });
  //   if (error) return { status: 'error', message: error.message };
  //
  //   const response = await fetch(`${PROXY_BASE_URL}/api/create-payment-intent`, {
  //     method: 'POST',
  //     headers: { 'Content-Type': 'application/json' },
  //     body: JSON.stringify({ priceId: _pack.priceId, paymentMethodId: paymentMethod.id }),
  //   });
  //   const data = await response.json();
  //   if (!data.success) return { status: 'error', message: data.error };
  //   return { status: 'success' };
  // }
  // ─────────────────────────────────────────────────────

  // テストモード: 2秒後に成功（カード番号の末尾が「0000」は失敗）
  await new Promise(r => setTimeout(r, 2000));
  const digits = _number.replace(/\s/g, '');
  if (digits.endsWith('0000')) {
    return { status: 'error', message: '決済が拒否されました。別のカードをお試しください。' };
  }
  return { status: 'success' };
}
