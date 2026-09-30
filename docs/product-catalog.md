# Product Catalog

How products get from GoHighLevel (GHL) onto the site, and how they're displayed.

## Backend: GHL → `products.json`

**This is manual, not automatic.** Someone has to run:

```bash
npm run fetch-products
```

That runs `scripts/fetch-products.mjs`, which:

1. Reads `PIT_TOKEN` and `LOCATION_ID` from `.env`
2. Calls GHL's Products API (`GET /products/`) to list everything, keeping only products where `status === 'active'` and `availableInStore !== false`
3. For each product, fetches full details + prices, picks the lowest price if there are several
4. Writes the result to `src/data/products.json`

**Fields preserved across runs** (the script won't overwrite these if they're already set): `brand` and `weightOz`. Everything else gets refreshed from GHL every run. This matters because:
- `brand` defaults to `"Victron"` if the name contains "Victron", else `"FJ Solar"` — wrong guesses need a one-time manual fix in `products.json`, which then sticks
- `weightOz` defaults to `16` (a placeholder) — real ShipStation rates depend on this being correct per product

### Inventory (not wired in yet)

GHL genuinely supports inventory tracking — confirmed by pulling a real product from the account, not just reading docs. Each product has `trackProductInventory` (on/off), and each price has `availableQuantity` and `allowOutOfStockPurchases`. All current products have tracking OFF.

**To use this:** `fetch-products.mjs` needs to also pull those 3 fields into `products.json`, and the product card / product page need to show "Out of Stock" when quantity hits 0. Not built yet — see `TODO.md`.

### The auto-refresh problem

Right now, if a price changes in GHL, the live site doesn't know until someone runs `fetch-products` and the site redeploys. Planned fix (not built): a scheduled GitHub Action checks GHL every 15 minutes and pings a Vercel Deploy Hook if anything changed. Blocked on this project being a git repo connected to GitHub.

## Frontend: displaying products

- **Homepage** (`src/pages/index.astro`): imports `products.json` directly (build-time, not a fetch), renders the first product as the hero's "featured" card, and maps the rest into a grid using `ProductCard.astro`. Client-side JS handles the brand filter buttons and "Show More" (everything past the first 6 starts hidden).
- **`ProductCard.astro`** (`src/components/ProductCard.astro`): one product tile. Takes the product fields as props, renders the "Add to cart" `+` button with `data-*` attributes that `src/lib/cart.ts`'s click handler reads.
- **Product detail page** (`src/pages/products/[slug].astro`): one static page per product, generated at build time via `getStaticPaths()` off `products.json`. Shows the full description, image gallery, and either an "Add to Cart" button (if priced) or a `mailto:` link (if `price` is `null` — GHL products can be priceless/quote-only).

## Data shape (`src/data/products.json`)

```ts
{
  id: string;              // GHL product _id
  slug: string;             // generated from name, used in URLs
  name: string;
  brand: "FJ Solar" | "Victron";
  description: string;
  image: string;             // primary image URL
  images: string[];          // full gallery
  price: number | null;      // null = "Contact for price"
  priceLabel: string;
  currency: string;
  hasMultiplePrices: boolean;
  weightOz: number;          // for ShipStation — see caveat above
}
```
