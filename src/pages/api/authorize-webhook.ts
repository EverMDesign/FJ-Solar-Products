import type { APIRoute } from 'astro';
import crypto from 'node:crypto';

export const prerender = false;

const SANDBOX_API_URL = 'https://apitest.authorize.net/xml/v1/request.api';
const PRODUCTION_API_URL = 'https://api.authorize.net/xml/v1/request.api';

function verifySignature(rawBody: string, signatureHeader: string, signatureKey: string): boolean {
  const expected =
    'sha512=' + crypto.createHmac('sha512', signatureKey).update(rawBody).digest('hex').toUpperCase();
  if (expected.length !== signatureHeader.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
}

async function getTransactionDetails(
  transactionId: string,
  apiLoginId: string,
  transactionKey: string,
  environment: string,
) {
  const apiUrl = environment === 'production' ? PRODUCTION_API_URL : SANDBOX_API_URL;
  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      getTransactionDetailsRequest: {
        merchantAuthentication: { name: apiLoginId, transactionKey },
        transId: transactionId,
      },
    }),
  });
  return res.json();
}

// NOTE: billTo/customer field names below are Authorize.net's documented shape for
// getTransactionDetailsRequest, but this has not been checked against a real sandbox
// response yet — no test credentials existed at the time this was written. Verify
// against a real response once sandbox access is available, before going live.
async function upsertGhlContact(details: any) {
  const PIT_TOKEN = import.meta.env.PIT_TOKEN;
  const LOCATION_ID = import.meta.env.LOCATION_ID;
  const API_BASE = import.meta.env.GHL_API_BASE || 'https://services.leadconnectorhq.com';

  const transaction = details?.transaction || {};
  const billTo = transaction.billTo || {};
  const email = transaction.customer?.email || '';

  const body = {
    locationId: LOCATION_ID,
    firstName: billTo.firstName || undefined,
    lastName: billTo.lastName || undefined,
    email: email || undefined,
    phone: billTo.phoneNumber || undefined,
    address1: billTo.address || undefined,
    city: billTo.city || undefined,
    state: billTo.state || undefined,
    postalCode: billTo.zip || undefined,
    country: billTo.country || 'US',
    tags: ['Customer', 'FJ Solar Store'],
    source: 'FJ Solar Store',
  };

  const res = await fetch(`${API_BASE}/contacts/upsert`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${PIT_TOKEN}`,
      Version: '2021-07-28',
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    console.error('GHL contact upsert failed:', res.status, errorBody);
  }
}

export const POST: APIRoute = async ({ request }) => {
  const signatureKey = import.meta.env.AUTHORIZE_NET_SIGNATURE_KEY;
  const apiLoginId = import.meta.env.AUTHORIZE_NET_API_LOGIN_ID;
  const transactionKey = import.meta.env.AUTHORIZE_NET_TRANSACTION_KEY;
  const environment = import.meta.env.AUTHORIZE_NET_ENVIRONMENT || 'sandbox';

  if (!signatureKey || !apiLoginId || !transactionKey) {
    return new Response('Webhook not configured', { status: 500 });
  }

  const signatureHeader = request.headers.get('X-ANET-Signature') || '';
  const rawBody = await request.text();

  if (!verifySignature(rawBody, signatureHeader, signatureKey)) {
    return new Response('Webhook signature verification failed', { status: 400 });
  }

  const event = JSON.parse(rawBody);

  if (event.eventType === 'net.authorize.payment.authcapture.created') {
    const transactionId = event.payload?.id;
    if (transactionId) {
      const details = await getTransactionDetails(transactionId, apiLoginId, transactionKey, environment);
      await upsertGhlContact(details);
    }
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
};
