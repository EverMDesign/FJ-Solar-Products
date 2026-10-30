# Checkout, Shipping, and GHL Sync

**Status as of 2026-10-29: live, embedded-iframe checkout, running on the client's real production Authorize.net credentials (not sandbox — he has no separate sandbox account; this was a deliberate call, see `TODO.md`).** Deployed to production. A real transaction went through successfully this same day — but the webhook had **never been registered** with Authorize.net (confirmed via `GET /rest/v1/webhooks` returning `[]`), so none of the GHL/ShipStation sync fired for it. Now registered (see "Webhook registration" below). The field-name assumptions in `authorize-webhook.ts` are still unverified — needs the next real transaction, now that the webhook will actually fire, to confirm.

## Webhook registration

The webhook has to be explicitly registered with Authorize.net — it's not automatic just because `authorize-webhook.ts` exists and is deployed. Registered 2026-10-29 via their REST Webhooks API (separate from the XML/JSON transaction API used everywhere else in this codebase — Basic auth, `base64(apiLoginId:transactionKey)`):

- **Webhook ID**: `af0fe111-5d3a-4bd2-a4cc-17e588a21140`
- **URL**: `https://fj-solar-products.vercel.app/api/authorize-webhook` — **must be updated when the custom domain goes live** (see `TODO.md`'s "custom domain not connected" item), via `PUT https://api.authorize.net/rest/v1/webhooks/af0fe111-5d3a-4bd2-a4cc-17e588a21140` with just `{"url": "<new url>"}`
- **Event**: `net.authorize.payment.authcapture.created`
- Check current status any time: `GET https://api.authorize.net/rest/v1/webhooks` (Basic auth as above)

## The full flow

1. Shopper is on `/cart/` (see `docs/cart.md` for why it can't start anywhere else)
2. Fills in a shipping address, hits "Get Shipping Rate"
3. That calls `POST /api/quote-shipping` (`src/pages/api/quote-shipping.ts`) — talks to ShipStation using `SHIPSTATION_API_KEY` and the `SHIP_FROM_*` env vars (where packages actually ship from), returns a rate in cents. **Unaffected by the payment swap** — still ShipStation either way.
4. Once a rate comes back, "Checkout" enables. Clicking it stashes `{shippingCents, address}` in `sessionStorage` (a full page navigation can't carry JS variables any other way) and navigates to `/checkout/` (`src/pages/checkout.astro`) — a real page on our own domain, with the normal header/footer/logo, not a popup or an off-site redirect.
5. `checkout.astro` reads that `sessionStorage` value plus the cart from `localStorage`, then calls `POST /api/create-authorize-session` (`src/pages/api/create-authorize-session.ts`)
6. That builds line items **from `products.json` server-side** (never trusts prices the client sends — client only sends `slug` + `quantity`), calls Authorize.net's `getHostedPaymentPageRequest` API, and gets back a short-lived `token` (valid 15 minutes, single-use)
7. The browser **POSTs** that token into a large `<iframe name="checkout-iframe">` embedded in the page (`form.target = 'checkout-iframe'`) — the hosted payment page itself never navigates the top-level page away from our site. Customer enters card details and confirms billing address inside that iframe; we only pre-fill what our shipping form already collected (street/city/state/zip/country, no name).
8. **Why an iframe wide enough to hold the whole page content column, not a small modal**: an earlier version embedded the hosted page in a ~520px-wide floating modal, and Authorize.net's Order Summary rendered with blank dollar amounts next to Shipping/Tax/Total — a [documented bug in Accept Hosted at narrow iframe widths](https://community.developer.cybersource.com/t5/Integration-and-Testing/Accept-Hosted-form-does-not-include-amount/m-p/68535), confirmed by testing (full-page mode showed correct amounts, the narrow modal didn't, the full-width `/checkout/` page does). The actual charged amount was never affected either way — it's computed server-side — but a customer not seeing the price before paying is a real trust problem, so don't go back to a narrow embed.
9. On completion, Authorize.net relays the result to us via `postMessage`, forwarded through `public/authorize-net-communicator.html` (required for `hostedPaymentIFrameCommunicatorUrl`) — see that file's comment and `checkout.astro`'s `message` listener. `action=transactResponse` → we clear the cart and `window.location.href = '/thank-you/'` (a plain same-origin GET, done by our own JS). **This postMessage event is [known to be unreliable](https://community.developer.cybersource.com/t5/Integration-and-Testing/Not-getting-transactResponse-event-when-using-IFrameCommunicator/m-p/59657)** in Accept Hosted's iframe mode — as a fallback, `checkout.astro` also listens for the iframe's own `load` event and checks (try/catch, since it's cross-origin until it isn't) whether the iframe navigated itself back to our domain, following it at the top level if so. `hostedPaymentReturnOptions.url`/`cancelUrl` (pointing at `/thank-you/` and `/cart/?canceled=1`) exist purely as that fallback's target, not as the primary completion signal.
10. Separately, Authorize.net calls `POST /api/authorize-webhook` (`src/pages/api/authorize-webhook.ts`) with `net.authorize.payment.authcapture.created`. The webhook payload itself only has minimal info (transaction ID, amount, auth code) — the handler makes a **second API call**, `getTransactionDetailsRequest`, to fetch full customer/billing info, then upserts a GHL contact (tagged `Customer`, `FJ Solar Store`, `fjsp-new-order`) — same behavior as the old Stripe webhook had, just re-pointed at Authorize.net's data shape
11. The `fjsp-new-order` tag is what an EverReach workflow watches for to send Andrew the new-order-alert email (see the email templates delivered in the client Drive folder, `05_Reporting/Deliverables/Email_Templates/`) — the workflow itself lives entirely in EverReach, not in this codebase
12. If the contact upsert succeeds, the webhook also creates a GHL **Opportunity** in the "FJ Solar Products Orders" pipeline (`1hY3ZSKUDcn6JGnbpjxk`), stage **New Order** (`2084ca26-91fb-4dd4-b4a3-e1d5532631a7`), with the contact attached and `monetaryValue` set from the transaction's authorized amount — this is the GHL-side "order record" that replaces WooCommerce's order object in Andrew's old flow. Moving it through Shipped → Completed is manual for now (no code moves it automatically)

## Styling the hosted form

Accept Hosted allows exactly one styling lever: `hostedPaymentStyleOptions: {"bgColor": "..."}`, an accent color applied to buttons and field lines. Set to `#EBAF16` (fj-gold) in `create-authorize-session.ts`. There is no way to change anything else about the hosted form's appearance (PCI SAQ-A tradeoff) — the brand presence comes from the page it's embedded in (our header/footer/logo on `/checkout/`), not the form itself.

## Local dev note

`create-authorize-session.ts` substitutes the real production domain for the `origin` used in `hostedPaymentReturnOptions`/`hostedPaymentIFrameCommunicatorUrl` whenever the request comes from `localhost`/`127.0.0.1` — Authorize.net's API rejects `localhost` URLs there (`E00013`). This only affects local testing; production always uses the real request origin.

## Backend pieces

| File | Job |
|---|---|
| `src/pages/api/quote-shipping.ts` | Calls ShipStation, returns a shipping rate in cents — unchanged by the payment swap |
| `src/pages/api/create-authorize-session.ts` | Builds an Authorize.net Accept Hosted session server-side, trusted pricing only |
| `src/pages/api/authorize-webhook.ts` | Verifies the webhook's `X-ANET-Signature` (HMAC-SHA512 of the raw body, using the Signature Key — format is `sha512=<UPPERCASE_HEX>`), fetches full transaction details, upserts the buyer as a GHL contact, and creates a GHL Opportunity in the New Order stage |
| `src/pages/checkout.astro` | The embedded-checkout page — reads cart/shipping from storage, requests the session, hosts the iframe, listens for completion |
| `src/pages/thank-you.astro` | Post-purchase confirmation page; also handles a direct POST (Authorize.net's non-iframe return mechanism, as a fallback path) |
| `public/authorize-net-communicator.html` | Static relay file Authorize.net embeds in a nested iframe to forward completion events back to `checkout.astro` via `postMessage` |

The three API routes have `export const prerender = false` — they're real server functions, not static files, which is why the Vercel adapter matters (see `CLAUDE.md`'s Node runtime gotcha). `thank-you.astro` also sets `prerender = false` to handle its fallback POST case.

## Required env vars

`AUTHORIZE_NET_API_LOGIN_ID`, `AUTHORIZE_NET_TRANSACTION_KEY`, `AUTHORIZE_NET_SIGNATURE_KEY`, `AUTHORIZE_NET_ENVIRONMENT` (`sandbox` or `production` — defaults to `sandbox` if unset), plus the unrelated `SHIPSTATION_API_KEY` and `SHIP_FROM_*` vars. See `docs/deployment.md` for where these need to be set (local `.env` vs. Vercel project settings — both, separately).

**Set in both places as of 2026-10-29** — live production values, in both local `.env` and Vercel's Production environment (Secret type). `AUTHORIZE_NET_ENVIRONMENT=production`.

## What's confirmed vs. still unverified

Confirmed working against the real API: credentials valid, `getHostedPaymentPageRequest` returns a real token, the hosted page loads with correct line items/amount (full-width embed only — see the width note above), ShipStation live rate + FL tax both correct, checkout session creation works on the deployed production domain.

Still unverified, needs one real completed transaction to confirm:
- Does `getTransactionDetailsRequest`'s response actually match the field names assumed in `authorize-webhook.ts` (`transaction.billTo.firstName/lastName/address/city/state/zip/country`, `transaction.customer.email`)? These came from Authorize.net's general documented schema, not a real response — this is the single biggest unverified assumption in the whole integration.
- Does the webhook signature verification actually pass with a real webhook call? (Requires registering the webhook URL in the Authorize.net dashboard first, pointed at `/api/authorize-webhook`, and configuring the Signature Key there.)
- Does the `transactResponse` postMessage reliably fire for a real completed payment (not just load correctly), or does the iframe `load`-event fallback end up doing the real work?

## What checkout does NOT do yet

- Doesn't create an actual ShipStation shipment/label after a sale — only gets a rate *quote*. Fulfillment is still manual.
- Creates the Opportunity, but doesn't move it past the New Order stage automatically, and doesn't write order details (items, quantities, shipping address) as a note on the contact/opportunity yet — only the dollar amount is captured.
- No coupon support — see the Coupons section in `TODO.md` for the planned approach (GHL as the source of truth, validated server-side, folded into the Authorize.net session amount).

## Why Authorize.net, and why this timing

The client runs Authorize.net on his live business, not Stripe, and wants this site to match. The swap was done as **scaffolding ahead of time** (2026-09-30) — same as how Stripe originally sat with blank keys until real ones were added — not a live cutover. His **real** Authorize.net API key is still powering his current site and must not be used here until sandbox testing is fully done; see the checklist in `TODO.md`.
