import type { APIRoute } from 'astro';
import { get } from '@vercel/global-config';

export const prerender = false;

interface BannerState {
  enabled: boolean;
  message: string;
  type: 'sale' | 'info' | 'system';
}

const DEFAULT_BANNER: BannerState = { enabled: false, message: '', type: 'info' };
const BANNER_KEY = 'banner';

export const GET: APIRoute = async () => {
  let banner: BannerState = DEFAULT_BANNER;
  try {
    const stored = await get<BannerState>(BANNER_KEY);
    if (stored) banner = stored;
  } catch {
    // Global Config isn't connected to this project yet — banner just stays off until it is.
  }
  return new Response(JSON.stringify(banner), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
};

export const POST: APIRoute = async ({ request }) => {
  const LOCATION_ID = import.meta.env.LOCATION_ID;
  const VERCEL_API_TOKEN = import.meta.env.VERCEL_API_TOKEN;
  const GLOBAL_CONFIG_ID = import.meta.env.GLOBAL_CONFIG_ID;
  const VERCEL_TEAM_ID = import.meta.env.VERCEL_TEAM_ID;

  const body = await request.json();

  // Same gate as the admin page itself: only a request carrying the real GHL
  // location ID (auto-filled by GHL's Custom Menu Link) is allowed to write.
  if (!LOCATION_ID || body.locationId !== LOCATION_ID) {
    return new Response(JSON.stringify({ error: 'Not authorized.' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!VERCEL_API_TOKEN || !GLOBAL_CONFIG_ID) {
    return new Response(
      JSON.stringify({ error: 'Banner storage is not connected yet — ask your developer to finish setup.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const banner: BannerState = {
    enabled: Boolean(body.enabled),
    message: String(body.message || '').slice(0, 200),
    type: (['sale', 'info', 'system'] as const).includes(body.type) ? body.type : 'info',
  };

  const teamQuery = VERCEL_TEAM_ID ? `?teamId=${VERCEL_TEAM_ID}` : '';
  const res = await fetch(`https://api.vercel.com/v1/edge-config/${GLOBAL_CONFIG_ID}/items${teamQuery}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${VERCEL_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ items: [{ operation: 'upsert', key: BANNER_KEY, value: banner }] }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    console.error('Global Config banner update failed:', res.status, errorBody);
    return new Response(JSON.stringify({ error: 'Could not save the banner. Try again.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true, banner }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
