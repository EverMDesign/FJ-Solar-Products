# Checkout, Shipping, and GHL Sync

**Status as of 2026-09-30: scaffolded, completely untested.** Checkout was switched from Stripe to Authorize.net. No Authorize.net credentials exist yet — not even a sandbox key — so this code builds clean but has never actually run against a real Authorize.net account. Do not treat anything below as "verified working" until `TODO.md`'s Authorize.net checklist is done.

## The full flow

1. Shopper is on `/cart/` (see `docs/cart.md` for why it can't start anywhere else)
2. Fills in a shipping address, hits "Get Shipping Rate"
3. That calls `POST /api/quote-shipping` (`src/pages/api/quote-shipping.ts`) — talks to ShipStation using `SHIPSTATION_API_KEY` and the `SHIP_FROM_*` env vars (where packages actually ship from), returns a rate in cents. **Unaffected by the payment swap** — still ShipStation either way.
4. Once a rate comes back, "Checkout" enables. Clicking it calls `POST /api/create-authorize-session` (`src/pages/api/create-authorize-session.ts`)
5. That builds line items **from `products.json` server-side** (never trusts prices the client sends — client only sends `slug` + `quantity`), calls Authorize.net's `getHostedPaymentPageRequest` API, and gets back a short-lived `token` (valid 15 minutes)
6. Unlike Stripe, Authorize.net's hosted page can't be reached with a simple redirect — the browser has to **POST** the token to it. `cart.astro`'s checkout handler builds a hidden `<form method="post">` with the token and submits it via JS (`form.submit()`)
7. Customer lands on Authorize.net's own hosted page (`test.authorize.net/payment/payment` in sandbox, `accept.authorize.net/payment/payment` in production) — this is where they enter card details and confirm their name/billing address; we only pre-fill what our shipping form already collected (street/city/state/zip/country, no name)
8. On completion, Authorize.net redirects back to `/cart/?success=1` or `/cart/?canceled=1` (configured via `hostedPaymentReturnOptions` in the session request)
9. Separately, Authorize.net calls `POST /api/authorize-webhook` (`src/pages/api/authorize-webhook.ts`) with `net.authorize.payment.authcapture.created`. The webhook payload itself only has minimal info (transaction ID, amount, auth code) — the handler makes a **second API call**, `getTransactionDetailsRequest`, to fetch full customer/billing info, then upserts a GHL contact (tagged `Customer`, `FJ Solar Store`) — same behavior as the old Stripe webhook had, just re-pointed at Authorize.net's data shape

## Backend pieces

| File | Job |
|---|---|
| `src/pages/api/quote-shipping.ts` | Calls ShipStation, returns a shipping rate in cents — unchanged by the payment swap |
| `src/pages/api/create-authorize-session.ts` | Builds an Authorize.net Accept Hosted session server-side, trusted pricing only |
| `src/pages/api/authorize-webhook.ts` | Verifies the webhook's `X-ANET-Signature` (HMAC-SHA512 of the raw body, using the Signature Key — format is `sha512=<UPPERCASE_HEX>`), fetches full transaction details, upserts the buyer as a GHL contact |

All three have `export const prerender = false` — they're real server functions, not static files, which is why the Vercel adapter matters (see `CLAUDE.md`'s Node runtime gotcha).

## Required env vars

`AUTHORIZE_NET_API_LOGIN_ID`, `AUTHORIZE_NET_TRANSACTION_KEY`, `AUTHORIZE_NET_SIGNATURE_KEY`, `AUTHORIZE_NET_ENVIRONMENT` (`sandbox` or `production` — defaults to `sandbox` if unset, which is the safe default), plus the unrelated `SHIPSTATION_API_KEY` and `SHIP_FROM_*` vars. See `docs/deployment.md` for where these need to be set (local `.env` vs. Vercel project settings — both, separately).

**Currently all blank** — checkout is not live yet, and can't be tested at all until at least sandbox keys exist.

## What specifically needs verifying once sandbox credentials exist

- Does `getHostedPaymentPageRequest` actually return a valid `token`, and does the hosted page load correctly with the right amount and line items?
- Does `getTransactionDetailsRequest`'s response actually match the field names assumed in `authorize-webhook.ts` (`transaction.billTo.firstName/lastName/address/city/state/zip/country`, `transaction.customer.email`)? These came from Authorize.net's general documented schema, not a real response — this is the single biggest unverified assumption in the whole integration.
- Does the webhook signature verification actually pass with a real webhook call? (Requires registering the webhook URL in the Authorize.net dashboard first, pointed at `/api/authorize-webhook`, and configuring the Signature Key there.)

## What checkout does NOT do yet

- Doesn't create an actual ShipStation shipment/label after a sale — only gets a rate *quote*. Fulfillment is still manual.
- Doesn't log the sale as a GHL Opportunity (dollar amount, pipeline) — only tags the contact. Order details (items, total, address) aren't written as a note on the contact either.
- No coupon support — see the Coupons section in `TODO.md` for the planned approach (GHL as the source of truth, validated server-side, folded into the Authorize.net session amount).

## Why Authorize.net, and why this timing

The client runs Authorize.net on his live business, not Stripe, and wants this site to match. The swap was done as **scaffolding ahead of time** (2026-09-30) — same as how Stripe originally sat with blank keys until real ones were added — not a live cutover. His **real** Authorize.net API key is still powering his current site and must not be used here until sandbox testing is fully done; see the checklist in `TODO.md`.
