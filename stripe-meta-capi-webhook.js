/**
 * Prompt Fashion Lab (PFL) - Stripe to Meta Conversions API (CAPI) Node.js Webhook Server
 * 
 * Secure Node.js server-side purchase tracking.
 * Listens for Stripe 'checkout.session.completed', verifies the Stripe signature,
 * and sends standard 'Purchase' events to Meta Conversions API with SHA-256 hashed customer data.
 * 
 * Deduplication: Uses session.id as event_id, matching the browser Meta Pixel eventID.
 * 
 * Environment Variables:
 * - PORT: (default 3000)
 * - STRIPE_WEBHOOK_SECRET: whsec_...
 * - META_PIXEL_ID: 1459724172740305
 * - META_ACCESS_TOKEN: EAA...
 * - META_TEST_EVENT_CODE: (optional, for Meta Events Manager Test Events)
 */

const express = require('express');
const crypto = require('crypto');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;
const PIXEL_ID = process.env.META_PIXEL_ID || '1459724172740305';
const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const TEST_EVENT_CODE = process.env.META_TEST_EVENT_CODE;

// Helper to hash string with SHA-256 for Meta Advanced Matching
function sha256(value) {
  if (!value) return '';
  return crypto.createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

// Stripe requires raw body for signature verification
app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  // 1. Verify Webhook Signature if secret configured
  if (WEBHOOK_SECRET && sig) {
    try {
      const stripe = require('stripe')();
      event = stripe.webhooks.constructEvent(req.body, sig, WEBHOOK_SECRET);
    } catch (err) {
      console.error('[Stripe Webhook Signature Failed]:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
  } else {
    try {
      event = JSON.parse(req.body.toString('utf8'));
    } catch (e) {
      return res.status(400).send('Invalid JSON');
    }
  }

  // 2. Handle completed checkout sessions
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    // Verify payment was successful
    if (session.payment_status !== 'paid') {
      console.log(`[Stripe Webhook] Session not paid (${session.payment_status}). Skipping.`);
      return res.json({ received: true, skipped: 'unpaid' });
    }

    const amountTotal = (session.amount_total || 0) / 100;
    const currency = (session.currency || 'thb').toUpperCase();
    const sessionId = session.id;

    let contentName = 'AI Photoshoot Guide';
    let contentIds = ['guide_99'];
    let value = 99.00;

    if (amountTotal >= 200 || session.amount_total === 34900) {
      contentName = 'Complete AI Photoshoot Toolkit';
      contentIds = ['toolkit_349'];
      value = 349.00;
    }

    const customerEmail = session.customer_details?.email || session.customer_email || '';
    const customerPhone = session.customer_details?.phone || '';
    const customerName = session.customer_details?.name || '';

    const userData = {
      client_ip_address: req.ip || req.headers['x-forwarded-for'] || '',
      client_user_agent: req.headers['user-agent'] || ''
    };

    if (customerEmail) userData.em = [sha256(customerEmail)];
    if (customerPhone) {
      const cleanPhone = customerPhone.replace(/\D/g, '');
      if (cleanPhone) userData.ph = [sha256(cleanPhone)];
    }
    if (customerName) {
      const parts = customerName.trim().toLowerCase().split(/\s+/);
      if (parts[0]) userData.fn = [sha256(parts[0])];
      if (parts.length > 1) userData.ln = [sha256(parts[parts.length - 1])];
    }

    const capiEvent = {
      event_name: 'Purchase',
      event_time: Math.floor(Date.now() / 1000),
      event_id: sessionId, // Matches browser eventID for deduplication
      event_source_url: value >= 200 
        ? 'https://guide.promptfashionlab.com/thankyou-toolkit.html' 
        : 'https://guide.promptfashionlab.com/thankyou.html',
      action_source: 'website',
      user_data: userData,
      custom_data: {
        currency: currency,
        value: value,
        content_name: contentName,
        content_type: 'product',
        content_ids: contentIds,
        num_items: 1,
        order_id: sessionId
      }
    };

    const capiPayload = { data: [capiEvent] };
    if (TEST_EVENT_CODE) {
      capiPayload.test_event_code = TEST_EVENT_CODE;
    }

    if (ACCESS_TOKEN) {
      const payloadString = JSON.stringify(capiPayload);
      const postReq = https.request({
        hostname: 'graph.facebook.com',
        path: `/v19.0/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payloadString)
        }
      }, (postRes) => {
        let body = '';
        postRes.on('data', chunk => body += chunk);
        postRes.on('end', () => {
          console.log('[Meta CAPI Response]:', postRes.statusCode, body);
        });
      });

      postReq.on('error', (err) => {
        console.error('[Meta CAPI Error]:', err.message);
      });

      postReq.write(payloadString);
      postReq.end();
    } else {
      console.warn('[Meta CAPI Warning] META_ACCESS_TOKEN is not configured.');
    }
  }

  res.json({ received: true });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', pixel_id: PIXEL_ID });
});

app.listen(PORT, () => {
  console.log(`PFL Stripe-Meta CAPI Webhook server running on port ${PORT}`);
});
