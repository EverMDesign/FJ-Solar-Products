# Site Banner

A site-wide announcement bar (vacation notices, sale callouts, etc.) the client can control himself, without a password, without asking a developer — see `TODO.md`'s original planning notes for why it's built this way.

## The mechanism, in order

1. Client opens `/banner-ctrl-9f3k7q2z?locationId=<his GHL location ID>` — normally via a GHL "Custom Menu Link" (Embedded Page) that GHL auto-fills with `{{location.id}}`, so he never sees or types a URL
2. That page (`src/pages/banner-ctrl-9f3k7q2z.astro`) checks the `locationId` query param against `LOCATION_ID` in env vars **server-side, before rendering anything**. Wrong or missing ID → plain 404, no hint the page exists
3. If it matches, the page loads the current banner state (`GET /api/banner`) to pre-fill the form, and lets him toggle on/off, pick a type (Sale/Info/System), and type a message
4. Clicking Save sends `POST /api/banner` with the same `locationId` — the API re-checks it server-side too (never trust the gate already passed once)
5. `src/pages/api/banner.ts`'s `POST` handler writes `{ enabled, message, type }` to Vercel Global Config via Vercel's REST API (`PATCH /v1/edge-config/{id}/items`), using `VERCEL_API_TOKEN` + `GLOBAL_CONFIG_ID`

**Reading it back is a completely separate, independent step** — it is not pushed to open browser tabs:

6. Every page on the site, via a script in `src/layouts/Layout.astro`, calls `GET /api/banner` once, on page load
7. `GET /api/banner` reads the saved value from Global Config (using the `@vercel/global-config` package, which reads the `GLOBAL_CONFIG` env var — auto-injected by Vercel once the store is connected to the project, never set by hand)
8. If `enabled` is true and `message` is non-empty, the script sets the `#site-banner` div's text and background color class and un-hides it

**This means a tab that's already open won't update when the client saves a new banner.** It only picks up the current value on load/reload. This tripped us up once already during testing — it's not a bug, it's how the design works (see `CLAUDE.md`).

## Security model

- No password, no login screen on the banner page itself
- The GHL Location ID acts as a shared secret GHL supplies automatically — not cryptographic auth, but there's nothing sensitive behind this page (no money, no customer data), just a banner message
- Layered on top: the URL path itself is long/unguessable, `public/robots.txt` disallows it, and the page sets `noindex, nofollow`
- **Not yet done**: Vercel's BotID bot-blocker was discussed as an extra layer but never wired up — needs Vercel dashboard access, see `TODO.md`

## Colors

| Type | Class | Use for |
|---|---|---|
| Sale | `bg-fj-green` | Promotions — reuses the existing brand green |
| Info | `bg-banner-blue` | General announcements — new one-off color, not used elsewhere |
| System | `bg-banner-amber` | Outages / urgent notices — new one-off color, kept distinct from `fj-gold` so it doesn't read as a "shop now" button |

Both `banner-blue` and `banner-amber` live in `tailwind.config.mjs` under the `banner` color key, separate from the `fj` brand palette on purpose — they exist only for this feature.

## Files

| File | Job |
|---|---|
| `src/pages/banner-ctrl-9f3k7q2z.astro` | The gated admin form |
| `src/pages/api/banner.ts` | `GET` (public, used by every page) + `POST` (gated, used only by the admin form) |
| `src/layouts/Layout.astro` | Renders the `#site-banner` div and the script that fetches + displays it |
| `tailwind.config.mjs` | `banner.blue` / `banner.amber` color tokens |
| `public/robots.txt` | Disallows the admin page path |

## Env vars this depends on

`LOCATION_ID` (the gate check), `VERCEL_API_TOKEN` (write access — must be a **full-account** token; a project-restricted one will fail with 403s on every write), `GLOBAL_CONFIG_ID` (which store to write to), `GLOBAL_CONFIG` (read access — auto-added by Vercel, never set manually). See `docs/deployment.md`.
