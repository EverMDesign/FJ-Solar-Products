# FJ Solar Store — Project Instructions

Astro storefront for Faithful Journey Solar. Read this before making changes — it covers real gotchas that already bit us once.

For the full picture, see `README.md` (overview + where things live) and `docs/` (one file per feature, frontend + backend). This file is rules and traps, not a tour.

## At the start of every session

Read `TODO.md` and list its open (unchecked) items back to the user before doing anything else — especially anything under "⚠ DO NOT DEPLOY" if that section still exists, since that's a live blocker. This gives them something to pick from instead of having to re-open the file themselves. Keep it short: section headers and item summaries, not the full multi-line detail under each one.

## Critical gotchas (things that already broke)

- **`package.json` `engines.node` is `"24.x"` as of 2026-10-01 — this is current, not a mistake.** Vercel discontinued Node 20.x outright (deploys now fail with "Node.js Version 20.x is discontinued"). Getting to 24.x required upgrading `astro` (4 → 7) and `@astrojs/vercel` (7.8 → 11) together — the old adapter version couldn't target Node 24 and silently fell back to the unsupported `nodejs18.x` runtime instead. If a future Vercel/Node change forces another adapter bump, check `@astrojs/vercel`'s supported runtimes first and expect to upgrade Astro alongside it, not in isolation. Same episode also removed `@astrojs/tailwind` (abandoned, capped at Astro ^5) — Tailwind now wires through a plain `postcss.config.mjs` instead.
- **The site banner is pull, not push.** Saving on `/banner-ctrl-9f3k7q2z` writes to Vercel Global Config. Every page separately fetches `/api/banner` once, on load, via a script in `Layout.astro`. A tab that's already open won't update until it's reloaded — that's expected, not a bug. See `docs/site-banner.md`.
- **`src/data/products.json` is generated, not hand-authored.** It comes from `npm run fetch-products` (GHL → JSON). It's also *not* auto-refreshed — GHL price/stock changes don't show on the site until someone runs that script and redeploys. See `docs/product-catalog.md` for the planned auto-refresh and what's blocking it.
- **Checkout can't go straight from the cart drawer to Authorize.net.** Real checkout needs a shipping rate first (ShipStation), which needs a full address form — that only exists on `/cart/`. The slide-out `CartDrawer` is a preview only; its checkout button links to `/cart/`, it never starts a payment session directly.
- **Checkout runs on Authorize.net, scaffolded but completely untested.** Stripe was fully removed 2026-09-30 and replaced with Authorize.net's Accept Hosted flow (`create-authorize-session.ts` + `authorize-webhook.ts`). No Authorize.net credentials — not even sandbox — existed when this was written, so the code builds clean but has never actually run. The webhook handler's `billTo`/`customer.email` field names came from documentation, not a real response — verify them against an actual `getTransactionDetails` call before trusting the GHL contact sync. The client's real (live) Authorize.net key is still running his current site — never put it in this project until sandbox testing is fully done. See `docs/checkout.md` and `TODO.md`.

## Styling rules

- Use only Tailwind utility classes and the `fj-*` brand tokens in `tailwind.config.mjs`. Zero inline `style=""` — the one legitimate exception so far is a dynamic background-image, and even that should prefer `bg-[url('...')]` over an inline style attribute.
- The old `navy-*` / `solar-*` color tokens are legacy — don't use them in new work. Everything should use `fj-navy`, `fj-gold`, etc. See `docs/design-system.md` for the full palette and why both sets still exist in the config.
- `font-heading` (Montserrat) for headings/buttons/labels, default `font-sans` (Inter) for body text.
- If a color or spacing value is used more than once, it belongs in `tailwind.config.mjs` as a token — don't repeat arbitrary values (`text-[#xxx]`) across files.

## Component rules

- Extract a component when a UI pattern repeats 2+ times (see `ProductCard.astro`). Don't extract for a single use.
- Components take typed `Props` interfaces, no exceptions.
- Data-driven rendering (`.map()` over `products.json`) instead of copy-pasted markup — already the pattern in `index.astro`, keep following it.

## Before you deploy

1. `npm run build` locally first — catches most issues before they hit Vercel.
2. Check `TODO.md` for anything that's a known blocker (right now: custom domain not connected, several env vars still blank).
3. Deploys go through the Vercel CLI via `npx vercel deploy --token <token> --prod --yes` until this repo is connected to GitHub for git-based deploys (not set up yet).

## Keeping docs current

When you ship a feature or fix something non-obvious, add a line to `CHANGELOG.md` (dated, newest at top) and update the relevant file in `docs/` if the feature's behavior changed. Don't let these drift — that's the whole point of having them.
