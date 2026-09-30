# Design System

## Brand colors (`fj-*`)

From the client-approved mockup (2026-09-29), defined in `tailwind.config.mjs`:

| Token | Hex | Use |
|---|---|---|
| `fj-navy` | `#060E1A` | Primary dark background (header, footer, hero) |
| `fj-navy-deep` | `#172636` | Secondary dark, borders/hover states on dark UI |
| `fj-green` | `#54876C` | Trust section background, "Sale" banner |
| `fj-green-deep` | `#546A61` | Product brand label text |
| `fj-cream` | `#F3EBDD` | Page background, light card backgrounds |
| `fj-sand` | `#E7DBC3` | Borders, dividers on light backgrounds |
| `fj-gold` | `#EBAF16` | Primary accent — CTAs, prices, active states |

## Legacy colors (`navy-*`, `solar-*`) — do not use in new work

Older blue/orange palette from before the redesign. Kept in `tailwind.config.mjs` only because nothing currently references them (see `CHANGELOG.md`, 2026-09-30 — the last pages using them were reskinned). Safe to delete once confirmed nothing depends on them.

## One-off colors (not part of the brand palette)

| Token | Hex | Use |
|---|---|---|
| `banner-blue` | `#2563EB` | Site banner "Info" type only — see `docs/site-banner.md` |
| `banner-amber` | `#F5A623` | Site banner "System" type only |

These exist under their own `banner` key, deliberately separate from `fj-*`, because they're specific to one feature, not the general brand.

## Fonts

- **Headings, buttons, labels, prices**: `font-heading` → Montserrat (weights 600/700/800 loaded via `@fontsource/montserrat` in `src/styles/global.css`)
- **Body text**: default `font-sans` → Inter (weights 400/600/700 via `@fontsource/inter`)

Both load as self-hosted font files, not a Google Fonts `<link>` — keep it that way for performance.

## Component conventions

- Tailwind utility classes only. No inline `style=""` attributes, no exceptions found so far that couldn't be done with a Tailwind arbitrary-value class instead (e.g. `bg-[url('...')]` for a dynamic background image).
- `class:list={[...]}` for conditional classes (Astro's built-in helper) — used in `ProductCard.astro` and `index.astro` for the "hidden past first 6" pattern.
- Extract a component once a pattern repeats — `ProductCard.astro` is the reference example: typed `Props` interface, no logic beyond formatting.

## Where the raw mockup lived

The original pasted HTML/CSS mockup (single-file, inline `<style>`, CSS custom properties) is not kept anywhere in this repo — it was a one-time input, fully converted to Tailwind + component form. If a future redesign mockup comes in the same way, follow the same conversion process: audit for inline styles → map colors to tokens (add new ones if missing) → extract repeated patterns into components → convert.
