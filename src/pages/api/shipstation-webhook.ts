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

    // external_shipment_id format: "FJSP-XXXXX|opportunityId" — order number | GHL opportunity ID
    const externalId = payload.external_shipment_id;
    if (!externalId) {
      console.warn('ShipStation webhook: no external_shipment_id found', payload);
      return new Response(JSON.stringify({ error: 'No opportunity ID' }), { status: 400 });
    }

    const [orderNumber, opportunityId] = externalId.split('|');
    if (!opportunityId) {
      console.warn('ShipStation webhook: malformed external_shipment_id', externalId);
      return new Response(JSON.stringify({ error: 'Malformed opportunity ID' }), { status: 400 });
    }

    // Update the GHL Opportunity to "Completed" status
    const updateRes = await fetch(`${API_BASE}/opportunities/${opportunityId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${PIT_TOKEN}`,
        Version: '2021-07-28',
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        locationId: LOCATION_ID,
        status: 'won', // "won" = Completed in GHL
      }),
    });

    if (!updateRes.ok) {
      const errorBody = await updateRes.text();
      console.error('GHL opportunity update failed:', updateRes.status, errorBody);
      return new Response(
        JSON.stringify({ error: 'Could not update opportunity' }),
        { status: 502 }
      );
    }

    console.log(`Opportunity ${opportunityId} marked as shipped (won)`);
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    console.error('ShipStation webhook error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
};
