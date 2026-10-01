# Deployment

## Vercel project

- **Name**: `fj-solar-products`
- **Account**: Ever's personal Vercel account (`evermdesign`), Hobby plan — no team, so "scope" when using the Vercel CLI/API is always his personal account
- **Live URL right now**: `https://fj-solar-products.vercel.app`
- **Intended custom domain**: `shop.faithfuljourneysolar.com` (set in `astro.config.mjs`'s `site` field) — **not connected yet**, DNS for that subdomain doesn't point anywhere. Connecting it is a separate step from deploying.

## How a deploy actually happens (today)

This repo is not connected to GitHub yet, so there's no git-push-to-deploy. Deploys are manual, via the Vercel CLI:

```bash
npx --yes vercel deploy --token <a full-account Vercel token> --prod --yes
```

(`npx` because global install failed here due to permissions — works fine either way.) First-time setup on a new machine needs `vercel link --token <token> --yes --project fj-solar-products` first, to connect the local folder to the existing Vercel project instead of creating a duplicate one.

**Planned, not built**: connecting this repo to GitHub so pushes auto-deploy, and a scheduled GitHub Action for the GHL 15-minute sync (see `docs/product-catalog.md`). Blocked on `git init` — see `TODO.md`.

## Environment variables — what's real, what's still blank

Every var needs to exist in **two places independently**: local `.env` (for `npm run dev`) and the Vercel project's Environment Variables (for the live site) — setting one does not set the other.

| Variable | Set locally? | Set in Vercel? | What it's for |
|---|---|---|---|
| `PIT_TOKEN` | ✅ | ✅ | GHL Private Integration Token — product sync, contact upsert |
| `LOCATION_ID` | ✅ | ✅ | GHL sub-account ID — also the banner admin page's access gate |
| `GHL_API_BASE` | ✅ | ✅ | GHL/LeadConnector API base URL |
| `AUTHORIZE_NET_API_LOGIN_ID` | ❌ blank | ❌ | Authorize.net checkout — not even a sandbox key exists yet, see `docs/checkout.md` |
| `AUTHORIZE_NET_TRANSACTION_KEY` | ❌ blank | ❌ | Same account settings page as the API Login ID |
| `AUTHORIZE_NET_SIGNATURE_KEY` | ❌ blank | ❌ | Verifies Authorize.net webhook calls — needed before `/api/authorize-webhook` can trust anything it receives |
| `AUTHORIZE_NET_ENVIRONMENT` | ✅ (`sandbox`) | ❌ | `sandbox` or `production` — **must stay `sandbox` until fully tested**; the client's real key still runs his current live site |
| `SHIPSTATION_API_KEY` | ✅ | ✅ | Live shipping rate quotes |
| `SHIP_FROM_STREET` / `_CITY` / `_STATE` / `_ZIP` / `_PHONE` | ✅ | ✅ | Where packages actually ship from (Ocala, FL) — required for real ShipStation rates, phone is required by their API |
| `SHIP_FROM_COUNTRY` | ✅ (`US`) | ✅ | Same |
| `VERCEL_API_TOKEN` | ✅ | ✅ | Banner feature — **must be a full-account token**, not project-restricted (a restricted one was tried first and failed every write with 403) |
| `GLOBAL_CONFIG_ID` | ✅ | ✅ | Which Global Config store holds the banner data (`ecfg_...`) |
| `GLOBAL_CONFIG` | n/a (local dev falls back gracefully) | ✅ auto-added | Read access to that store — Vercel injects this itself the moment the store is connected to the project in the dashboard; never set it by hand, and don't be surprised it's missing locally |
| `VERCEL_TEAM_ID` | blank (not needed) | not needed | Only relevant if this ever moves under a Vercel Team — it currently lives under Ever's personal account |

## Deployment Protection

The Vercel project has `ssoProtection` enabled with `deploymentType: all_except_custom_domains` — meaning preview/branch deployment URLs require Vercel login to view, but the production alias (`fj-solar-products.vercel.app`) and any connected custom domain are publicly reachable. This is a project setting in the Vercel dashboard, not something in code.

## Node.js runtime pin

`package.json`'s `engines.node` is pinned to `"24.x"` (as of 2026-10-01, after Vercel discontinued Node 20.x). This required upgrading `astro` to v7 and `@astrojs/vercel` to v11 together — see the gotcha in `CLAUDE.md` before touching either version again.
