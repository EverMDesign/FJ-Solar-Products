import type { APIRoute } from 'astro';
import products from '../../data/products.json';

export const prerender = false;

interface CartItemInput {
  slug: string;
  quantity: number;
}

const SANDBOX_API_URL = 'https://apitest.authorize.net/xml/v1/request.api';
const PRODUCTION_API_URL = 'https://api.authorize.net/xml/v1/request.api';
const SANDBOX_PAYMENT_URL = 'https://test.authorize.net/payment/payment';
const PRODUCTION_PAYMENT_URL = 'https://accept.authorize.net/payment/payment';

export const POST: APIRoute = async ({ request, url }) => {
  const apiLoginId = import.meta.env.AUTHORIZE_NET_API_LOGIN_ID;
  const transactionKey = import.meta.env.AUTHORIZE_NET_TRANSACTION_KEY;
  const environment = import.meta.env.AUTHORIZE_NET_ENVIRONMENT || 'sandbox';

  if (!apiLoginId || !transactionKey) {
    return new Response(JSON.stringify({ error: 'Checkout is not configured yet.' }), { status: 500 });
  }

  const body = await request.json();
  const items: CartItemInput[] = body.items || [];
  const shippingCents: number = body.shippingCents;
  const address = body.address || {};

  if (items.length === 0) {
    return new Response(JSON.stringify({ error: 'Your cart is empty.' }), { status: 400 });
  }
  if (typeof shippingCents !== 'number') {
    return new Response(JSON.stringify({ error: 'Get a shipping rate before checking out.' }), { status: 400 });
  }

  // Prices always come from our own product data, never trusted from the client.
  let subtotal = 0;
  const lineItem = items.map((item) => {
    const product = products.find((p) => p.slug === item.slug);
    if (!product || product.price === null) {
      throw new Error(`Unknown or unavailable product: ${item.slug}`);
    }
    subtotal += product.price * item.quantity;
    return {
      // Authorize.net caps itemId and name at 31 characters each.
      itemId: product.slug.slice(0, 31),
      name: product.name.slice(0, 31),
      quantity: item.quantity,
      unitPrice: product.price.toFixed(2),
    };
  });

  const shippingAmount = shippingCents / 100;
  const totalAmount = (subtotal + shippingAmount).toFixed(2);
  const origin = `${url.protocol}//${url.host}`;

  const requestBody = {
    getHostedPaymentPageRequest: {
      merchantAuthentication: {
        name: apiLoginId,
        transactionKey,
      },
      transactionRequest: {
        transactionType: 'authCaptureTransaction',
        amount: totalAmount,
        lineItems: { lineItem },
        shipping: {
          amount: shippingAmount.toFixed(2),
          name: 'Shipping',
        },
        // Our shipping form only collects street/city/state/zip/country (no name) —
        // Authorize.net's hosted page collects the customer's name and card details
        // itself, so this is just a pre-fill of what we already have.
        billTo: {
          address: address.street || '',
          city: address.city || '',
          state: address.state || '',
          zip: address.zip || '',
          country: address.country || 'US',
        },
      },
      hostedPaymentSettings: {
        setting: [
          {
            settingName: 'hostedPaymentReturnOptions',
            settingValue: JSON.stringify({
              showReceipt: false,
              url: `${origin}/cart/?success=1`,
              cancelUrl: `${origin}/cart/?canceled=1`,
            }),
          },
        ],
      },
    },
  };

  const apiUrl = environment === 'production' ? PRODUCTION_API_URL : SANDBOX_API_URL;
  const paymentUrl = environment === 'production' ? PRODUCTION_PAYMENT_URL : SANDBOX_PAYMENT_URL;

  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });
  const data = await res.json();

  if (data.messages?.resultCode !== 'Ok' || !data.token) {
    console.error('Authorize.net getHostedPaymentPageRequest failed:', JSON.stringify(data));
    return new Response(JSON.stringify({ error: 'Could not start checkout.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // The hosted page needs a POST with this token as a form field, not a GET redirect —
  // see the checkout button handler in src/pages/cart.astro.
  return new Response(JSON.stringify({ token: data.token, paymentUrl }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
