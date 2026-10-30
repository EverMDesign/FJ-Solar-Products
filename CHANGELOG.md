# Changelog

All notable changes to this project, newest first. Dates are when the work happened, not a formal release schedule — this is a live site, not a versioned package.

## 2026-10-30 (Auto-Gen Purchase email template)

### Added
- **New professional email template** `templates/auto-gen-purchase-email.html` — FJ Solar branded thank-you email for individual product orders with:
  - Dynamic customer greeting and order confirmation
  - Order summary with line items, pricing breakdown, and shipping address (auto-populated from `{{contact.*}}` custom fields)
  - Product Resources & Support section with links to manuals, FAQs, technical support, and warranty info
  - Responsive design optimized for desktop and mobile
  - Brand colors (navy `#1a3a52`, gold `#d4a574`)
  - Contact info with email, phone, and support hours
  - Social media links (footer)
- **Setup guide** `docs/AUTO-GEN-PURCHASE-TEMPLATE.md` — complete instructions for:
  - Creating the template in EverReach/GHL
  - Replacing placeholder URLs with real support links
  - Adding product images (optional)
  - Understanding all merge tags and custom field references
  - Setting up automated workflows to send on order creation
  - Testing and troubleshooting
  - Customizing colors and resources for different product types

### How to Use
1. Copy `templates/auto-gen-purchase-email.html` HTML into EverReach's code editor
2. Follow setup steps in `docs/AUTO-GEN-PURCHASE-TEMPLATE.md`
3. Update placeholder URLs (support email, phone, FAQ links, etc.)
4. Create an EverReach automation to send on "New Order" stage
5. Test with a real order before enabling

### Merge Tags
Uses all 7 auto-populated GHL contact custom fields:
- `{{contact.firstName}}` — customer name
- `{{contact.order_number}}` — Authorize.net transaction ID
- `{{contact.last_order_items}}` — line items (HTML `<br>` formatted)
- `{{contact.order_subtotal}}`, `{{contact.order_shipping}}`, `{{contact.order_tax}}`, `{{contact.order_total}}` — pricing breakdown

See `docs/custom-fields-system.md` for field reference.

## 2026-10-30 (rest of the order-alert email fields)

