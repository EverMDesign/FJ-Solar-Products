# FJ Solar Store — Revisit / To-Do

Items to address in future sessions.

---

## Order Flow — ShipStation → GHL Opportunity Sync

- [x] **A real, correlated ShipStation shipment is now created on every sale (2026-10-29).** `authorize-webhook.ts`'s `createShipStationShipment()` fires right after the GHL Opportunity is created — real customer name/email/address (from the transaction's `billTo`/`customer.email`), real weight/dimensions (matched from `products.json` against the transaction's line items), tagged with the GHL Opportunity id via **`external_shipment_id`** (not `external_order_id` — verified against the real API: `external_order_id` is a different field, for an order record in ShipStation's own UI, not for linking to our system). Verified the full request/response shape with a real test call against the live ShipStation API (`POST /v2/shipments` → `shipment_id`, `has_errors`, `external_shipment_id` echoed back correctly), then cancelled that test shipment. Does **not** purchase a label — Andrew still creates those manually in ShipStation, matching his existing flow.
  - Shared constants (`SHIP_FROM`, USPS carrier/service codes, dimension-unit mapping) extracted to `src/lib/shipstation.ts`, used by both `quote-shipping.ts` and the webhook.
  - Found and fixed a real latent bug while building this: Authorize.net truncates `lineItem.itemId` (our product slug) to 31 characters, and 3 of 8 real product slugs are longer than that (e.g. `auto-generator-start-onboard-generators` is 40 chars) — an exact-match product lookup would silently fail for those. `findProductBySlugPrefix()` compares against the same truncation instead.
  - **Still unverified** (needs a real completed transaction): whether `transaction.lineItems`/`billTo`/`customer.email` actually match this assumed shape — same category of unverified assumption flagged elsewhere in `authorize-webhook.ts`, and whether GHL's opportunity-create response really is `data.opportunity.id` (assumed by analogy to the contact upsert's `data.contact.id`, not independently confirmed — writing a test Opportunity to verify was blocked, same as the GHL test-contact attempt).
  - `shipment_status: "label_purchased"` is the real-world equivalent of Andrew's "shipped" trigger from his WooCommerce flow (see `docs/checkout.md` flow steps) — confirmed readable with the existing `SHIPSTATION_API_KEY`.
  - **Still open — auto-advancing the Opportunity when a label is purchased.** This session only closed the "no link exists" gap (the shipment now *has* the Opportunity id on it). Actually moving the Opportunity from New Order → Completed when `shipment_status` becomes `label_purchased` still needs one of:
    1. Poll ShipStation for shipments whose status changed (e.g. a scheduled job), or
    2. Check whether ShipStation's v2 API supports a webhook for shipment status changes, to avoid polling entirely
  - Until that part exists, moving an Opportunity from New Order → Completed is still a fully manual step for Andrew — but the shipment is now at least correctly linked and populated when he does it.

---

## Customs data for international shipping (2026-10-29)

Andrew sent harmonization (HS) codes for two products, toward punch-list items #1/#2
(ship cost calc to Canada + a "contact us" note for other countries):

- [x] Victron MultiPlus-II External Fan Kit — HS code `8414.59.15`, USPS First Class
      International — saved to `products.json` (`hsCode` + `internationalShipping.service`).
- [ ] **Auto Gen Start — HS code `8536.41`, USPS First Class International — not yet saved.**
      There are two Auto Gen Start products (`auto-generator-start-onboard-generators` and
      `auto-generator-start-portable-generators`) and it's unclear which one(s) this code
      applies to. **Ask Andrew**, then add `hsCode: "8536.41"` + the same
      `internationalShipping.service` to whichever product(s) he confirms.
- Note: this is customs reference data only — `quote-shipping.ts` doesn't support
  international addresses at all yet (US-only `USPS Ground Advantage`), so this doesn't
  enable international checkout by itself. Still needed: a non-domestic rate path, customs
  info on the ShipStation shipment request, and the per-product international service
  override (use `internationalShipping.service` instead of the domestic default).

## Full Order Flow Checklist — matching Andrew's WooCommerce walkthrough (2026-10-26)

Andrew walked through how order flow works on his *current* (WooCommerce) site, so the new site can match it. Tracking each piece here so nothing gets dropped. Status as of 2026-10-26:

