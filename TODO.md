# FJ Solar Store — Next Steps

## ⚠ DO NOT DEPLOY (as of 2026-09-30)

The last local changes (Stripe removed, Authorize.net scaffolded in) have **not** been pushed
to Vercel — deliberately held back. Do not run `vercel deploy --prod` until all of these are done:

- [ ] Get real (even just sandbox) Authorize.net credentials and confirm checkout actually
      works locally first — see the Authorize.net checklist right below this
- [ ] Re-run `npm run build` locally one more time right before deploying, to catch anything
      that broke since this was last verified
- [ ] Double check `.env` has no leftover blank `STRIPE_*` vars and Vercel's Project
      Settings → Environment Variables doesn't either (they were never added there, but
      worth a quick look since Stripe was removed from the code)
- [ ] Once deployed, smoke-test `/`, `/cart/`, and the banner admin page again the same way
      we did after the last deploy — a code change this size is worth re-checking end to end

The live site at `https://fj-solar-products.vercel.app` currently still runs the **previous**
deployed version (Stripe-based, also not fully configured) — it has not changed.

## Needed before real orders can go through

- [x] ~~Stripe~~ — removed 2026-09-30. Checkout now runs on Authorize.net's Accept Hosted
      page instead. Code is scaffolded and builds clean, but is **completely untested** —
      no Authorize.net credentials of any kind exist yet, not even a sandbox key. See
      `docs/checkout.md` for the full mechanism and what specifically needs verifying once
      real credentials show up.
- [ ] Get an Authorize.net **sandbox/test** API Login ID + Transaction Key (not the live
      one — that's still running the client's current site) and add them to `.env`:
      `AUTHORIZE_NET_API_LOGIN_ID`, `AUTHORIZE_NET_TRANSACTION_KEY`
- [ ] Get the Authorize.net Signature Key (same account settings page) and add it as
      `AUTHORIZE_NET_SIGNATURE_KEY` — needed to verify webhook calls are real
- [ ] Once sandbox keys are in, run one real test transaction and confirm:
      - [ ] The hosted payment page actually loads with the right amount
      - [ ] `src/pages/api/authorize-webhook.ts`'s field names for customer/billing info
            (`billTo`, `customer.email`) actually match a real `getTransactionDetails`
            response — these were written from documentation, never checked against a
            live response, since no sandbox account existed yet
      - [ ] A contact correctly shows up in GHL after a test purchase
- [ ] Only once everything above is confirmed working in sandbox: get the client's real
      Authorize.net API credentials, set `AUTHORIZE_NET_ENVIRONMENT=production`, and do
      one final real test purchase before pointing customers at it
- [ ] Add `SHIPSTATION_API_KEY` to `.env`
- [ ] Fill in `SHIP_FROM_STREET` / `SHIP_FROM_CITY` / `SHIP_FROM_STATE` / `SHIP_FROM_ZIP` in `.env`
      (where packages actually ship from)
- [ ] Mirror all of the above env vars in Vercel Project Settings — `.env` only works locally
- [ ] Fix the placeholder product weights in `src/data/products.json` (all 8 are set to
      16oz right now) — real shipping rates depend on this
- [ ] Double check "VE.Direct Cable" is filed under the right brand filter (currently "FJ Solar",
      might belong under "Victron")

## Coupons (planned 2026-09-30)

