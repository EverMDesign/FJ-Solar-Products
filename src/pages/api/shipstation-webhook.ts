import type { APIRoute } from 'astro';

export const prerender = false;

// ShipStation webhook events we care about
const SHIPMENT_SHIPPED = 'shipmentshipped';

interface ShipStationWebhookPayload {
  resource_type: string;
  resource_url?: string;
  event?: string;
  shipment_id?: number;
  external_shipment_id?: string; // This is our GHL Opportunity ID
}

export const POST: APIRoute = async ({ request }) => {
  const PIT_TOKEN = import.meta.env.PIT_TOKEN;
  const LOCATION_ID = import.meta.env.LOCATION_ID;
  const API_BASE = import.meta.env.GHL_API_BASE || 'https://services.leadconnectorhq.com';

  try {
    const body = await request.json();
    const payload = body as ShipStationWebhookPayload;

    // Only process shipment shipped events
    if (payload.resource_type !== SHIPMENT_SHIPPED) {
      return new Response(JSON.stringify({ message: 'Event ignored' }), { status: 200 });
    }

    // external_shipment_id format: "FJSP-XXXXX" — order number only
    const orderNumber = payload.external_shipment_id;
    if (!orderNumber) {
      console.warn('ShipStation webhook: no external_shipment_id found', payload);
      return new Response(JSON.stringify({ error: 'No order number' }), { status: 400 });
    }

    // TODO: To update GHL when shipment ships, we need to look up the opportunity by order number
    // (could add GHL search/filter by custom field, or store mapping in a database).
    // For now, shipment status is manually tracked in ShipStation and GHL.

    console.log(`Shipment received for order ${orderNumber}`);
    return new Response(JSON.stringify({ success: true, orderNumber }), { status: 200 });
  } catch (err) {
    console.error('ShipStation webhook error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
};
