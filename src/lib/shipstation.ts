import products from '../data/products.json';

export const SHIP_FROM = {
  name: 'Faithful Journey Solar',
  phone: import.meta.env.SHIP_FROM_PHONE || '',
  addressLine1: import.meta.env.SHIP_FROM_STREET || '',
  cityLocality: import.meta.env.SHIP_FROM_CITY || '',
  stateProvince: import.meta.env.SHIP_FROM_STATE || '',
  postalCode: import.meta.env.SHIP_FROM_ZIP || '',
  countryCode: import.meta.env.SHIP_FROM_COUNTRY || 'US',
};

// Andrew's standard shipping (confirmed 2026-10-01): USPS Ground Advantage for US,
// USPS Priority Mail International for Canada. No carrier choice shown to customer.
// Expedited (FedEx/UPS) is a planned later addition, not built yet.
export const USPS_CARRIER_ID = 'se-4619801';
export const USPS_GROUND_ADVANTAGE = 'usps_ground_advantage';
export const USPS_PRIORITY_MAIL_INTERNATIONAL = 'usps_priority_mail_international';

// GHL stores dimension units abbreviated ("in", "cm") — ShipStation's API rejects
// anything but the full word ("inch", "centimeter").
export const DIMENSION_UNITS: Record<string, string> = { in: 'inch', cm: 'centimeter' };

// Authorize.net truncates lineItem.itemId (our product slug) to 31 characters when we send
// it in create-authorize-session.ts — several real slugs here are longer than that (e.g.
// "auto-generator-start-onboard-generators" is 40 chars), so a transaction response's itemId
// never equals the full slug for those products. Compare against the same truncation instead
// of exact equality, or lookups silently fail for every product with a slug over 31 chars.
export function findProductBySlugPrefix(itemId: string) {
  return products.find((p) => p.slug.slice(0, 31) === itemId);
}

const US_STATE_ABBREVIATIONS: Record<string, string> = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA',
  colorado: 'CO', connecticut: 'CT', delaware: 'DE', florida: 'FL', georgia: 'GA',
  hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA',
  kansas: 'KS', kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD',
  massachusetts: 'MA', michigan: 'MI', minnesota: 'MN', mississippi: 'MS', missouri: 'MO',
  montana: 'MT', nebraska: 'NE', nevada: 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ',
  'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH',
  oklahoma: 'OK', oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT',
  virginia: 'VA', washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY',
  'district of columbia': 'DC', 'puerto rico': 'PR',
};

// Authorize.net's hosted-page "State" field (both Billing and Shipping sections) is a plain
// free-text input, not a dropdown locked to 2-letter codes — our own /cart/ form enforces
// maxlength=2, but customers type their state directly into Authorize.net's own page, which
// doesn't. ShipStation's API rejects anything but a 2-letter code for a US address (real bug
// hit 2026-10-29: "Texas" instead of "TX" broke shipment creation entirely). Normalizes full
// state names to their abbreviation; non-US addresses and already-short values pass through.
export function normalizeUsState(state: string, countryCode: string): string {
  if (countryCode !== 'US' || !state) return state;
  const trimmed = state.trim();
  if (trimmed.length <= 2) return trimmed.toUpperCase();
  const abbreviation = US_STATE_ABBREVIATIONS[trimmed.toLowerCase()];
  if (abbreviation) return abbreviation;
  console.error('normalizeUsState: unrecognized state name, using first 2 characters as a last resort', state);
  return trimmed.slice(0, 2).toUpperCase();
}
