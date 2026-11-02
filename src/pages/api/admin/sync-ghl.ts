import type { APIRoute } from 'astro';
import * as fs from 'fs';
import * as path from 'path';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const LOCATION_ID = import.meta.env.LOCATION_ID;
  const body = await request.json();

  // Same gate as the admin page: only a request carrying the real GHL location ID
  if (!LOCATION_ID || body.locationId !== LOCATION_ID) {
    return new Response(
      JSON.stringify({ error: 'Not authorized.' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const output = await fetchAndSyncProducts();

    // Parse output for summary
    const productsMatch = output.match(/✓ Saved (\d+) products/);
    const productCount = productsMatch ? parseInt(productsMatch[1], 10) : 0;

    const placeholderMatch = output.match(/⚠ (\d+) product\(s\) still have a placeholder weight/);
    const placeholderCount = placeholderMatch ? parseInt(placeholderMatch[1], 10) : 0;

    return new Response(
      JSON.stringify({
        success: true,
        productCount,
        placeholderWeights: placeholderCount,
        output,
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Unknown error';
    console.error('Sync error:', errMsg);
    return new Response(
      JSON.stringify({
        success: false,
        error: errMsg,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

async function fetchAndSyncProducts(): Promise<string> {
  let output = '';
  const log = (msg: string) => {
    output += msg + '\n';
    console.log(msg);
  };

  const PIT_TOKEN = import.meta.env.PIT_TOKEN;
  const GHL_LOCATION_ID = import.meta.env.LOCATION_ID;
  const API_BASE = import.meta.env.GHL_API_BASE || 'https://services.leadconnectorhq.com';

  if (!PIT_TOKEN || !GHL_LOCATION_ID) {
    throw new Error('Missing GHL credentials (PIT_TOKEN or LOCATION_ID)');
  }

  const headers = {
    Authorization: `Bearer ${PIT_TOKEN}`,
    Version: '2021-07-28',
    Accept: 'application/json',
  };

  log('=== FJ Solar — fetching products from GHL ===\n');

  // Fetch products list from GHL
  const listRes = await fetch(`${API_BASE}/products/?locationId=${GHL_LOCATION_ID}&limit=100`, { headers });
  if (!listRes.ok) {
    throw new Error(`GHL list products failed: ${listRes.status}`);
  }

  const listData = (await listRes.json()) as any;
  const summaries = listData.products || [];
  const activeSummaries = summaries.filter((p: any) => p.status === 'active' && p.availableInStore !== false);

  // Load existing products to preserve checkoutUrl and brand overrides
  // In Vercel serverless, the root is always /var/task
  // In local dev, use process.cwd()
  const root = process.cwd().startsWith('/var/task') ? '/var/task' : process.cwd();
  const productsPath = path.join(root, 'src/data/products.json');
  let existingById = new Map<string, any>();

  if (fs.existsSync(productsPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(productsPath, 'utf-8'));
      if (Array.isArray(existing)) {
        existingById = new Map(existing.map((p: any) => [p.id, p]));
      }
    } catch (e) {
      log(`Warning: Could not read existing products.json`);
    }
  }

  const results = [];

  // Fetch detailed info for each product
  for (const summary of activeSummaries) {
    log(`Fetching: ${summary.name}`);

    try {
      const [detailRes, pricesRes] = await Promise.all([
        fetch(`${API_BASE}/products/${summary._id}?locationId=${GHL_LOCATION_ID}`, { headers }),
        fetch(`${API_BASE}/products/${summary._id}/price?locationId=${GHL_LOCATION_ID}`, { headers }),
      ]);

      if (!detailRes.ok || !pricesRes.ok) {
        log(`  Warning: Could not fetch details for ${summary.name}`);
        continue;
      }

      const detail = (await detailRes.json()) as any;
      const priceData = (await pricesRes.json()) as any;
      const prices = priceData.prices || [];
      const lowestPrice = prices.length > 0 ? prices.sort((a: any, b: any) => a.amount - b.amount)[0] : null;

      const previous = existingById.get(detail._id);
      const defaultBrand = detail.name.includes('Victron') ? 'Victron' : 'FJ Solar';

      results.push({
        id: detail._id,
        slug: detail.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
        name: detail.name,
        brand: previous?.brand || defaultBrand,
        description: detail.description || '',
        image: detail.image || '',
        images: (detail.medias || []).map((m: any) => m.url),
        price: lowestPrice ? lowestPrice.amount : null,
        priceLabel: lowestPrice ? lowestPrice.name : '',
        currency: lowestPrice ? lowestPrice.currency : 'USD',
        hasMultiplePrices: prices.length > 1,
        ...(lowestPrice?.sku ? { sku: lowestPrice.sku } : {}),
        weightOz: previous?.weightOz ?? 16,
        checkoutUrl: previous?.checkoutUrl || '',
        ...( (previous?.variantGroups || previous?.variants) ? {
          variantGroups: previous.variantGroups,
          variants: previous.variants,
        } : {}),
      });
    } catch (e) {
      log(`  Error fetching ${summary.name}: ${e instanceof Error ? e.message : 'unknown'}`);
    }
  }

  // Sort and save
  results.sort((a: any, b: any) => a.name.localeCompare(b.name));

  try {
    const outputDir = path.dirname(productsPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    fs.writeFileSync(productsPath, JSON.stringify(results, null, 2) + '\n');
  } catch (e) {
    throw new Error(`Failed to write products.json: ${e instanceof Error ? e.message : 'unknown'}`);
  }

  log(`\n✓ Saved ${results.length} products → ${productsPath}`);

  const placeholderWeights = results.filter((p: any) => p.weightOz === 16);
  if (placeholderWeights.length > 0) {
    log(`\n⚠ ${placeholderWeights.length} product(s) still have a placeholder weight (16oz) — correct these for real shipping rates:`);
    placeholderWeights.forEach((p: any) => log(`  - ${p.name} (${p.slug})`));
  }

  return output;
}
