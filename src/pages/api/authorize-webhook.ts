import type { APIRoute } from 'astro';
import crypto from 'node:crypto';
import { SHIP_FROM, USPS_CARRIER_ID, USPS_GROUND_ADVANTAGE, DIMENSION_UNITS, findProductBySlugPrefix, normalizeUsState } from '../../lib/shipstation';
import products from '../../data/products.json';

export const prerender = false;

const SANDBOX_API_URL = 'https://apitest.authorize.net/xml/v1/request.api';
const PRODUCTION_API_URL = 'https://api.authorize.net/xml/v1/request.api';

function verifySignature(rawBody: string, signatureHeader: string, signatureKey: string): boolean {
  const expected =
    'sha512=' + crypto.createHmac('sha512', signatureKey).update(rawBody).digest('hex').toUpperCase();
  if (expected.length !== signatureHeader.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
}

// transaction.lineItems is a plain array in the real response, not {lineItem: [...]} —
// confirmed against the first real transaction (2026-10-29). Handle both shapes defensively.
function getLineItems(transaction: any): any[] {
  return Array.isArray(transaction.lineItems) ? transaction.lineItems : transaction.lineItems?.lineItem || [];
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

// FJ Solar Products Orders pipeline in EverReach (created 2026-10-26). If this pipeline
// is ever recreated, these IDs change — re-fetch via GET /opportunities/pipelines.
const ORDERS_PIPELINE_ID = '1hY3ZSKUDcn6JGnbpjxk';
const NEW_ORDER_STAGE_ID = '2084ca26-91fb-4dd4-b4a3-e1d5532631a7';

// Derive order number from Authorize.net's transId (e.g., "60171234567" → "FJSP-234567").
// Uses last 6 digits of transId for a short, branded, customer-facing number.
// Full transId is stored in the order note for authoritative reference/audit.
function deriveOrderNumber(transId: string): string {
  return `FJSP-${String(transId).slice(-6)}`;
}

// billTo/customer field names confirmed correct against a real transaction (2026-10-29).
// Custom fields created 2026-10-30, matching the blank slots found in the real
// new-order-alert.html template (Google Drive) — it uses {{custom_values.X}} for these,
// which are true location-wide Custom Values (shared by every contact, wrong for per-order
// data), except "Items" which was already hand-edited in the live template to
// {{contact.last_order_items}}. The other 6 tags in the live template still need the same
// edit — {{custom_values.order_number}} -> {{contact.order_number}}, and so on for
// shipping_address/order_subtotal/order_shipping/order_tax/order_total — before these
// fields will actually show up in the email; populating the field alone isn't enough.
const LAST_ORDER_ITEMS_FIELD_ID = 'vPKiThQLwX2I5S3FmSkc';
const ORDER_NUMBER_FIELD_ID = 'VLEflKOf8wEPVWdwiwPo';
const SHIPPING_ADDRESS_FIELD_ID = '3sZBfBcBsLcSmsGOAzUO';
const ORDER_SUBTOTAL_FIELD_ID = 'RmjTyByucr5yapmHY8Hu';
const ORDER_SHIPPING_FIELD_ID = 'CRkQnxjjn6RMIrzTKE1s';
const ORDER_TAX_FIELD_ID = 'ZlQ6cAmVi7fBDC64H465';
const ORDER_TOTAL_FIELD_ID = 'Hg860V4KvRtjprIM66vM';

async function upsertGhlContact(details: any, orderNumber: string): Promise<string | null> {
  const PIT_TOKEN = import.meta.env.PIT_TOKEN;
  const LOCATION_ID = import.meta.env.LOCATION_ID;
  const API_BASE = import.meta.env.GHL_API_BASE || 'https://services.leadconnectorhq.com';

  const transaction = details?.transaction || {};
  const billTo = transaction.billTo || {};
  // Same shipTo-preferred-over-billTo reasoning as createShipStationShipment below.
  const shipTo = transaction.shipTo || billTo;
  const email = transaction.customer?.email || '';
  // <br>-joined, not \n — EverReach's merge-field substitution is expected to render the
  // field's HTML as-is into the email body, where a plain newline collapses to a space.
  // Verify this assumption with a real test email before relying on it (see CHANGELOG).
  // Look up full product names and variants from products.json using itemId (slug or slug:variantId).
  // Use item.productCode (if available) for the full untruncated name, otherwise reconstruct from itemId.
  const itemsHtml = getLineItems(transaction)
    .map((item: any) => {
      let displayName = item.productCode || item.name || item.itemId;

      // If no productCode provided, reconstruct from itemId
      if (!item.productCode) {
        const itemId = item.itemId || '';

        // itemId might be "slug" or "slug:variantId" if variant was selected
        if (itemId.includes(':')) {
          const [slug, variantId] = itemId.split(':');
          const fullProduct = products.find((p) => p.slug === slug);
          if (fullProduct) {
            const variant = fullProduct.variants?.find((v) => v.optionId === variantId);
            if (variant) {
              // Reconstruct full variant combo: "Product Name – Variant 1 / Variant 2"
              displayName = `${fullProduct.name} – ${variant.name}`;
            } else {
              displayName = fullProduct.name;
            }
          }
        } else {
          // No variant, just lookup the product name
          const fullProduct = products.find((p) => p.slug === itemId);
          if (fullProduct) {
            displayName = fullProduct.name;
          }
        }
      }

      return `${displayName} x${item.quantity} @ $${Number(item.unitPrice || 0).toFixed(2)}`;
    })
    .join('<br>');
  const shippingAddressHtml = [
    `${shipTo.firstName || ''} ${shipTo.lastName || ''}`.trim(),
    shipTo.address,
    `${shipTo.city || ''}, ${shipTo.state || ''} ${shipTo.zip || ''}`.trim(),
  ]
    .filter(Boolean)
    .join('<br>');

  // Authorize.net only includes a `tax` object on the transaction when FL tax applied
  // (see create-authorize-session.ts) — absent means $0, not missing data.
  const shippingAmount = Number(transaction.shipping?.amount ?? 0);
  const taxAmount = Number(transaction.tax?.amount ?? 0);
  const totalAmount = Number(transaction.authAmount ?? 0);
  const subtotalAmount = totalAmount - shippingAmount - taxAmount;
  const money = (n: number) => `$${n.toFixed(2)}`;

  // Determine product-based tags from line items. Match on itemId (slug) instead of name
  // because Authorize.net truncates names to 31 chars, cutting off words like "fan kit".
  const lineItems = getLineItems(transaction);
  const productTags: string[] = [];
  lineItems.forEach((item: any) => {
    const itemId = (item.itemId || '').toLowerCase();
    if (itemId.includes('auto-generator-start')) {
      productTags.push('fj_ags_purchase');
    }
    if (itemId === 'victron-multiplus-ii-external-fan-kit') {
      productTags.push('fj_ext-kit_purchase');
    }
  });
  // Remove duplicates
  const uniqueProductTags = [...new Set(productTags)];

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
    // 'fjsp-new-order' is what the EverReach workflow watches for to fire the
    // new-order-alert email to Andrew (see new-order-alert.html) — don't rename
    // without updating that workflow's trigger too.
    tags: ['Customer', 'FJ Solar Store', 'fjsp-new-order', ...uniqueProductTags],
    source: 'FJ Solar Store',
    customFields: [
      itemsHtml && { id: LAST_ORDER_ITEMS_FIELD_ID, fieldValue: itemsHtml },
      orderNumber && { id: ORDER_NUMBER_FIELD_ID, fieldValue: orderNumber },
      shippingAddressHtml && { id: SHIPPING_ADDRESS_FIELD_ID, fieldValue: shippingAddressHtml },
      { id: ORDER_SUBTOTAL_FIELD_ID, fieldValue: money(subtotalAmount) },
      { id: ORDER_SHIPPING_FIELD_ID, fieldValue: money(shippingAmount) },
      { id: ORDER_TAX_FIELD_ID, fieldValue: money(taxAmount) },
      { id: ORDER_TOTAL_FIELD_ID, fieldValue: money(totalAmount) },
    ].filter(Boolean),
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
    return null;
  }

  const data = await res.json();
  return data.contact?.id ?? null;
}

// Writes a detailed order summary to the contact's timeline — so a repeat customer's
// full purchase history is visible on their GHL contact page, not just a dollar total on
// each Opportunity card. Every order creates a new Opportunity (see createNewOrderOpportunity
// below) linked to the same upserted contact, so GHL's contact page already lists every
// order a repeat customer has made; this note is what makes each one show *what* they bought,
// at what cost, and all shipping/billing details.
async function addOrderNoteToContact(contactId: string, details: any, orderNumber: string): Promise<void> {
  const PIT_TOKEN = import.meta.env.PIT_TOKEN;
  const API_BASE = import.meta.env.GHL_API_BASE || 'https://services.leadconnectorhq.com';

  const transaction = details?.transaction || {};
  const billTo = transaction.billTo || {};
  const shipTo = transaction.shipTo || billTo;
  const email = transaction.customer?.email || billTo.email || '';
  const phone = billTo.phoneNumber || '';
  const lineItems = getLineItems(transaction);
  const transId = transaction.transId || '(unknown)';

  // Use full untruncated names from item.productCode when available
  const itemLines = lineItems
    .map((item: any) => {
      const displayName = item.productCode || item.name || item.itemId;
      return `- ${displayName} x${item.quantity} @ $${Number(item.unitPrice || 0).toFixed(2)}`;
    })
    .join('\n');

  const shippingAmount = Number(transaction.shipping?.amount ?? 0);
  const taxAmount = Number(transaction.tax?.amount ?? 0);
  const totalAmount = Number(transaction.authAmount ?? 0);
  const subtotalAmount = totalAmount - shippingAmount - taxAmount;
  const money = (n: number) => `$${n.toFixed(2)}`;

  const shipToName = `${shipTo.firstName || ''} ${shipTo.lastName || ''}`.trim();
  const shipAddress = [shipTo.address, `${shipTo.city || ''}, ${shipTo.state || ''} ${shipTo.zip || ''}`.trim()]
    .filter(Boolean)
    .join('\n');
  const billToName = `${billTo.firstName || ''} ${billTo.lastName || ''}`.trim();
  const billAddress = [billTo.address, `${billTo.city || ''}, ${billTo.state || ''} ${billTo.zip || ''}`.trim()]
    .filter(Boolean)
    .join('\n');

  const body = [
    `Order #${orderNumber}`,
    `Authorize.net Transaction ID: ${transId}`,
    '',
    'CONTACT INFO:',
    billToName,
    phone && `Phone: ${phone}`,
    email && `Email: ${email}`,
    '',
    'ITEMS ORDERED:',
    itemLines || '(no line items)',
    '',
    'BILLING ADDRESS:',
    billAddress || '(not provided)',
    '',
    'SHIPPING ADDRESS:',
    shipToName,
    shipAddress || '(not provided)',
    '',
    'ORDER SUMMARY:',
    `Subtotal: ${money(subtotalAmount)}`,
    `Shipping: ${money(shippingAmount)}`,
    `Tax: ${money(taxAmount)}`,
    `Total: ${money(totalAmount)}`,
  ].filter(Boolean).join('\n');

  const res = await fetch(`${API_BASE}/contacts/${contactId}/notes`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${PIT_TOKEN}`,
      Version: '2021-07-28',
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ body }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    console.error('GHL contact note create failed:', res.status, errorBody);
  }
}

// authAmount is Authorize.net's documented field for the captured amount — confirmed
// against the first real transaction (2026-10-29): $29.93, matched exactly.
async function createNewOrderOpportunity(contactId: string, details: any, orderNumber: string): Promise<string | null> {
  const PIT_TOKEN = import.meta.env.PIT_TOKEN;
  const LOCATION_ID = import.meta.env.LOCATION_ID;
  const API_BASE = import.meta.env.GHL_API_BASE || 'https://services.leadconnectorhq.com';

  const transaction = details?.transaction || {};
  const billTo = transaction.billTo || {};
  const monetaryValue = Number(transaction.authAmount ?? 0);
  const customerName = `${billTo.firstName || ''} ${billTo.lastName || ''}`.trim() || 'FJ Solar Customer';

  const res = await fetch(`${API_BASE}/opportunities/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${PIT_TOKEN}`,
      Version: '2021-07-28',
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      locationId: LOCATION_ID,
      pipelineId: ORDERS_PIPELINE_ID,
      pipelineStageId: NEW_ORDER_STAGE_ID,
      name: `${customerName} — ${orderNumber}`,
      status: 'open',
      contactId,
      monetaryValue,
      source: 'FJ Solar Store',
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    // GHL refuses a second open Opportunity for the same contact in this pipeline/stage
    // unless "Allow Duplicate Opportunity" is on account-wide (Settings > Business Info) —
    // real bug hit testing a second order for the same contact (2026-10-29). Rather than
    // requiring that account-wide setting change (it'd affect every pipeline, not just this
    // one) or dropping the sale's shipment sync entirely, fall back to the existing open
    // Opportunity's id, which GHL's own error conveniently hands back as meta.existingId —
    // so the ShipStation shipment still gets created and linked either way.
    try {
      const parsed = JSON.parse(errorBody);
      if (parsed?.code === 'OPPORTUNITY_NO_DUPLICATE' && parsed?.meta?.existingId) {
        console.error(
          'GHL opportunity create hit a duplicate — reusing existing opportunity',
          parsed.meta.existingId,
        );
        return parsed.meta.existingId;
      }
    } catch {
      // Not the duplicate-error shape — fall through to the generic failure log below.
    }
    console.error('GHL opportunity create failed:', res.status, errorBody);
    return null;
  }

  const data = await res.json();
  return data.opportunity?.id ?? null;
}

// Creates the real ShipStation shipment Andrew builds a label from — previously the only
// shipment that existed was an accidental, uncorrelated side effect of the /v2/rates call
// in quote-shipping.ts (no customer name/email, no link back to the GHL order). This one
// is tagged with the GHL Opportunity id via external_shipment_id, so the two can be matched
// up later (see REVISIT.md's ShipStation ↔ GHL Opportunity sync section for the still-open
// next step: auto-advancing the Opportunity once this shipment's label is purchased).
// Deliberately does NOT purchase a label — Andrew's existing flow creates labels manually
// in the ShipStation UI, and a label is a real cost; this only creates the unlabeled record.
async function createShipStationShipment(details: any, opportunityId: string): Promise<void> {
  const apiKey = import.meta.env.SHIPSTATION_API_KEY;
  if (!apiKey) {
    console.error('SHIPSTATION_API_KEY not configured — skipping shipment creation for opportunity', opportunityId);
    return;
  }

  const transaction = details?.transaction || {};
  const billTo = transaction.billTo || {};
  // create-authorize-session.ts now sends a real shipTo (added 2026-10-29, same address
  // as billTo at submit time) and shows the Ship To section on the hosted form, so prefer
  // it here — it reflects what the customer actually confirmed as their shipping address,
  // which may differ from billTo if they edited either one on Authorize.net's page.
  const shipTo = transaction.shipTo || billTo;
  const email = transaction.customer?.email || '';
  const lineItems = getLineItems(transaction);

  let totalWeightOz = 0;
  let declaredValue = 0;
  let boxDimensions: { length: number; width: number; height: number; unit: string } | null = null;
  // Verified against the real API (2026-10-29): top-level `items` with sku/name/quantity/
  // unit_price is what actually makes product/SKU info show up in ShipStation's Orders UI —
  // packages[].products is a different, unrelated field. unit_price must be a plain number,
  // not {currency, amount} (that shape is only for insured_value).
  const shipmentItems: { sku: string; name: string; quantity: number; unit_price: number }[] = [];

  for (const item of lineItems) {
    const quantity = Number(item.quantity) || 1;
    const product = findProductBySlugPrefix(item.itemId);
    if (product) {
      totalWeightOz += (product.weightOz || 16) * quantity;
      declaredValue += (product.price || 0) * quantity;
      if (!boxDimensions && product.dimensions) boxDimensions = product.dimensions;
      // Use GHL's SKU if available, fall back to product slug.
      const sku = product.sku || product.slug;
      shipmentItems.push({ sku, name: product.name, quantity, unit_price: product.price || 0 });
    } else {
      // Unknown/unmatched item — ship something rather than nothing, with a conservative guess.
      console.error('ShipStation shipment: could not match line item to a product', item.itemId);
      totalWeightOz += 16 * quantity;
      declaredValue += Number(item.unitValue || 0) * quantity;
      shipmentItems.push({
        sku: item.itemId || 'unknown',
        name: item.name || item.itemId || 'Unknown item',
        quantity,
        unit_price: Number(item.unitPrice || 0),
      });
    }
  }

  const customerName = `${shipTo.firstName || ''} ${shipTo.lastName || ''}`.trim() || 'FJ Solar Customer';

  const res = await fetch('https://api.shipstation.com/v2/shipments', {
    method: 'POST',
    headers: { 'API-Key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      shipments: [
        {
          external_shipment_id: opportunityId,
          // Without this, the shipment exists via the API (confirmed working — GHL sync,
          // correct weight/address) but never appears in ShipStation's Orders UI at all,
          // which is what Andrew actually looks at day-to-day. Found after the first real
          // order's shipment was invisible to him despite being created successfully.
          create_sales_order: true,
          carrier_id: USPS_CARRIER_ID,
          service_code: USPS_GROUND_ADVANTAGE,
          insurance_provider: 'parcelguard',
          ship_from: {
            name: SHIP_FROM.name,
            phone: SHIP_FROM.phone,
            address_line1: SHIP_FROM.addressLine1,
            city_locality: SHIP_FROM.cityLocality,
            state_province: SHIP_FROM.stateProvince,
            postal_code: SHIP_FROM.postalCode,
            country_code: SHIP_FROM.countryCode,
          },
          ship_to: {
            name: customerName,
            phone: shipTo.phoneNumber || undefined,
            email: email || undefined,
            address_line1: shipTo.address || '',
            city_locality: shipTo.city || '',
            state_province: normalizeUsState(shipTo.state || '', shipTo.country || 'US'),
            postal_code: shipTo.zip || '',
            country_code: shipTo.country || 'US',
          },
          packages: [
            {
              weight: { value: totalWeightOz || 16, unit: 'ounce' },
              ...(boxDimensions && {
                dimensions: {
                  length: boxDimensions.length,
                  width: boxDimensions.width,
                  height: boxDimensions.height,
                  unit: DIMENSION_UNITS[boxDimensions.unit] || boxDimensions.unit,
                },
              }),
              insured_value: { currency: 'usd', amount: declaredValue },
            },
          ],
          items: shipmentItems,
        },
      ],
    }),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok || data?.has_errors) {
    console.error('ShipStation shipment create failed:', res.status, JSON.stringify(data));
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
      const rawTransId = details?.transaction?.transId || transactionId;
      const orderNumber = deriveOrderNumber(rawTransId);
      const contactId = await upsertGhlContact(details, orderNumber);
      if (contactId) {
        await addOrderNoteToContact(contactId, details, orderNumber);
        const opportunityId = await createNewOrderOpportunity(contactId, details, orderNumber);
        if (opportunityId) {
          await createShipStationShipment(details, opportunityId);
        }
      }
    }
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
};
