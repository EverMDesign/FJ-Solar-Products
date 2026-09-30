/**
 * FJ Solar Store — pulls products + prices from GHL and writes src/data/products.json.
 * Keeps any checkoutUrl values already saved in that file, since GHL has no API for those —
 * you paste them in by hand after creating a Payment Link in GHL (Payments > Payment Links).
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const idx = line.indexOf('=');
  if (idx > 0) {
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key && value && !key.startsWith('#')) env[key] = value;
  }
});

const PIT_TOKEN = env.PIT_TOKEN;
const LOCATION_ID = env.LOCATION_ID;
const API_BASE = env.GHL_API_BASE || 'https://services.leadconnectorhq.com';

const headers = {
  Authorization: `Bearer ${PIT_TOKEN}`,
  Version: '2021-07-28',
  Accept: 'application/json',
};

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function listProducts() {
  const res = await fetch(`${API_BASE}/products/?locationId=${LOCATION_ID}&limit=100`, { headers });
  const data = await res.json();
  if (!res.ok) throw new Error(`List products failed: ${JSON.stringify(data)}`);
  return data.products || [];
}

async function getProduct(id) {
  const res = await fetch(`${API_BASE}/products/${id}?locationId=${LOCATION_ID}`, { headers });
  const data = await res.json();
  if (!res.ok) throw new Error(`Get product ${id} failed: ${JSON.stringify(data)}`);
  return data;
}

async function getPrices(id) {
  const res = await fetch(`${API_BASE}/products/${id}/price?locationId=${LOCATION_ID}`, { headers });
  const data = await res.json();
  if (!res.ok) throw new Error(`Get prices for ${id} failed: ${JSON.stringify(data)}`);
  return data.prices || [];
}

async function main() {
  console.log('=== FJ Solar — fetching products from GHL ===\n');

  const outputPath = path.join(__dirname, '..', 'src', 'data', 'products.json');
  let existing = [];
  if (fs.existsSync(outputPath)) {
    existing = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
  }
  const existingById = new Map(existing.map(p => [p.id, p]));

  const summaries = await listProducts();
  // Exclude only products explicitly marked unavailable for the store (e.g. internal
  // items like a "Security Deposit" placeholder). Missing the field entirely still counts as available.
  const activeSummaries = summaries.filter(p => p.status === 'active' && p.availableInStore !== false);
  const results = [];

  for (const summary of activeSummaries) {
    console.log(`Fetching: ${summary.name}`);
    const [full, prices] = await Promise.all([getProduct(summary._id), getPrices(summary._id)]);

    const sortedPrices = [...prices].sort((a, b) => a.amount - b.amount);
    const lowestPrice = sortedPrices[0] || null;

    const previous = existingById.get(full._id);
    // Default guess: anything named "Victron ..." is a Victron product, everything
    // else is one of FJ Solar's own items. Override by hand in products.json if wrong —
    // that override is kept on every future run.
    const defaultBrand = full.name.includes('Victron') ? 'Victron' : 'FJ Solar';

    results.push({
      id: full._id,
      slug: slugify(full.name),
      name: full.name,
      brand: previous?.brand || defaultBrand,
      description: full.description || '',
      image: full.image || '',
      images: (full.medias || []).map(m => m.url),
      price: lowestPrice ? lowestPrice.amount : null,
      priceLabel: lowestPrice ? lowestPrice.name : '',
      currency: lowestPrice ? lowestPrice.currency : 'USD',
      hasMultiplePrices: prices.length > 1,
      // Needed for real ShipStation shipping quotes. GHL doesn't store product weight,
      // so this starts as a placeholder — correct it by hand once, it's kept on every future run.
      weightOz: previous?.weightOz ?? 16,
    });
  }

  results.sort((a, b) => a.name.localeCompare(b.name));

  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2) + '\n');
  console.log(`\n✓ Saved ${results.length} products → ${outputPath}`);

  const placeholderWeights = results.filter(p => p.weightOz === 16);
  if (placeholderWeights.length > 0) {
    console.log(`\n⚠ ${placeholderWeights.length} product(s) still have a placeholder weight (16oz) — correct these for real shipping rates:`);
    placeholderWeights.forEach(p => console.log(`  - ${p.name} (${p.slug})`));
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
