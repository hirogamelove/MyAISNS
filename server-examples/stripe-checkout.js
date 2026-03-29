/**
 * 参照用の複製。デプロイはリポジトリの vercel-stripe-api/ を使う（CORS 対応済み）。
 */
const Stripe = require('stripe');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).setHeader('Allow', 'POST').end('Method Not Allowed');
    return;
  }

  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    res.status(500).json({ error: 'STRIPE_SECRET_KEY is not set' });
    return;
  }

  const stripe = new Stripe(secret);

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body || '{}');
    } catch {
      res.status(400).json({ error: 'Invalid JSON' });
      return;
    }
  }

  const {
    packId,
    priceId,
    coins,
    priceJpy,
    successUrl,
    cancelUrl,
  } = body || {};

  if (!priceId || !successUrl || !cancelUrl) {
    res.status(400).json({ error: 'priceId, successUrl, cancelUrl are required' });
    return;
  }

  const coinsNum = Number(coins);
  if (!Number.isFinite(coinsNum) || coinsNum < 1) {
    res.status(400).json({ error: 'coins must be a positive number' });
    return;
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode       : 'payment',
      line_items : [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url : cancelUrl,
      metadata   : {
        packId : String(packId || ''),
        coins  : String(Math.floor(coinsNum)),
        priceJpy: String(priceJpy ?? ''),
      },
    });

    if (!session.url) {
      res.status(500).json({ error: 'No checkout URL' });
      return;
    }

    res.status(200).json({ url: session.url });
  } catch (e) {
    const msg = e && e.message ? e.message : 'Stripe error';
    res.status(500).json({ error: msg });
  }
};
