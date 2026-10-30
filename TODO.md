# FJ Solar Store — Next Steps

## ✅ First real sale + webhook registered (2026-10-29)

A real customer completed a real order today. The GHL/ShipStation sync code (built earlier
today) did **not** fire for it — the Authorize.net webhook had never actually been
registered (`GET /rest/v1/webhooks` returned `[]`). Fixed:

- [x] Registered the webhook via Authorize.net's REST Webhooks API — id
      `af0fe111-5d3a-4bd2-a4cc-17e588a21140`, pointed at
      `https://fj-solar-products.vercel.app/api/authorize-webhook`, watching
      `net.authorize.payment.authcapture.created`. See `docs/checkout.md`'s "Webhook
      registration" section for how to check/update/delete it.
- [ ] **Must update the webhook URL when the custom domain goes live** — one `PUT` call,
      doesn't need redoing from scratch (see docs)
- [ ] The next real transaction is the first real test of whether the webhook actually
      fires correctly end-to-end (signature verification, GHL contact/Opportunity,
      ShipStation shipment) — watch for it and check GHL/ShipStation afterward
- [ ] Also two fixed real bugs hit during the first real order attempt, see
      `CHANGELOG.md` 2026-10-29: Authorize.net required email and a Ship To name/address
      with no fields shown for either — both now fixed and deployed

## ✅ Deployed to production (2026-10-29)

All blockers below are cleared — Stripe → Authorize.net swap is now live at
`https://fj-solar-products.vercel.app`:

- [x] Real (live/production) Authorize.net credentials confirmed working, both locally and
      against the real API
- [x] `npm run build` ran clean right before deploying
- [x] No leftover `STRIPE_*` vars in `.env`, `.env.local`, or Vercel Project Settings
- [x] `AUTHORIZE_NET_API_LOGIN_ID` / `TRANSACTION_KEY` / `SIGNATURE_KEY` / `ENVIRONMENT` added
      to Vercel Project Settings (Production, Secret type) — Ever couldn't write these via
      Claude Code (blocked by the sandbox's Secret-Store Writes policy), so Andrew/Ever added
      them manually via `vercel env add`
- [x] Deployed via `npx vercel deploy --prod --yes` — live at the production alias
- [x] Post-deploy smoke test: `/` (200), `/cart/` (200), `/api/banner` (200, valid JSON),
      banner admin page (404 without `locationId`, 200 with the real one)
- [x] Confirmed `/api/create-authorize-session` is live and working in production (not
      "not configured yet") — got a real token back from a test request

**Still open after this deploy** — see "Needed before real orders can go through" below for
the webhook/GHL-sync verification that still needs one real completed transaction.

## ✅ Checkout UX rebuild + ShipStation sale sync — deployed (2026-10-29)

Live in production — `/checkout/`'s full-width embedded iframe checkout, and real
ShipStation shipments created per sale. See `docs/checkout.md` for the full mechanism.

- [x] New `/checkout/` page — Accept Hosted loads in a full-width iframe on our own page
      (header/footer/logo visible) instead of redirecting off-site
- [x] `public/authorize-net-communicator.html` added (required for iframe completion events)
- [x] Found and fixed a real Accept Hosted bug: blank Order Summary dollar amounts at narrow
      iframe widths (confirmed — don't go back to a small modal for this, see docs)
- [x] Hosted form accent color styled to fj-gold
- [x] Real ShipStation shipment created per sale, linked to the GHL Opportunity via
      `external_shipment_id` — see `REVISIT.md`'s ShipStation sync section for details and
      what's still open (auto-advancing the Opportunity on label purchase)
- [x] Build runs clean, deployed via `vercel deploy --prod --yes`
- [x] Re-verified the full checkout flow against the live production domain (not just local
      dev) — correct Order Summary amounts, correct billing pre-fill, fj-gold Pay button, our
      header/logo visible, URL stayed on our own domain throughout

## Needed before real orders can go through

- [x] ~~Stripe~~ — removed 2026-09-30. Checkout now runs on Authorize.net's Accept Hosted
      page instead. See `docs/checkout.md` for the full mechanism.
- [x] Authorize.net credentials added to `.env` (2026-10-29) — **live/production**, not
      sandbox. Andrew has no separate sandbox.authorize.net account; at Ever's direction
      we're testing straight against production. `AUTHORIZE_NET_ENVIRONMENT=production`.
      **Any completed checkout from here on is a real charge.**
- [x] Fixed a real bug found while testing (2026-10-29): `tax` was placed after `shipping`
      in `create-authorize-session.ts`'s request body, which Authorize.net's schema
      rejects (`E00003`). Fixed by moving `tax` before `shipping`.
- [x] Hosted payment page confirmed loading correctly (2026-10-29) — posted a real token
      to `accept.authorize.net/payment/payment`, confirmed correct order summary and
      pre-filled billing address. Stopped before entering card details — no transaction
      was completed.
- [ ] **Still unverified — needs one real completed transaction:**
      - [ ] `src/pages/api/authorize-webhook.ts`'s field names for customer/billing info
            (`billTo`, `customer.email`) actually match a real `getTransactionDetails`
            response — these were written from documentation, never checked against a
            live response
      - [ ] A contact correctly shows up in GHL after a real purchase
- [x] `SHIPSTATION_API_KEY` already set in `.env.local` (Vercel-pulled) — this item was
      stale, not actually blocking.
- [x] `SHIP_FROM_STREET` / `SHIP_FROM_CITY` / `SHIP_FROM_STATE` / `SHIP_FROM_ZIP` already
      set in `.env.local` (Ocala, FL) — same as above, already done.
- [x] `AUTHORIZE_NET_*` env vars mirrored in Vercel Project Settings and deployed to
      production (2026-10-29) — see "Deployed to production" at the top of this file
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

- [ ] Fix footer copyright text — currently "© 2026 Faithful Journey Solar Products. All
      rights reserved." Should read "FJ Solar Products" instead.
- [ ] Look into the variance on different products showing from EverReach — some products
      appear inconsistently; needs investigation into the sync/fetch path before concluding
      whether it's a GHL-side data issue or `scripts/fetch-products.mjs`
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

## Checkout UX

- [ ] Look into customizing the Authorize.net card-entry experience — right now checkout
      redirects to Authorize.net's hosted Accept Hosted page off-site. Investigate whether
      Accept.js or a similar embeddable option supports an on-site lightbox/modal for card
      entry instead of the redirect, and what that would take to swap in.

## Later / not started

- [ ] Create the actual shipment + label in ShipStation after a sale (fulfillment) — right now
      we only get a shipping *quote*, we don't create the real shipment
