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

## 2026-10-31 — 13:30

Session completed: Fixed product tagging for FJ Solar checkout

## What was accomplished

1. **Order Numbering Updates**
   - Changed from first 5 digits to last 5 digits of Authorize.net transId
   - Simplified ShipStation external_shipment_id to just order number (removed GHL opportunity ID)
   - Updated all documentation

2. **EverReach Notes Formatting**
   - Changed section headers from ALL CAPS to Title Case
   - Added visual separators (---) between sections for better readability
   - Confirmed variants are already included in notes via productCode field

3. **External Fan Kit Product**
   - Set 12v as default variant selection on product page
   - Added proper tagging with `fj_ext-kit_purchase`

4. **Product Purchase Tagging** ✅ FIXED
   - `fj_ags_purchase`: Auto Generator Start (onboard + portable)
   - `fj_ext-kit_purchase`: Victron MultiPlus External Fan Kit
   - Root cause: Authorize.net truncates itemId to 31 characters
   - Solution: Match on `multiplus-ii-external` substring instead of full slug
   - Verified working via Vercel logs

## Key Learning
Authorize.net caps itemId at 31 chars, truncating `victron-multiplus-ii-external-fan-kit` to `victron-multiplus-ii-external-f`. Product matching must account for this truncation.

## Status
✅ All changes deployed to production and tested working

**Status:** ✅ Complete

---

## 2026-10-31 — 17:35

Session completed: ShipStation cost summary integration

## What was accomplished

1. **ShipStation Cost Summary Auto-Population**
   - Updated `createShipStationShipment()` to calculate and send cost_summary
   - Extracts product cost, shipping, tax, and total from Authorize.net transaction
   - All future orders will auto-populate ShipStation's Cost Summary UI
   - Calculated as: productCost = total - shipping - tax

2. **Backfill Script Created**
   - Created `scripts/backfill-shipstation-costs.js` for updating existing shipments
   - Usage: `node scripts/backfill-shipstation-costs.js --latest --product 69.99 --shipping 0.00 --tax 0.00`
   - Also supports specific shipment IDs via `--shipment-id` flag
   - Validates API key from environment, provides clear error messages

## Files Modified
- `src/pages/api/authorize-webhook.ts`: Added cost_summary calculation and payload
- `scripts/backfill-shipstation-costs.js`: New script for updating existing orders

## Status
✅ Code complete, build passing, ready for testing with next order

**Next Steps:** Place test order to verify cost_summary populates correctly in ShipStation UI, then use backfill script if needed for any existing orders

---

## 2026-10-31 — 23:45

Session completed: Fixed ShipStation cost summary field format

## Problem
ShipStation shipments were not being created because `amount_paid`, `shipping_paid`, and `tax_paid` were being sent as plain numbers instead of currency objects. API returned 400 error: "Could not cast or convert from System.Double to ShipEngine.Core.DTO.Currency.MoneyDTO."

## Solution
Updated all three cost fields to use proper currency object format:
```json
{
  "amount_paid": { "currency": "usd", "amount": 69.99 },
  "shipping_paid": { "currency": "usd", "amount": 0.00 },
  "tax_paid": { "currency": "usd", "amount": 0.00 }
}
```

## Changes Made
1. **authorize-webhook.ts** (lines 421-444)
   - Added `money()` helper function to format amounts as currency objects
   - Updated all three cost fields to use helper
   - Verified format against live ShipStation API (tested successfully with 200 status, no errors)

2. **backfill-shipstation-costs.js**
   - Updated to use same currency object format
   - Updated console output to display currency objects correctly

## Files Modified
- `src/pages/api/authorize-webhook.ts`: Fixed cost field format
- `scripts/backfill-shipstation-costs.js`: Updated for currency objects

## Verification
✅ API test confirmed all three fields accept `{currency, amount}` format
✅ Test shipment created successfully (id: se-489055438)
✅ Build passes
✅ Deployed to production (commit: a2d8664)

## Status
✅ Code fix complete and verified against live API

**Next Steps:** Place test order to verify shipments now create successfully in ShipStation with cost summary populated

---

## 2026-10-31 — 17:50

FJ Solar Checkout — Complete session summary with workflows, technical architecture, and future reference docs

## ✅ Successfully Completed Items

1. **Order Numbering System Finalized**
   - Transitioned from GHL custom-value counter (broken) to Authorize.net transId derivation
   - Format: FJSP-XXXXX (last 5 digits of transId) — e.g., transId 60171234567 → FJSP-34567
   - No external storage dependency, guarantees uniqueness via Authorize.net
   - Full transId preserved in GHL contact timeline for audit trail

2. **ShipStation Order Linking Simplified**
   - Removed GHL opportunity ID from ShipStation external_shipment_id
   - Now stores just order number: "FJSP-XXXXX"
   - Reduces coupling between systems; each system owns its own IDs
   - ShipStation webhook simplified (removed GHL status update logic)

3. **EverReach Order Notes Reformatted**
   - Changed section headers from ALL CAPS to Title Case for readability
   - Added --- dividers between sections (Contact Info, Items Ordered, Billing Address, Shipping Address, Order Summary)
   - Variants confirmed already included via productCode field (e.g., "Victron SmartShunt 500A - Current Monitor")
   - Notes now scannable and professional in appearance

