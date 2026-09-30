# Faithful Journey Solar — Store

Astro storefront for Faithful Journey Solar. Product data comes from GoHighLevel (GHL), checkout runs through Authorize.net (scaffolded, untested — no credentials yet), and shipping rates come from ShipStation.

## Tech stack

- **Framework**: Astro 4 (hybrid output — most pages are static, a few API routes are server-rendered)
- **Styling**: Tailwind CSS, custom brand tokens (`fj-*`) — see [`docs/design-system.md`](docs/design-system.md)
- **Hosting**: Vercel (`fj-solar-products` project)
- **Cart**: client-side, `localStorage` — see [`docs/cart.md`](docs/cart.md)
- **Payments**: Authorize.net Accept Hosted (scaffolded, untested) — see [`docs/checkout.md`](docs/checkout.md)
- **Product data**: pulled from GHL, see [`docs/product-catalog.md`](docs/product-catalog.md)
- **Site banner**: Vercel Global Config — see [`docs/site-banner.md`](docs/site-banner.md)

## Quick start

```bash
npm install
npm run dev          # http://localhost:4321
```

You'll need a `.env` file — copy the keys listed in `.env` already in the repo (values are secret, ask Ever for them, never commit real values). See [`docs/deployment.md`](docs/deployment.md) for which ones matter where.

## Common commands

| Command | What it does |
|---|---|
| `npm run dev` | Local dev server |
| `npm run build` | Production build (also what Vercel runs) |
| `npm run preview` | Preview the production build locally |
| `npm run fetch-products` | Pull the latest products/prices from GHL into `src/data/products.json` — **manual**, not automatic yet |

## Where things live

- `src/pages/` — every route (including API routes under `src/pages/api/`)
- `src/components/` — reusable pieces (`ProductCard`, `CartDrawer`)
- `src/layouts/Layout.astro` — shared header/footer/banner, wraps every page
- `src/lib/cart.ts` — all cart read/write logic
- `src/data/products.json` — the product catalog (generated, don't hand-edit except brand/weight overrides — see product-catalog doc)
- `scripts/fetch-products.mjs` — the GHL → `products.json` sync script

## Full documentation

- [`docs/product-catalog.md`](docs/product-catalog.md) — how products get from GHL onto the site
- [`docs/cart.md`](docs/cart.md) — the cart system (storage, drawer, cart page)
- [`docs/checkout.md`](docs/checkout.md) — Authorize.net checkout (scaffolded, untested), shipping rates, GHL contact sync
- [`docs/site-banner.md`](docs/site-banner.md) — the site-wide announcement banner and its admin page
- [`docs/design-system.md`](docs/design-system.md) — brand colors, fonts, component conventions
- [`docs/deployment.md`](docs/deployment.md) — Vercel project, every env var and what it's for, domains

See also `TODO.md` for the live punch list of what's done vs. still needed, and `CHANGELOG.md` for a dated history of what's shipped.
