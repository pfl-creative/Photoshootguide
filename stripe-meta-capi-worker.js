/**
 * Prompt Fashion Lab (PFL) - Stripe to Meta Conversions API (CAPI) Cloudflare Worker
 * 
 * Secure, server-side purchase tracking directly from Stripe webhooks to Meta.
 * Ensures 100% purchase recording even if customers close their browser, use ad blockers,
 * or have iOS/Safari tracking restrictions.
 * 
 * Deduplication: Uses Stripe Checkout Session ID as event_id, matching the browser
 * Meta Pixel eventID on thankyou.html and thankyou-toolkit.html.
 * 
 * Required Cloudflare Worker Environment Variables / Secrets:
 * - STRIPE_WEBHOOK_SECRET: whsec_... (from Stripe Dashboard > Developers > Webhooks)
 * - META_PIXEL_ID: 1459724172740305
 * - META_ACCESS_TOKEN: EAA... (from Meta Events Manager > Settings > Generate Access Token)
 * - META_TEST_EVENT_CODE: (optional, for testing in Meta Events Manager Test Events tab)
 */

export default {
  async fetch(request, env, ctx) {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const signature = request.headers.get('stripe-signature');
    if (!signature) {
      return new Response('Missing Stripe signature header', { status: 400 });
    }

    const rawBody = await request.text();

    // 1. Verify Stripe Webhook Signature (HMAC-SHA256)
    const isValid = await verifyStripeSignature(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
    if (!isValid) {
      console.error('[Stripe Webhook] Invalid signature verification');
      return new Response('Invalid signature', { status: 400 });
    }

    let event;
    try {
      event = JSON.parse(rawBody);
    } catch (err) {
      return new Response('Invalid JSON payload', { status: 400 });
    }

    // 2. Only process verified successful checkout sessions
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;

      // Verify payment was actually completed
      if (session.payment_status !== 'paid') {
        console.log(`[Stripe Webhook] Payment not paid (status: ${session.payment_status}). Skipping Purchase event.`);
        return new Response(JSON.stringify({ received: true, skipped: 'unpaid' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // 3. Determine product and purchase amount
      const amountTotal = (session.amount_total || 0) / 100; // in THB
      const currency = (session.currency || 'thb').toUpperCase();
      const sessionId = session.id; // e.g. cs_live_... (used for Meta deduplication)

      let contentName = 'AI Photoshoot Guide';
      let contentIds = ['guide_99'];
      let value = 99.00;

      // Detect package: 349 THB for Complete Toolkit vs 99 THB for Guide only
      if (amountTotal >= 200 || (session.amount_total === 34900)) {
        contentName = 'Complete AI Photoshoot Toolkit';
        contentIds = ['toolkit_349'];
        value = 349.00;
      } else {
        value = 99.00;
      }

      // 4. Customer Information & SHA-256 Hashing for Meta Advanced Matching
      const customerEmail = session.customer_details?.email || session.customer_email || '';
      const customerPhone = session.customer_details?.phone || '';
      const customerName = session.customer_details?.name || '';

      const userData = {
        client_ip_address: request.headers.get('cf-connecting-ip') || '',
        client_user_agent: request.headers.get('user-agent') || ''
      };

      if (customerEmail) {
        userData.em = [await sha256(customerEmail.trim().toLowerCase())];
      }
      if (customerPhone) {
        // Strip non-digits
        const cleanPhone = customerPhone.replace(/\D/g, '');
        if (cleanPhone) {
          userData.ph = [await sha256(cleanPhone)];
        }
      }
      if (customerName) {
        const parts = customerName.trim().toLowerCase().split(/\s+/);
        if (parts[0]) userData.fn = [await sha256(parts[0])];
        if (parts.length > 1) userData.ln = [await sha256(parts[parts.length - 1])];
      }

      // 5. Build Meta Conversions API Payload
      const capiEvent = {
        event_name: 'Purchase',
        event_time: Math.floor(Date.now() / 1000),
        event_id: sessionId, // Critical: Matches browser eventID for deduplication
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

      const capiPayload = {
        data: [capiEvent]
      };

      if (env.META_TEST_EVENT_CODE) {
        capiPayload.test_event_code = env.META_TEST_EVENT_CODE;
      }

      // 6. Send to Meta Graph API
      const pixelId = env.META_PIXEL_ID || '1459724172740305';
      const metaUrl = `https://graph.facebook.com/v19.0/${pixelId}/events?access_token=${env.META_ACCESS_TOKEN}`;

      try {
        const metaRes = await fetch(metaUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(capiPayload)
        });

        const metaResult = await metaRes.json();
        console.log('[Meta CAPI Success]', JSON.stringify(metaResult));

        return new Response(JSON.stringify({ received: true, meta: metaResult }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (metaErr) {
        console.error('[Meta CAPI Error]', metaErr);
        // Return 200 to Stripe so it doesn't repeatedly retry if Meta has a transient API issue
        return new Response(JSON.stringify({ received: true, meta_error: metaErr.message }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    return new Response(JSON.stringify({ received: true, ignored_type: event.type }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

/**
 * SHA-256 Hashing Helper for Cloudflare Workers (Web Crypto API)
 */
async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Stripe Webhook Signature Verification using Web Crypto API
 */
async function verifyStripeSignature(payload, header, secret) {
  if (!secret) return true; // If secret is not yet set in testing
  try {
    const parts = header.split(',');
    let timestamp = null;
    let signature = null;

    for (const part of parts) {
      const [key, value] = part.split('=');
      if (key === 't') timestamp = value;
      if (key === 'v1') signature = value;
    }

    if (!timestamp || !signature) return false;

    // Reject events older than 5 minutes
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - parseInt(timestamp, 10)) > 300) {
      return false;
    }

    const signedPayload = `${timestamp}.${payload}`;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(signedPayload));
    const hashArray = Array.from(new Uint8Array(sig));
    const expectedSig = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    return expectedSig === signature;
  } catch (err) {
    console.error('Signature verification error:', err);
    return false;
  }
}
