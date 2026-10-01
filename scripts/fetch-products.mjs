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

// GHL stores shipping weight per price (variant) as { value, unit }. Convert to ounces
// since that's the unit ShipStation calls expect everywhere in this codebase.
function ozFromWeight(weight) {
  if (!weight || typeof weight.value !== 'number') return null;
  switch (weight.unit) {
    case 'lb': {
      // Andrew enters this as pounds.ounces (e.g. 1.13 = "1 lb 13 oz"), not true decimal
      // pounds — confirmed 2026-10-01 after a real ShipStation rate mismatch traced back
      // to this. 1.13 is NOT 1.13lb (18.08oz); it's 16oz + 13oz = 29oz.
      const wholePounds = Math.trunc(weight.value);
      let ouncesPart = Math.round((Math.abs(weight.value) - Math.abs(wholePounds)) * 100);
      let totalWholePounds = wholePounds;
      if (ouncesPart >= 16) {
        totalWholePounds += Math.floor(ouncesPart / 16);
        ouncesPart %= 16;
      }
      return totalWholePounds * 16 + ouncesPart;
    }
    case 'kg': return Math.round(weight.value * 35.274 * 100) / 100;
    case 'g': return Math.round(weight.value * 0.035274 * 100) / 100;
    case 'oz':
    default:
      return weight.value;
  }
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

    // Real GHL variants (e.g. "Signal Type": Negative/Positive) carry their own price and,
    // when Andrew has set it, their own shipping weight + box dimensions per option.
    const variantPrices = prices.filter(p => (p.variantOptionIds || []).length > 0);
    const variants = variantPrices.map(p => {
      const prevVariant = previous?.variants?.find(v => v.optionId === p.variantOptionIds[0]);
      return {
        optionId: p.variantOptionIds[0],
        name: p.name.trim(),
        price: p.amount,
        weightOz: ozFromWeight(p.shippingOptions?.weight) ?? prevVariant?.weightOz ?? 16,
        dimensions: p.shippingOptions?.dimensions || prevVariant?.dimensions || null,
      };
    });
    const variantGroupName = full.variants?.[0]?.name?.trim() || null;

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
      // Needed for real ShipStation shipping quotes. Pulled from GHL's per-price shippingOptions
      // when Andrew has set it; otherwise a placeholder kept across runs — correct it by hand once.
      weightOz: variants[0]?.weightOz ?? ozFromWeight(lowestPrice?.shippingOptions?.weight) ?? previous?.weightOz ?? 16,
      ...(variants.length > 0 ? { variantGroupName, variants } : {}),
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
