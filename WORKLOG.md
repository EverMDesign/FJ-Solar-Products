# FJ_Solar — Work Log

A running log of work sessions, changes, and decisions for this project.

---

## 2026-10-01 — 07:50

Shipping went live (USPS Ground Advantage + 30% markup + ParcelGuard insurance pass-through), product variants pulled from GHL with a weight-unit conversion fix, Florida sales tax added (7.5%, FL-to-FL only, verified against the official DOR rate table), migrated Astro 4->7 and the Vercel adapter 7->11 for Node 24 support, header/footer cleanup with Facebook links added, fixed the cart's dollars-shown-as-cents price bug in two separate spots, and explored then fully reverted a fake test-mode checkout per Andrew's request

**Files:** scripts/fetch-products.mjs, src/data/products.json, src/lib/tax.ts, src/pages/api/quote-shipping.ts, src/pages/api/create-authorize-session.ts, src/pages/cart.astro, src/components/CartDrawer.astro, src/components/ProductCard.astro, src/lib/cart.ts, src/pages/products/[slug].astro, src/pages/index.astro, src/layouts/Layout.astro, astro.config.mjs, package.json, postcss.config.mjs, docs/deployment.md, CLAUDE.md, CHANGELOG.md

**Status:** ✅ Complete
**Next Steps:** Waiting on Andrew for a freshly regenerated GHL Private Integration token (to retest the automatic-tax API one more time) and for Authorize.net sandbox credentials (to test real checkout and verify the hosted page actually collects name/email/phone before trusting the GHL contact sync).

---

## 2026-10-27 — 11:39

Mapped Andrew's WooCommerce order flow to the new site and closed the first gap: authorize-webhook.ts now tags contacts fjsp-new-order and auto-creates a GHL Opportunity in the FJ Solar Products Orders pipeline (New Order stage) with the order amount attached. Built 3 branded HTML email templates (new-order alert to Andrew, customer thank-you w/ install docs, delayed review-request follow-up) and delivered them to the client Drive's Email_Templates folder. Created REVISIT.md tracking the full order-flow checklist against Andrew's WooCommerce walkthrough, plus transcribed and cross-referenced his punch-list PDF against the live codebase — confirmed only the AGS onboard-generator variants have correct weight/box dimensions; the other 7 products are still on placeholder data, which is actively skewing their shipping costs.

**Files:** src/pages/api/authorize-webhook.ts, docs/checkout.md, REVISIT.md, CLAUDE.md

**Status:** ✅ Complete
**Next Steps:** Create the GHL custom fields for per-order data (order total, line items, product docs/video links) and the review_link custom value; fix the templates' merge syntax to match; verify/fix product weights+dimensions for the 7 non-AGS products

---
