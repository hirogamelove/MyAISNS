/**
 * GET /api/stripe-verify?session_id=cs_xxx
 *
 * Env: STRIPE_SECRET_KEY
 */
const Stripe = require('stripe');

function applyCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = async function handler(req, res) {
  applyCors(res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).setHeader('Allow', 'GET, OPTIONS').end('Method Not Allowed');
    return;
  }

  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    res.status(500).json({ ok: false, error: 'STRIPE_SECRET_KEY is not set' });
    return;
  }

  const sessionId =
    req.query && req.query.session_id
      ? String(req.query.session_id)
      : '';

  if (!sessionId.startsWith('cs_')) {
    res.status(400).json({ ok: false, error: 'invalid session_id' });
    return;
  }

  const stripe = new Stripe(secret);

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== 'paid') {
      res.status(200).json({ ok: false, error: 'not_paid' });
      return;
    }

    const raw = session.metadata && session.metadata.coins;
    const coins = parseInt(String(raw || '0'), 10);
    if (!Number.isFinite(coins) || coins < 1) {
      res.status(200).json({ ok: false, error: 'invalid_metadata' });
      return;
    }

    res.status(200).json({ ok: true, coins });
  } catch (e) {
    const msg = e && e.message ? e.message : 'Stripe error';
    res.status(500).json({ ok: false, error: msg });
  }
};
