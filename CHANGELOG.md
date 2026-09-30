# Changelog

All notable changes to this project, newest first. Dates are when the work happened, not a formal release schedule — this is a live site, not a versioned package.

## 2026-09-30

### Changed
- **Removed Stripe, replaced with Authorize.net (scaffolding, not tested).** Client runs Authorize.net on his real business and wants this site to match — done ahead of time with blank credentials, the same way Stripe originally sat unconfigured, not a live cutover:
  - Deleted `src/pages/api/create-checkout-session.ts` and `src/pages/api/stripe-webhook.ts`
  - Added `src/pages/api/create-authorize-session.ts` (builds an Authorize.net Accept Hosted session) and `src/pages/api/authorize-webhook.ts` (verifies the webhook signature, syncs the buyer to GHL)
  - `cart.astro`'s checkout button now POSTs a hidden form to Authorize.net's hosted page instead of redirecting to a Stripe URL — different mechanism, Authorize.net doesn't support a plain redirect
  - Removed the `stripe` npm package entirely
  - Swapped `STRIPE_*` env vars for `AUTHORIZE_NET_*` ones
  - **Not verified against a real Authorize.net account** — no sandbox credentials existed when this was built. The webhook's assumed response field names for customer/billing info are the single biggest unverified piece — see `docs/checkout.md`
- Planned (not built): GHL-sourced coupon codes, validated server-side and folded into the checkout session amount — see `TODO.md`

### Added
- Site-wide announcement banner feature, end to end:
  - Admin toggle page at `/banner-ctrl-9f3k7q2z`, gated by GHL Location ID so only a link clicked from inside GHL opens it — no password needed
  - `/api/banner` — reads/writes banner state to Vercel Global Config
  - Banner bar wired into every page via `Layout.astro`
  - 3 banner types with distinct colors: Sale (green), Info (blue), System (amber)
- Vercel Global Config store created and connected to the project for banner storage
- `README.md`, `CHANGELOG.md`, this project's `CLAUDE.md`, and the `docs/` folder
- `.claude/commands/changelog.md` — new `/changelog` slash command that adds a properly formatted, dated entry to this file on request
- `CLAUDE.md`: new "At the start of every session" rule — every session in this project now reads `TODO.md` and lists its open items before doing anything else, so there's always something to pick from without digging through the file manually

### Fixed
- Production deploy was failing (`invalid runtime: nodejs18.x`) because `package.json`'s `engines.node` was set to `24.x`, which the installed `@astrojs/vercel@7.8.2` adapter doesn't recognize, so it silently fell back to a Node version Vercel no longer supports. Changed to `20.x`.

### Deployed
- First-ever production deployment of this project, to `https://fj-solar-products.vercel.app` (custom domain `shop.faithfuljourneysolar.com` not connected yet)
- Vercel project env vars set: `PIT_TOKEN`, `LOCATION_ID`, `GHL_API_BASE`, `VERCEL_API_TOKEN`, `GLOBAL_CONFIG_ID`, `GLOBAL_CONFIG` (auto-added)

### Planning
- Decided to hold off deploying the Stripe → Authorize.net swap — the live site at `fj-solar-products.vercel.app` still runs the previous, Stripe-based build, unchanged. Added an explicit "⚠ DO NOT DEPLOY" checklist at the very top of `TODO.md` (real/sandbox Authorize.net credentials, a fresh local build check, and a full smoke test) so this isn't accidentally shipped half-verified
- Scoped a GHL-sourced coupon feature: validate codes server-side against GHL's real `GET /payments/coupon` endpoint (confirmed via their docs, not assumed), fold the discount into the Authorize.net session before the hosted page loads. Noted limitation: GHL's coupon API has no redeem/usage-tracking endpoint, so a strict per-customer limit can't be fully enforced through the API alone

## 2026-09-29

### Changed
- Full homepage redesign, based on a client-approved mockup: new hero, featured product card, filterable product grid, "not sure what you need" trust section
- New brand color palette added (`fj-navy`, `fj-navy-deep`, `fj-green`, `fj-green-deep`, `fj-cream`, `fj-sand`, `fj-gold`) alongside the old `navy-*`/`solar-*` tokens
- Montserrat added as the heading font (Inter stays for body text)
- Header and footer (`Layout.astro`) reskinned — affects every page, not just home
- Product detail page (`src/pages/products/[slug].astro`) and cart page (`src/pages/cart.astro`) reskinned to match
- New slide-out cart drawer (`src/components/CartDrawer.astro`) — quick preview, "View Cart & Checkout" still routes to `/cart/` for the real shipping-rate + Stripe flow
- Extracted `ProductCard.astro` component instead of repeating card markup inline

### Fixed
- `.gitignore` was missing `.vercel/`, `.DS_Store`, `*.log`, and local env variants — added before first commit

### Planning
- Reviewed client feedback call: confirmed GHL already supports real inventory tracking (`trackProductInventory`, `availableQuantity`, `allowOutOfStockPurchases`) — no custom stock tool needed, just needs GHL's own toggle turned on per product (not wired into the sync script yet)
- Decided: Authorize.net swap happens last, right before cutover (client's own current site depends on the same live key)
- Decided: GHL → site sync should auto-check every 15 minutes once this project is on GitHub (not done yet — see `TODO.md`)
