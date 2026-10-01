import type { APIRoute } from 'astro';
import products from '../../data/products.json';

export const prerender = false;

const SHIP_FROM = {
  name: 'Faithful Journey Solar',
  phone: import.meta.env.SHIP_FROM_PHONE || '',
  addressLine1: import.meta.env.SHIP_FROM_STREET || '',
  cityLocality: import.meta.env.SHIP_FROM_CITY || '',
  stateProvince: import.meta.env.SHIP_FROM_STATE || '',
  postalCode: import.meta.env.SHIP_FROM_ZIP || '',
  countryCode: import.meta.env.SHIP_FROM_COUNTRY || 'US',
};

// Andrew's standard shipping (confirmed 2026-10-01): USPS Ground Advantage only, no carrier
// choice shown to the customer. Expedited (FedEx/UPS) is a planned later addition, not built yet.
const USPS_CARRIER_ID = 'se-4619801';
const USPS_GROUND_ADVANTAGE = 'usps_ground_advantage';
// Covers ShipStation's discounted-rate margin + handling — Andrew's number, confirmed 2026-10-01.
const HANDLING_MARKUP = 1.3;

interface CartItemInput {
  slug: string;
  quantity: number;
  weightOz?: number;
  dimensions?: { length: number; width: number; height: number; unit: string } | null;
}

export const POST: APIRoute = async ({ request }) => {
  const apiKey = import.meta.env.SHIPSTATION_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Shipping is not configured yet.' }), { status: 500 });
  }

  const body = await request.json();
  const items: CartItemInput[] = body.items || [];
  const address = body.address || {};

  if (items.length === 0) {
    return new Response(JSON.stringify({ error: 'Your cart is empty.' }), { status: 400 });
  }
  if (!address.street || !address.city || !address.state || !address.zip) {
    return new Response(JSON.stringify({ error: 'Please fill in the full shipping address.' }), { status: 400 });
  }

  const totalWeightOz = items.reduce((sum, item) => {
    if (item.weightOz) return sum + item.weightOz * item.quantity;
    const product = products.find((p) => p.slug === item.slug);
    return sum + (product?.weightOz || 16) * item.quantity;
  }, 0);

  // GHL stores dimension units abbreviated ("in", "cm") — ShipStation's API rejects
  // anything but the full word ("inch", "centimeter").
  const DIMENSION_UNITS: Record<string, string> = { in: 'inch', cm: 'centimeter' };

  // Use the box dimensions of the first cart line that has them — fine for a single-product
  // cart (today's real case); a mixed multi-box cart would need real bin-packing, not built.
  const boxDimensions = items.find((item) => item.dimensions)?.dimensions;
  const packages = boxDimensions
    ? [
        {
          weight: { value: totalWeightOz, unit: 'ounce' },
          dimensions: {
            length: boxDimensions.length,
            width: boxDimensions.width,
            height: boxDimensions.height,
            unit: DIMENSION_UNITS[boxDimensions.unit] || boxDimensions.unit,
          },
        },
      ]
    : [{ weight: { value: totalWeightOz, unit: 'ounce' } }];

  const shipstationRes = await fetch('https://api.shipstation.com/v2/rates', {
    method: 'POST',
    headers: {
      'API-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      rate_options: {
        carrier_ids: [USPS_CARRIER_ID],
        service_codes: [USPS_GROUND_ADVANTAGE],
      },
      shipment: {
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
          name: 'Customer',
          address_line1: address.street,
          city_locality: address.city,
          state_province: address.state,
          postal_code: address.zip,
          country_code: address.country || 'US',
        },
        packages,
      },
    }),
  });

  const data = await shipstationRes.json();
  if (!shipstationRes.ok) {
    return new Response(JSON.stringify({ error: 'Could not get a shipping rate. Try again in a moment.' }), { status: 502 });
  }

  const [rate] = data.rate_response?.rates || [];
  if (!rate) {
    return new Response(JSON.stringify({ error: 'No shipping options found for that address.' }), { status: 404 });
  }

  return new Response(
    JSON.stringify({
      shippingCents: Math.round(rate.shipping_amount.amount * HANDLING_MARKUP * 100),
      carrier: rate.carrier_friendly_name,
      service: rate.service_type,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
};
