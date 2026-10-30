import type { APIRoute } from 'astro';
import products from '../../data/products.json';
import { calculateTaxCents } from '../../lib/tax';

export const prerender = false;

interface CartItemInput {
  slug: string;
  quantity: number;
  variantOptionId?: string;
  variantName?: string;
  price?: number;
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
    console.error('Authorize.net credentials missing:', { hasLoginId: !!apiLoginId, hasKey: !!transactionKey });
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

  // Prices and variants always come from our own product data/cart, never trusted from the client.
  let subtotal = 0;
  const lineItem = items.map((item) => {
    const product = products.find((p) => p.slug === item.slug);
    if (!product || product.price === null) {
      throw new Error(`Unknown or unavailable product: ${item.slug}`);
    }

    // If item has a variant, use its price; otherwise use product base price.
    // Variant pricing comes from the cart (client sent it), but we trust
    // our own product/variant definitions for the final price calculation.
    let unitPrice = product.price;
    let displayName = product.name;

    if (item.variantName && item.variantOptionId) {
      const variant = product.variants?.find((v) => v.optionId === item.variantOptionId);
      if (variant) {
        unitPrice = variant.price;
        displayName = `${product.name} - ${variant.name}`;
      }
    }

    subtotal += unitPrice * item.quantity;
    return {
      // Authorize.net caps itemId and name at 31 characters. Store the full combo in a
      // custom field so GHL gets the complete name. itemId is slug or slug:variantId for webhook reconstruction.
      itemId: (item.variantOptionId ? `${item.slug}:${item.variantOptionId}` : product.slug).slice(0, 31),
      name: displayName.slice(0, 31),
      quantity: item.quantity,
      unitPrice: unitPrice.toFixed(2),
      // Store full name as custom field so webhook can preserve it for GHL
      description: displayName,
    };
  });

  const shippingAmount = shippingCents / 100;
  // Recomputed server-side from our own trusted subtotal, never trusted from the client —
  // only charged when shipping to a Florida address (see src/lib/tax.ts).
  const taxCents = calculateTaxCents(Math.round(subtotal * 100), address.state);
  const taxAmount = taxCents / 100;
  const totalAmount = (subtotal + shippingAmount + taxAmount).toFixed(2);
  // Authorize.net's hosted-page API rejects `localhost` as a return/cancel URL
  // (E00013) — harmless in prod (never localhost there), but blocks local testing
  // entirely. Swap in the real prod domain for just this field when testing locally;
  // the actual POST handling still happens on whatever origin made this request.
  const isLocalDev = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  const origin = isLocalDev ? 'https://fj-solar-products.vercel.app' : `${url.protocol}//${url.host}`;

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
        // Authorize.net's JSON API still maps to an ordered XML schema — `tax` must
        // come before `shipping` in this object or the request is rejected with
        // "invalid child element 'tax'" (E00003), even though both are valid elements.
        ...(taxCents > 0 && {
          tax: {
            amount: taxAmount.toFixed(2),
            name: 'FL Sales Tax',
            description: 'Florida sales tax (6.5%)',
          },
        }),
        shipping: {
          amount: shippingAmount.toFixed(2),
          name: 'Shipping',
        },
        // Our shipping form collects name + address — same address object for both
        // billTo and shipTo since this flow only collects one address from the customer
        // (the one used for the real ShipStation rate), there's no separate billing step.
        // Element order matters here (see the `tax`-before-`shipping` comment above) —
        // billTo must come before shipTo, confirmed against the real API's schema error.
        billTo: {
          firstName: address.firstName || '',
          lastName: address.lastName || '',
          address: address.street || '',
          city: address.city || '',
          state: address.state || '',
          zip: address.zip || '',
          country: address.country || 'US',
        },
        shipTo: {
          firstName: address.firstName || '',
          lastName: address.lastName || '',
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
            // Required for the embedded-iframe checkout modal (see cart.astro) — this is
            // how Authorize.net tells our page a payment succeeded/was canceled, via
            // postMessage relayed through public/authorize-net-communicator.html. url/
            // cancelUrl below become a fallback only: if that postMessage never fires
            // (a known occasional issue with Accept Hosted), the hosted page navigates
            // the iframe itself to one of these, and cart.astro's iframe `load` handler
            // catches that case and finishes the redirect at the top level.
            settingName: 'hostedPaymentIFrameCommunicatorUrl',
            settingValue: JSON.stringify({ url: `${origin}/authorize-net-communicator.html` }),
          },
          {
            // Accept Hosted's only styling lever — one accent color for buttons/field
            // lines. No further customization is possible (PCI SAQ-A tradeoff).
            settingName: 'hostedPaymentStyleOptions',
            settingValue: JSON.stringify({ bgColor: '#EBAF16' }),
          },
          {
            // showEmail/requiredEmail both default to false — without this, Andrew's
            // account-level settings apparently still required an email on submit, but
            // with no field ever shown to enter it in (real bug hit 2026-10-29). We also
            // want this email regardless: it feeds the GHL contact, the ShipStation
            // shipment's ship_to.email, and authorize-webhook.ts's customer.email lookup.
            settingName: 'hostedPaymentCustomerOptions',
            settingValue: JSON.stringify({ showEmail: true, requiredEmail: true }),
          },
          {
            // Hide shipping address on the Authorize.net form since we already
            // collected it on the /cart/ page. The shipTo object above still gets
            // passed to Authorize.net and ShipStation — it's just not shown for editing.
            settingName: 'hostedPaymentShippingAddressOptions',
            settingValue: JSON.stringify({ show: false }),
          },
          {
            settingName: 'hostedPaymentReturnOptions',
            settingValue: JSON.stringify({
              showReceipt: false,
              url: `${origin}/thank-you/`,
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
  let data;
  try {
    data = await res.json();
  } catch (e) {
    console.error('Authorize.net response not JSON:', res.status, await res.text());
    return new Response(JSON.stringify({ error: 'Could not start checkout.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (data.messages?.resultCode !== 'Ok' || !data.token) {
    console.error('Authorize.net getHostedPaymentPageRequest failed:', {
      resultCode: data.messages?.resultCode,
      errors: data.messages?.message,
      hasToken: !!data.token,
      fullResponse: data,
    });
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