- [ ] Add a "Promo code" input to `/cart/` (checkout is Authorize.net's hosted page now,
      not Stripe's — see `docs/checkout.md`)
- [ ] New endpoint `/api/validate-coupon` — calls GHL's `GET /payments/coupon?code=...`
      (`altId`=location ID, `altType`=location), checks `status === 'active'` (not
      expired/scheduled), returns the discount (`discountType`: percentage or flat amount,
      `discountValue`)
- [ ] Fold that discount into `create-authorize-session.ts`'s `amount`/`lineItems` before
      calling `getHostedPaymentPageRequest`, so the price is correct before the hosted page loads
- [ ] Known limitation: GHL's coupon API has no "redeem / mark as used" endpoint, only
      fetch-and-read — so `limitPerCustomer` on a coupon can't be strictly enforced through
      the API alone. Keep that in mind before relying on it for a strict one-per-customer deal.

## Make the GHL connection deeper

- [ ] Log each sale as a real Opportunity in a GHL pipeline (dollar amount included), not just
      a contact tag
- [ ] Write the order details (items, quantities, total, shipping address) as a note on the
      GHL contact
- [ ] Build a GHL workflow that triggers off the "Customer" / "FJ Solar Store" tag we already
      send (thank-you text, notify team, etc.) — this one is done on the GHL side, no code needed

## Housekeeping

- [ ] `git init` this project + first commit — it still isn't a git repo
- [ ] Compress `fjsp-shop-hero.webp` (currently ~1MB) for faster homepage loads
- [ ] Set up the auto-refresh timer so new GHL products show up without a manual rebuild:
      Vercel Deploy Hook + a scheduled GitHub Actions ping (discussed, not built yet)

## New homepage layout (2026-09-29) — follow-ups

- [x] "Get Product Help" button now emails info@faithfuljourneysolar.com
- [ ] Only `/` and `/cart/` are real pages right now, so the new footer only links to those —
      if you want a full footer (Shipping Policy, Returns, Installation Guides, Support),
      those pages need to be built first, then linked
- [x] Product listing pages and the cart page now use the new palette (`fj-*` tokens in
      tailwind.config.mjs) too, so the whole site matches. The old `navy-*`/`solar-*` tokens
      are still in tailwind.config.mjs but unused now — safe to remove later if nothing else needs them
- [ ] New slide-out cart drawer (click "Cart" in the header) is a quick preview only —
      its checkout button sends people to `/cart/` for the real shipping form + checkout flow,
      since that's the existing checkout logic

## Client call (2026-09-29) — planning decisions

- [ ] GHL → site sync: build the auto-refresh (GitHub Action checks GHL every 15 min,
      pings a Vercel Deploy Hook if anything changed, site rebuilds). Needs `git init` done
      first (see Housekeeping) since GitHub Actions needs a GitHub repo to run from.
- [ ] Stock / out-of-stock: GHL already supports this natively — confirmed by pulling a real
      product from his account. Each product has `trackProductInventory` (on/off) and each
      price has `availableQuantity` + `allowOutOfStockPurchases`. All 9 of his products
      currently have tracking OFF. To use this: (1) update `scripts/fetch-products.mjs` to
      also pull those three fields into `src/data/products.json`, (2) update the product
      card / product page to show "Out of Stock" when quantity hits 0. He turns tracking on
      and sets quantities himself in GHL — no custom tool needed for this part.
- [x] Vacation/announcement banner — **built**, not fully live yet (see the one step left below).
      What's done:
        - Admin page: `src/pages/banner-ctrl-9f3k7q2z.astro` — only renders for a visit
          carrying `?locationId=<his real GHL location ID>`; anything else gets a plain 404.
          Toggle on/off, message box, and a type picker (Sale = green, reuses `fj-green`;
          Info = blue; System = amber — the last two are new one-off colors in
          tailwind.config.mjs under `banner.blue` / `banner.amber`).
        - `src/pages/api/banner.ts` — `GET` is public (site reads it on every page load to
          show/hide the banner), `POST` only accepts the request if it carries the same real
          location ID, otherwise 403.
        - Banner bar wired into `src/layouts/Layout.astro`, shows site-wide, not just home.
        - `public/robots.txt` now disallows the admin page path + noindex meta tag on it too.
        - Tested locally: wrong/missing location ID → 404, correct one → 200 with the form,
          API gate rejects unauthorized POSTs. All confirmed working.
      What's left (needs a Vercel dashboard step, can't be done from here):
        - [ ] Create a Global Config store in the Vercel dashboard and connect it to this
              project — that auto-adds a `GLOBAL_CONFIG` env var, no manual setup needed for it
        - [ ] Create a Vercel API token (Vercel account > Settings > Tokens) and add it as
              `VERCEL_API_TOKEN`, plus the store's ID as `GLOBAL_CONFIG_ID` (starts `ecfg_`,
              shown on the store's page) — both go in `.env` locally and in Vercel Project
              Settings for production. Comments are already in `.env` explaining exactly
              where to find each one.
        - [ ] In GHL: add a Custom Menu Link (Embedded Page), URL pointing at
              `/banner-ctrl-9f3k7q2z?locationId={{location.id}}` on the live domain, so it
              opens inside GHL's sidebar with no login prompt
        - [ ] Optional hardening we discussed but didn't wire up yet: Vercel's BotID
              bot-blocker on this one page/route — not done, needs the same dashboard access
              as above, can add once the rest is connected
- [x] Swap Stripe → Authorize.net — **scaffolded** 2026-09-30 (ahead of the original "do it
      last" timing, at Ever's direction, with blank credentials — same as how Stripe
      originally sat unconfigured). See the checklist at the top of this file under
      "Needed before real orders can go through" for what's left: sandbox keys, verifying
      the webhook's assumed field names against a real response, then eventually the
      client's real key, right before cutover, exactly as originally planned.
- [ ] Product videos (Auto Gen Start, Fan Kit): no dev work needed yet — client is recording
      them himself. Once he sends video files/links, add a `video` field to the relevant
      products in `src/data/products.json` and embed it on that product's page.

## Later / not started

- [ ] Create the actual shipment + label in ShipStation after a sale (fulfillment) — right now
      we only get a shipping *quote*, we don't create the real shipment