4. **External Fan Kit Product Configuration**
   - Set 12v as default variant (optionId: wc92d8ztob8)
   - Implemented via PRODUCT_DEFAULTS in [slug].astro
   - Price and shipping info auto-populate on page load with default selected

5. **Product Purchase Tagging System ✅ DEBUGGED & FIXED**
   - `fj_ags_purchase`: Tags all Auto Generator Start orders (both onboard + portable, any variant)
   - `fj_ext-kit_purchase`: Tags Victron MultiPlus external fan kit orders (any variant)
   - Root cause of failure: Authorize.net truncates itemId to 31 characters
     * Full: "victron-multiplus-ii-external-fan-kit" (33 chars)
     * Truncated: "victron-multiplus-ii-external-f" (31 chars)
   - Solution: Match on substring "multiplus-ii-external" which survives truncation
   - Verified working via Vercel runtime logs

## 📋 Workflows & Architecture Documented

### Order Creation Flow (Authorize.net → GHL → ShipStation)
- Documented in `/docs/order-numbering.md` with complete workflow diagram
- Payment captured → Authorize.net webhook → Extract transId → Derive FJSP order number
- Create GHL contact + opportunity (name includes order number) + ShipStation shipment
- All three systems reference same order number for unified tracking

### Product-Based Tagging Logic (Authorize.net itemId Truncation)
- Authorize.net API caps lineItem.itemId at 31 characters per its schema
- Product slugs that exceed 31 chars get truncated mid-word
- Tag matching must use substring that won't get cut off
- Pattern: Match on middle portion of slug (e.g., "multiplus-ii-external") not the full slug

### ShipStation Integration Points
- Shipment creation endpoint: POST /api/authorize-webhook → calls ShipStation API v2
- Webhook receiver: POST /api/shipstation-webhook for shipment dispatch events
- Currently logs shipment receipt; GHL status updates removed (can be re-added with order number lookup)
- Ship-from location hardcoded; ship-to from customer address form
- Carrier: USPS Ground Advantage; Insurance: ParcelGuard

### EverReach Contact Field Mapping
- ORDER_NUMBER_FIELD_ID: Stores FJSP-XXXXX
- ORDER_SUBTOTAL_FIELD_ID: Stores subtotal with currency formatting
- LAST_ORDER_ITEMS_FIELD_ID: Stores HTML-joined line items with variants + prices
- SHIPPING_ADDRESS_FIELD_ID: Stores formatted customer shipping address
- Tags: Array sent to GHL includes standard tags (Customer, FJ Solar Store, fjsp-new-order) + product tags

## 🔧 Technical Debt & Future Considerations

1. **GHL Opportunity Status Updates from ShipStation**
   - Currently deferred: No longer updating GHL when ShipStation dispatches shipment
   - Could be re-implemented by searching GHL opportunities by order number + customer email
   - Trade-off: Adds API call complexity vs manual ShipStation → GHL sync (current approach)
   - See REVISIT.md section: "ShipStation ↔ GHL Opportunity sync"

2. **Sequential Order Numbers (If Needed Later)**
   - Current transId-derived approach not sequential (looks random)
   - Migration path exists: Vercel KV (Redis) for atomic counter increments
   - Design documented but not implemented; see plan file notes for details

3. **Authorize.net Sandbox Testing Gaps**
   - Webhook handler tested in production only; no sandbox transaction ever captured
   - billTo/customer field names from documentation; should verify against real sandbox transId
   - See CLAUDE.md critical gotchas section for details

## 🎯 Key Learning for Future Sessions

**Authorize.net itemId Truncation is Load-Bearing**
- Any new product tagging must account for 31-char limit
- Use shorter, middle-portion substrings in tag-matching logic
- Document the matching rule in code comments
- Test with actual Authorize.net webhook to verify truncation

**Order Number Consistency Across Three Systems**
- Authorize.net generates transId (unique, guaranteed)
- FJ Solar derives FJSP-XXXXX (branded, 5-digit)
- GHL displays in opportunity name + custom field
- ShipStation stores in external_shipment_id
- All three see same order number → simplifies customer communication and support

## 📚 Files to Reference in Future Sessions

- `src/pages/api/authorize-webhook.ts` — Central hub for all order creation logic
- `src/pages/api/shipstation-webhook.ts` — Shipment event receiver (simple, logging-only)
- `docs/order-numbering.md` — Complete architecture + trade-offs documented
- `docs/authorize-net-integration.md` — Authorize.net-specific implementation details
- `CLAUDE.md` critical gotchas — Know the sandbox testing gap + field name caveats

**Status:** ✅ Complete

---

## 2026-11-02 — 16:21

Meta Pixel implementation complete for FJ Solar e-commerce checkout flow

**Status:** ✅ Complete

---

## 2026-11-03 — 22:00

Meta Pixel Purchase event + documentation sprint: pixel now firing with order amounts; documented Canada shipping API limitations, GHL coupon integration strategy, and 3 video scripts for AGS products

**Status:** ✅ Complete

---