- [ ] **Customer completes checkout (cart → Authorize.net)** — built, but completely untested. No sandbox credentials exist yet. See `TODO.md`'s Authorize.net checklist.
- [ ] **Authorize.net captures/charges the card** — same as above, built but unverified against a real transaction.
- [x] **Order record created + Andrew notified of a new order** — done this session. `authorize-webhook.ts` tags the GHL contact `fjsp-new-order` and creates a GHL Opportunity in the **FJ Solar Products Orders** pipeline, **New Order** stage, with the dollar amount attached. The `new-order-alert.html` email (in the client Drive's `Email_Templates/` deliverable) is meant to fire off that tag/Opportunity via an EverReach workflow — **the workflow itself still needs to be built in EverReach**, nothing here triggers it automatically yet.
- [ ] **Order syncs to ShipStation so Andrew can create a label** — partially happening, but by accident and not correctly: `quote-shipping.ts`'s rate-quote call creates a real ShipStation shipment as a side effect (every cart that requests a rate, even if they never pay), not a deliberate "this order was paid for" shipment. See the ShipStation → GHL Opportunity Sync section above for the fix needed.
- [x] **Fixed (2026-10-29)**, for the real order shipment: `authorize-webhook.ts`'s `createShipStationShipment()` sets real `ship_to.name`/`.email` from the transaction's `billTo`/`customer.email`. **Still true of `quote-shipping.ts`'s rate-quote shipment** (`name: 'Customer'`, no email) — that one is just for pricing, not meant to be the real shipment Andrew ships from, so it's lower priority now that the real one exists, but worth cleaning up or removing that accidental shipment side effect eventually.
- [ ] **Andrew manually creates the label in ShipStation** — unaffected either way, stays manual, matches his flow as described.
- [ ] **ShipStation "shipped" (`label_purchased`) → Opportunity auto-moves New Order → Completed** — not built. See the ShipStation → GHL Opportunity Sync section above.
- [ ] **On completion: automated thank-you email with install docs/videos** — template exists (`order-thank-you.html`), but nothing triggers it automatically. Needs an EverReach workflow watching for the Opportunity hitting Completed, plus the `product_doc_link`/`product_video_link` custom values populated (blocked on Andrew sending the actual docs/videos per product — tracked in `TODO.md`).
- [ ] **QuickBooks sales receipt on completion** — not built, not referenced anywhere in the codebase. No QuickBooks integration exists at all yet; this was never scoped into the initial build (see `docs/checkout.md`'s "What checkout does NOT do yet").
- [ ] **Delayed (~2–3 week) review-request follow-up email** — template exists (`review-request-followup.html`), but nothing schedules/triggers it. Needs an EverReach workflow with a delay step off the Completed stage, plus the `review_link` custom value populated.

---

## Andrew's Notes — Order Flow + Punch List (as given, 2026-10-27)

Transcribed exactly as Andrew's PDF notes have it — wording, numbering, and highlights preserved. Cross-reference against current status follows each section.

### Website Order Flow (Current)

1. Customer goes to website and adds products to cart
2. Customer checks out
3. Authorize.net handles payment
4. Flat Rate shipping
5. Order is sync'ed to Ship station
6. Order is marked as processing in Woo Commerce
7. I manually go to ship station to create labels & print them
8. Shipstation handles ship notifications to customer
9. Once label has been created Shipstation sends notification to Woo
10. Woo marks order as complete.
11. Email automation sends Thank You email w/ supporting information

8b. Once order is marked as complete order is synced to Quickbooks *(arrow from step 8 — reads as: 10 marks complete → 8b fires QuickBooks sync in parallel with 11)*

This matches the "Full Order Flow Checklist" section above almost exactly — one new detail: Andrew says **4. Flat Rate shipping**, not ShipStation-calculated rates. That's a meaningfully different model from what's built (`quote-shipping.ts` calculates a live USPS rate + markup per address/weight). Worth confirming with Andrew whether he wants flat-rate shipping generally, or just for Victron products specifically (see punch list item 5 below) — right now it reads like his *current* site may be flat-rate across the board, and the live-calculated rate is a new-site-only mechanism.

### Punch List

1. Automated ship cost calculation to US & Canada
2. Put note saying to contact for all other countries
3. Authorize.net Integration
4. Quickbooks order sync
5. Flat Rate ship cost for Victron Products
6. Block sales of Victron products to Canada
7. Update Fan Kit Photos *(highlighted)*
8. Update doc for AGS Instructions *(highlighted)*
9. FJSP Products listed / shown first
10. Inventory Mgt?
11. Youtube Link on website
12. Verify ship calculation cost
13. Abandon cart?
14. Coupon codes for free ship or discount %
15. Min order Quantity to Qualify
16. Limit to certain products
17. Verify FJSP variations, weight, Ship box configured *(highlighted)*

### What we have vs. what we need — cross-referenced against the current codebase

- [ ] **1. Ship cost calc for US & Canada** — US-only right now. `quote-shipping.ts` only requests `USPS Ground Advantage` rates, which is domestic — Canada would need a different ShipStation service/carrier. Not built. Matches the international-shipping gap already flagged back in July's Telegram history.
- [ ] **2. Note for other countries to contact directly** — not built, no such copy exists anywhere on the site.
- [ ] **3. Authorize.net Integration** — already tracked in `TODO.md` and `docs/checkout.md`. Scaffolded, completely untested, blocked on sandbox credentials.
- [ ] **4. QuickBooks order sync** — already tracked above in the Full Order Flow Checklist. Not built, not referenced anywhere in the codebase.
- [ ] **5. Flat Rate ship cost for Victron Products** — not built. Current shipping logic is one calculation path for every product regardless of brand; no per-brand override exists.
- [ ] **6. Block sales of Victron products to Canada** — not built. No geo/brand sales restriction logic anywhere in cart or checkout.
- [ ] **7. Update Fan Kit Photos** *(highlighted)* — content/asset task, not code. `victron-multiplus-ii-external-fan-kit` in `products.json` still has its original photo set from the GHL sync — no indication these were refreshed.
- [ ] **8. Update doc for AGS Instructions** *(highlighted)* — directly the same gap as `product_doc_link` in the email templates — blocked on Andrew sending the actual install doc, tracked in `TODO.md`'s "Product videos" item.
- [ ] **9. FJSP Products listed / shown first** — not built. Checked `index.astro`: the brand filter only toggles visibility (`All` / by brand), there's no sort that puts FJ Solar-brand products ahead of Victron ones in the default "All" view.
- [ ] **10. Inventory Mgt?** — Andrew's own question mark. Already noted in `TODO.md` under the client-call planning section: GHL natively supports `trackProductInventory` / `availableQuantity` / `allowOutOfStockPurchases` per product, but tracking is OFF for all 9 of his products and `scripts/fetch-products.mjs` doesn't pull those fields into `products.json` yet. Nothing new to build until he turns tracking on in GHL.
- [ ] **11. Youtube Link on website** — not built. No YouTube link found in the header/footer/nav.
- [ ] **12. Verify ship calculation cost** — partially done. The core calc was tested and confirmed working 2026-09-30/10-01 (FL tax, ParcelGuard insurance, USPS rate + markup all verified against real numbers), but the "decimal in the wrong spot" bug reported 2026-10-01 was never explicitly confirmed fixed — worth a fresh check.
- [ ] **13. Abandon cart?** — Andrew's own question mark. Not built, no abandoned-cart recovery exists.
- [ ] **14. Coupon codes for free ship or discount %** — already tracked in `TODO.md`'s "Coupons (planned)" section with the dealer-tier examples (single order = 5% + free shipping, 5 units = $270/unit + $30 flat shipping). Designed, not built — no `/api/validate-coupon` endpoint exists yet.
- [ ] **15. Min order Quantity to Qualify** — same unbuilt coupon system as #14, specifically the quantity-tier requirement.
- [ ] **16. Limit to certain products** — same unbuilt coupon system as #14 — product-scoped eligibility. Also relevant to #5/#6 as the general pattern: shipping/coupon rules need a per-product or per-brand scoping mechanism that doesn't exist yet.
- [ ] **17. Verify FJSP variations, weight, Ship box configured** *(highlighted)* — **confirmed only partially fixed.** Checked `products.json` directly: the AGS (onboard generators) variants were corrected to `weightOz: 29` with real `8×6×4 in` dimensions — that's the 2026-09-30 bug fix. But every *other* FJSP/Victron product (`auto-generator-start-portable-generators`, `ve-direct-cable`, `victron-bmv-712`, `victron-cerbo-gx-mk2`, `victron-gx-touch`, `victron-multiplus-ii-external-fan-kit`, `victron-smartshunt-500a`) still has the generic placeholder `weightOz: 16` and **no `dimensions` field at all** — meaning shipping rates for every product except the AGS onboard-generator variants are still using guessed weight and no real box size. This is the single biggest concrete gap on this whole list — directly affects real shipping cost accuracy for 7 of 8 products.