### Added
- **Confirmed via a real test email**: `<br>`-joined HTML does render as real line breaks in EverReach's merge fields — the Items row worked correctly. But found the real `new-order-alert.html` template (pulled from the client's Drive) uses `{{custom_values.order_number}}`, `{{custom_values.shipping_address}}`, `{{custom_values.order_subtotal}}`, `{{custom_values.order_shipping}}`, `{{custom_values.order_tax}}`, `{{custom_values.order_total}}` — true location-wide Custom Values, same wrong mechanism flagged before, which is why those fields were blank (nothing has ever populated them; they'd also be wrong under concurrent orders even if something did).
- Created 6 more contact-level custom fields, same pattern as Last Order Items: Order Number, Shipping Address, Order Subtotal, Order Shipping, Order Tax, Order Total (all TEXT except Shipping Address, LARGE_TEXT). `upsertGhlContact()` now populates all of them every order — subtotal/shipping/tax/total computed from `transaction.authAmount`/`shipping.amount`/`tax.amount` (tax defaults to $0 when the field is absent, which it is for non-FL orders — confirmed against a real transaction, not a guess).
- Verified the full set end-to-end against real transaction data, written to the real test contact.
- **Critical remaining step, not something I can do**: the *live* EverReach template still has the old `{{custom_values.X}}` tags for everything except Items (which was apparently hand-edited already). These won't start working just because the fields are populated — the template itself needs each tag swapped:
  - `{{custom_values.order_number}}` → `{{contact.order_number}}`
  - `{{custom_values.shipping_address}}` → `{{contact.shipping_address}}`
  - `{{custom_values.order_subtotal}}` → `{{contact.order_subtotal}}`
  - `{{custom_values.order_shipping}}` → `{{contact.order_shipping}}`
  - `{{custom_values.order_tax}}` → `{{contact.order_tax}}`
  - `{{custom_values.order_total}}` → `{{contact.order_total}}`

## 2026-10-30 ("Last Order Items" custom field for order emails)

### Added
- **New EverReach custom field** `Last Order Items` (id `vPKiThQLwX2I5S3FmSkc`, type `LARGE_TEXT`, merge tag `{{contact.last_order_items}}`) — created via the real API after confirming with Ever first, since it's standing account configuration. For the new-order-alert (to Andrew) and an order-confirmation (to the customer) email templates to show line items, since GHL's real Custom Values are location-wide (shared across every contact) and would be wrong here — a per-contact Custom Field is the correct mechanism.
- `upsertGhlContact()` now populates this field on every order, `<br>`-joined (not `\n`) since a plain newline collapses to a space in HTML — verified the field stores the literal `<br>` tags correctly via a real API call.
- **Not yet verified**: whether EverReach's email merge-field substitution renders that stored HTML as real line breaks, or escapes it into visible `&lt;br&gt;` text. Needs a real test email with `{{contact.last_order_items}}` in a template — can't be confirmed from this codebase.

## 2026-10-29 (ShipStation shipment had no item/SKU info)

### Fixed
- **Real gap noticed after the shipment-creation flow was otherwise fully working**: no product/SKU info ever showed up on the ShipStation shipment — only weight and a generic package. The shipment creation code only ever built `packages` (weight/dimensions/insured value), never the actual line items. Verified directly against the live API which field actually makes items show up in the UI (a real test shipment, then cancelled): it's a top-level `items` array (`sku`, `name`, `quantity`, `unit_price` as a plain number) — not `packages[].products`, a different, unrelated field that looked like the obvious candidate but isn't it. Now built from the same line-item loop already computing weight/declared value, using our own `products.json` for the authoritative sku/name/price (falling back to Authorize.net's echoed values only for an unmatched item, same pattern as the weight/value fallback).

## 2026-10-29 (third real order: full state name broke ShipStation)

### Fixed
- **Real bug, third test order**: the duplicate-Opportunity fallback worked correctly (confirmed in logs), but ShipStation then rejected the shipment: `"ship_to state_province must be two characters... field_value":"Texas"`. Authorize.net's hosted-page "State" field (both Billing and Shipping) is free text, not a locked dropdown — our own `/cart/` form enforces `maxlength=2`, but nothing stops a customer typing the full state name into Authorize.net's own page. Added `normalizeUsState()` to `lib/shipstation.ts` (full US state names → 2-letter codes, case-insensitive, non-US addresses pass through unchanged) and applied it everywhere a state gets sent to ShipStation — both the real webhook shipment and the `/cart/` rate-quote call (defensive, in case `maxlength` ever gets bypassed e.g. by autofill). Verified against the exact failing input (`"Texas"` → `"TX"`) before deploying.

## 2026-10-29 (second real order: duplicate Opportunity blocked ShipStation sync)

### Fixed
- **Real bug found testing a second order for the same (test) contact**: GHL rejected creating a second open Opportunity with `OPPORTUNITY_NO_DUPLICATE` — by default GHL won't create a second open Opportunity for the same contact in the same pipeline/stage unless "Allow Duplicate Opportunity" is turned on account-wide (Settings > Business Info > General). Since `createNewOrderOpportunity` returning `null` on failure meant `createShipStationShipment` never ran, the entire ShipStation sync silently broke for any repeat customer with an already-open order. Fixed: GHL's error response conveniently includes `meta.existingId` (the existing open Opportunity's id) — now falls back to reusing that id so the shipment still gets created and correctly linked, without requiring an account-wide setting change that would affect every pipeline, not just this one. Confirmed the order note itself worked correctly despite the Opportunity failure (it runs earlier in the chain, before the Opportunity step).
- **Known nuance, not fixed**: when this fallback path is taken, the existing Opportunity's `monetaryValue` isn't updated to reflect the new order's amount — it still shows only the first order's total. Worth deciding later whether repeat orders before the first ships should update that value, or whether enabling "Allow Duplicate Opportunity" so each order gets its own pipeline card is actually what Andrew wants — a real business-logic choice, not just a code fix.

## 2026-10-29 (order history on the GHL contact)

### Added
- **Itemized order note on the GHL contact for every sale.** New `addOrderNoteToContact()`, `POST /contacts/{id}/notes` — writes order number, total, line items, and shipping address to the contact's timeline. Repeat customers already got a new Opportunity per order (confirmed working); this is what makes each one show *what* they bought, not just a dollar total. Verified the note's exact formatted text against the real first order's transaction data. Could not verify the live API call itself (writing to Andrew's real GHL account, blocked by the sandbox's External System Writes policy, same as other GHL/ShipStation write tests this session) — unverified until it fires on the next real order, same caveat as everything else in this file.
- Extracted `getLineItems()` as a shared helper (used by both the note and the ShipStation shipment) instead of duplicating the array-vs-`{lineItem:[...]}` parsing fix in two places.

## 2026-10-29 (first real order: lineItems shape + ShipStation UI visibility)

### Fixed
- **Real bug confirmed from the actual first order's transaction data**: `transaction.lineItems` is a plain array in Authorize.net's real response, not `{lineItem: [...]}` as the code assumed — the line-item loop in `createShipStationShipment()` silently processed zero items every time, which is why that shipment showed the 16oz/$0 fallback instead of the real product's weight/price. Fixed, and verified by replaying the exact real transaction data through the corrected parsing logic (correctly resolves to VE.Direct Cable, 16oz, $18.99). Confirmed good news along the way: `billTo`, `shipTo`, and `customer.email` field names were all exactly right — the biggest previously-flagged "unverified assumption" in this integration turned out to be correct.
- **Real bug**: Andrew couldn't see the new shipment in ShipStation's Orders UI at all, despite it existing and being correct via the API. Root cause: ShipStation requires an explicit `create_sales_order: true` on the shipment request, or it only ever exists as an API-level record with no corresponding Orders-UI entry (confirmed: the first real shipment's `sales_order_ids` was `[]`). Added the flag, verified against the live API that `sales_order_ids` now actually populates, then cancelled the test shipment. Note: this doesn't retroactively fix the first real order's shipment (`se-486603863`) — that one still won't show in the Orders UI; only shipments created after this fix will.

## 2026-10-29 (webhook was never registered)

### Fixed
- **The first real sale went through, but nothing synced to GHL or ShipStation.** Checked directly: no new GHL contact today (newest was Oct 26), every ShipStation shipment today was the known uncorrelated rate-quote side effect, not a real linked one. Root cause: `GET /rest/v1/webhooks` on the live Authorize.net account returned `[]` — the webhook was never registered, so Authorize.net had nothing to call. Registered it via Authorize.net's REST Webhooks API (webhook id `af0fe111-5d3a-4bd2-a4cc-17e588a21140`, watching `net.authorize.payment.authcapture.created`, pointed at the current production domain). See `docs/checkout.md` for how to update the URL later when the custom domain goes live (one `PUT` call, confirmed via their docs before doing any of this).

## 2026-10-29 (real-order bugs: missing email + shipping address fields)

### Fixed
- **Real bug hit while attempting a real order**: Authorize.net's hosted form said "Email is required" on submit, but showed no email field at all to enter one — `hostedPaymentCustomerOptions` (`showEmail`/`requiredEmail`, both default `false`) was never set in `create-authorize-session.ts`, so the field stayed hidden while Andrew's account-level settings apparently still required it. Added `{"showEmail": true, "requiredEmail": true}`. Verified the fix directly against the live Authorize.net API before redeploying — the Email field now renders on the hosted form. We want this field regardless: it feeds the GHL contact, `authorize-webhook.ts`'s `customer.email` lookup, and the ShipStation shipment's `ship_to.email`.
- **Second real bug, same pattern, hit immediately after**: "Ship To First Name is required" — same issue, a Ship To section Andrew's account requires but we never showed. Added `hostedPaymentShippingAddressOptions: {"show": true, "required": true}`, and started sending a `shipTo` block in `transactionRequest` (same address as `billTo` — this flow only ever collects one address from the customer). Verified against the live API: the Shipping Address section now appears, pre-filled with street/city/state/zip/country from our data, leaving only First/Last Name for the customer to type (unavoidable — we don't collect a name anywhere on our own site). `authorize-webhook.ts`'s ShipStation shipment creation now prefers `transaction.shipTo` over `billTo` for the actual ship-to address, since it's now the more accurate source.
- **Known minor UX quirk, not fixed**: Authorize.net's hosted form shows a "Shipping Address different than Billing Address" checkbox pre-checked by default, even though `billTo` and `shipTo` are submitted identically — likely just checks itself whenever a Ship To section is shown at all, regardless of whether the values match. Cosmetic only, doesn't block checkout.

## 2026-10-29 (ShipStation order sync)

### Added
- **A real sale now creates a real, correlated ShipStation shipment.** `authorize-webhook.ts` calls new `createShipStationShipment()` right after creating the GHL Opportunity — real customer name/email/address, real weight/dimensions matched from `products.json`, linked to the Opportunity via ShipStation's `external_shipment_id` field. Does not purchase a label (Andrew still does that manually in ShipStation). Verified the request/response shape with a real test call against ShipStation's live API, then cancelled the test shipment.
- Extracted shared ShipStation constants (`SHIP_FROM`, carrier/service codes, dimension-unit mapping) into `src/lib/shipstation.ts`, used by both `quote-shipping.ts` and the webhook.

### Fixed
- **Found a real latent bug**: Authorize.net truncates line-item `itemId` (our product slug) to 31 characters, and 3 of 8 real products have slugs longer than that — an exact-match lookup back to `products.json` would've silently failed for those. New `findProductBySlugPrefix()` compares against the same truncation.
- **Corrected a wrong field name from `REVISIT.md`'s own earlier notes**: the link-back field is `external_shipment_id`, not `external_order_id` as previously assumed — verified directly against ShipStation's real API before shipping the fix.

## 2026-10-29 (checkout UX)

### Added
- **Checkout now happens embedded on our own site instead of redirecting to Authorize.net.** New `/checkout/` page (`src/pages/checkout.astro`) — Authorize.net's Accept Hosted page loads inside a full-width iframe on a page with our normal header/footer/logo, instead of navigating away to `accept.authorize.net`. Cart's "Checkout" button now stashes `{shippingCents, address}` in `sessionStorage` and navigates there (a full page nav can't carry JS state any other way).
- **Added `public/authorize-net-communicator.html`** — required relay file for Authorize.net's iframe completion events (`hostedPaymentIFrameCommunicatorUrl`). Forwards `postMessage` events up to `checkout.astro`, which listens for `action=transactResponse` to clear the cart and redirect to `/thank-you/`.
- **Added a fallback for `transactResponse` not firing** (a [documented reliability gap](https://community.developer.cybersource.com/t5/Integration-and-Testing/Not-getting-transactResponse-event-when-using-IFrameCommunicator/m-p/59657) in Accept Hosted's iframe mode): `checkout.astro` also watches the iframe's own `load` event and follows it to `/thank-you/` at the top level if it ever navigates back to our domain on its own.
- **Styled the hosted form's accent color** to `#EBAF16` (fj-gold) via `hostedPaymentStyleOptions` — the only customization Accept Hosted allows (PCI SAQ-A tradeoff).

### Fixed
- **Found and fixed a real Accept Hosted bug**: embedding the hosted page in anything narrower than roughly the old modal's 520px width causes the Order Summary to render with blank dollar amounts next to Shipping/Tax/Total — confirmed by testing (full-page and full-width-embed both show correct amounts, a 520px modal didn't). The actual charged amount was never wrong either way (computed server-side), but customers need to see the price before paying. Built a modal version first, found this bug, then rebuilt as a full-width page instead — see `docs/checkout.md`'s width note before ever going back to a popup/modal for this.

## 2026-10-29 (later)

### Deployed
- **Pushed to production.** `npx vercel deploy --prod --yes`, now live at
  `https://fj-solar-products.vercel.app` — Stripe → Authorize.net swap is officially out of
  "scaffolded, untested" and into "real checkout, live credentials." Pre-deploy checklist run
  first: clean `npm run build`, no leftover `STRIPE_*` vars anywhere, post-deploy smoke test
  on `/`, `/cart/`, `/api/banner`, and the banner admin page (all passed).
- Added `AUTHORIZE_NET_API_LOGIN_ID` / `TRANSACTION_KEY` / `SIGNATURE_KEY` / `ENVIRONMENT` to
  Vercel's Production env vars (Secret type, matching `PIT_TOKEN`/`VERCEL_API_TOKEN`). Claude
  Code's sandbox blocks writing to Vercel's secret store directly, so Ever ran the
  `vercel env add` commands by hand instead.
- Confirmed `/api/create-authorize-session` returns a real token on the live production
  domain (not "not configured yet").
- **Still open, needs one real completed transaction on the live site to verify**: the
  webhook's assumed `billTo`/`customer.email` field names, and whether a GHL contact gets
  created correctly. See `TODO.md`.

## 2026-10-29

### Changed
- **Live Authorize.net credentials received and wired in — straight to production, no sandbox.** Andrew doesn't have a separate sandbox.authorize.net account; at Ever's direction we're testing directly against his real production credentials rather than waiting on a sandbox signup. `AUTHORIZE_NET_API_LOGIN_ID`/`TRANSACTION_KEY`/`SIGNATURE_KEY` added to local `.env`, `AUTHORIZE_NET_ENVIRONMENT` set to `production`. **These are live keys — any completed checkout from here on is a real charge.** Still need to mirror these in Vercel before deploying.
- **Fixed a real bug in `create-authorize-session.ts`**: the `tax` object was placed after `shipping` in the `transactionRequest` body. Authorize.net's JSON API still validates against an ordered XML schema under the hood — `tax` must come before `shipping` in the object, or the API rejects the whole request with `E00003: invalid child element 'tax'`. Found by testing the real endpoint; confirmed fixed by reproducing the exact same request shape directly against Authorize.net's API.
- **Verified the Accept Hosted payment page loads correctly** against live production credentials: posted a real token to `accept.authorize.net/payment/payment` for a test cart (1 unit @ $329 + $15 shipping + $0.65 FL tax = $344.65 total) and confirmed the hosted page rendered with the correct order summary and pre-filled billing address. Stopped there deliberately — no card details entered, no transaction completed, so the webhook's assumed `billTo`/`customer.email` field names (flagged 2026-09-30) are still unverified against a real `getTransactionDetails` response, and GHL contact sync is still unconfirmed. Both need an actual completed transaction to verify.
- Confirmed `localhost` can't be used as the Authorize.net hosted-page return URL (`E00013`) — expected, not a bug; this only works once tested against a real deployed domain.
- Incidentally confirmed `SHIPSTATION_API_KEY` and all `SHIP_FROM_*` vars are already populated in `.env.local` (Vercel-pulled) — the "needed" status for these in `TODO.md` was stale; they're just not mirrored into `.env`.

## 2026-10-01

### Changed
- **Fixed a second spot with the same dollars/cents cart bug.** The per-line-item price in `cart.astro` (`$329` showing as `$3.29`) was missed when the subtotal/total version of this bug was fixed earlier today — same root cause (a plain-dollar price run through the cents-based `money()` formatter), different line of code. Checked every remaining `money()` call site in the file; this was the last one.
- **Header/footer cleanup.** Removed the "Shop" nav link and the footer's link column (both redundant with the logo/cart already being clickable), removed an unwanted `mt-16` gap above the footer, centered the remaining footer content, added a Facebook link (facebook.com/fjsolarproducts) to both header and footer.
- **Variant dropdown restyled.** Custom FJ-brand border and gold chevron instead of the native browser `<select>` look — kept the real `<select>` element itself (not a custom listbox) so mobile/keyboard/screen-reader behavior stays free and correct.
- **"Go to Cart" button** now appears next to the "Added!" confirmation after adding an item to cart.
- **Sticky footer fix** in `Layout.astro` — footer was sitting right under short page content instead of pinned to the bottom of the viewport. Site-wide fix, most visible on the cart page.
- **Shipping-rate button loading animation.** Cycles 4 messages ("Getting Rate…", "Finding cheapest option…", "Connecting with USPS…", "Almost done…") at 1s each, always plays the full cycle even if the real response comes back faster.
- **Explored and reverted a fake "test mode" checkout** (simulated order completion when Authorize.net isn't configured, so the cart flow could be clicked through for a demo). Andrew wants to wait for real Authorize.net sandbox credentials instead — checkout is back to its original "Checkout is not configured yet." behavior, no trace of the test-mode code left in either `create-authorize-session.ts` or `cart.astro`.
- **Flagged an unverified risk while discussing real Authorize.net checkout**: the hosted payment page is expected to collect the customer's name, email, and phone itself (we only send address fields), and the webhook assumes those come back to sync a GHL contact — but this has never been checked against a real response. Worth explicitly requiring those fields via `hostedPaymentBillingAddressOptions` once sandbox credentials exist, rather than trusting Authorize.net's un-configured defaults.
- **ParcelGuard shipment insurance now passed through to the customer.** Andrew's ShipStation account auto-insures every shipment and he doesn't want to absorb that cost. `quote-shipping.ts` now requests ParcelGuard insurance for the real cart value (not a flat guess) and adds it to the customer's total at actual cost, no markup. Found by Andrew manually checking a rate in ShipStation and spotting a real $1.09 discrepancy — traced to this, not a bug in the math.
- **Fixed GHL weight unit parsing.** GHL enters weight as pounds.ounces (`1.13` = "1 lb 13 oz"), not true decimal pounds. Was converting to 18.08oz instead of the correct 29oz. `fetch-products.mjs`'s `ozFromWeight()` fixed; re-ran against the onboard generator product.
- **FL sales tax added.** 7.5% (Marion County, confirmed against Florida DOR's official 2026 rate table) charged only when shipping to a Florida address — everywhere else, no tax. New `src/lib/tax.ts`, used by both the cart preview and the real Authorize.net charge (computed server-side, not trusted from the client). Tied to Andrew's current Ocala location — needs revisiting after his move "on the 15th."
- **Shipping is live.** ShipStation key and Ocala ship-from address/phone configured in both local env and Vercel production. Standard shipping is USPS Ground Advantage only (no carrier choice shown to the customer) with a 30% handling markup on the real rate — both confirmed with Andrew on a call this date. Fixed a real bug found while testing: GHL's box dimension unit (`"in"`) isn't what ShipStation's API accepts (`"inch"`) — was silently causing every quote to fail.
- **Product variants pulled from GHL.** `fetch-products.mjs` now reads GHL's per-price `variants`/`shippingOptions` (price, weight, box dimensions per option) into `products.json`. Product detail page shows a variant dropdown with live price/weight/dimension updates; cart treats each variant as its own line item. First real example: Auto Generator Start – Onboard Generators (Negative/Positive signal).
- **Fixed cart price display bug** (pre-existing, not introduced today): `cart.astro`'s subtotal/total ran product prices (plain dollars) through a cents-based formatter, so $329 displayed as $3.29. The actual Authorize.net checkout amount was never affected — display-only bug.
- **Migrated Astro 4 → 7 and @astrojs/vercel 7 → 11.** Forced by Vercel discontinuing Node 20.x; the old adapter couldn't target Node 24 correctly. Also dropped the abandoned `@astrojs/tailwind` package (capped at Astro ^5) in favor of a plain `postcss.config.mjs`. See `CLAUDE.md` and `docs/deployment.md` for details. Done on a separate branch, tested on a Vercel preview deployment, then merged.

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
