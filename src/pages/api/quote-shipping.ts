import type { APIRoute } from 'astro';
import products from '../../data/products.json';

export const prerender = false;

const SHIP_FROM = {
  name: 'Faithful Journey Solar',
  addressLine1: import.meta.env.SHIP_FROM_STREET || '',
  cityLocality: import.meta.env.SHIP_FROM_CITY || '',
  stateProvince: import.meta.env.SHIP_FROM_STATE || '',
  postalCode: import.meta.env.SHIP_FROM_ZIP || '',
  countryCode: import.meta.env.SHIP_FROM_COUNTRY || 'US',
};

interface CartItemInput {
  slug: string;
  quantity: number;
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
    const product = products.find((p) => p.slug === item.slug);
    return sum + (product?.weightOz || 16) * item.quantity;
  }, 0);

  const shipstationRes = await fetch('https://api.shipstation.com/v2/rates', {
    method: 'POST',
    headers: {
      'API-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      rate_options: {
        carrier_ids: [],
      },
      shipment: {
        ship_from: {
          name: SHIP_FROM.name,
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
        packages: [
          {
            weight: {
              value: totalWeightOz,
              unit: 'ounce',
            },
          },
        ],
      },
    }),
  });

  const data = await shipstationRes.json();
  if (!shipstationRes.ok) {
    return new Response(JSON.stringify({ error: 'Could not get a shipping rate. Try again in a moment.' }), { status: 502 });
  }

  const rates = data.rate_response?.rates || [];
  if (rates.length === 0) {
    return new Response(JSON.stringify({ error: 'No shipping options found for that address.' }), { status: 404 });
  }

  const cheapest = rates.reduce((best: any, rate: any) =>
    rate.shipping_amount.amount < best.shipping_amount.amount ? rate : best
  );

  return new Response(
    JSON.stringify({
      shippingCents: Math.round(cheapest.shipping_amount.amount * 100),
      carrier: cheapest.carrier_friendly_name,
      service: cheapest.service_type,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
};
