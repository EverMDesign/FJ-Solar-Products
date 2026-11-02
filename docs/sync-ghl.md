# GHL Product Sync

Manual one-click sync of products from GoHighLevel to the site. Client can trigger a fresh product pull anytime without waiting for the automated GitHub Actions schedule.

---

## The Mechanism

**Similar to the banner toggle** — uses the same `locationId` auth pattern.

1. Client opens `/sync-ghl?locationId=<his GHL location ID>` — normally via GHL Custom Menu Link (Embedded Page) that auto-fills `{{location.id}}`
2. Page checks `locationId` against `LOCATION_ID` in env **server-side** → Wrong/missing → 404
3. If matches, page loads and shows:
   - Big "🔄 Sync Now" button
   - Last sync timestamp
   - Summary: products synced, warnings (placeholder weights)
   - Live log area
4. Click "Sync Now" → `POST /api/admin/sync-ghl` with `locationId`
5. API re-checks auth, runs `npm run fetch-products`, streams logs back
6. Client-side displays:
   - Real-time log output (Fetching: Product 1, Fetching: Product 2, etc.)
   - Final summary (✓ Saved 8 products / ⚠ 5 with placeholder weights)
   - Duration
7. Button re-enables for next sync

---

## Security Model

Same as banner:
- No password, no login
- GHL Location ID acts as shared secret (auto-supplied by GHL)
- URL path is unguessable (`/sync-ghl` is descriptive but the actual path can be randomized if needed)
- `robots.txt` disallows the path
- Page sets `noindex, nofollow`

---

## What Happens During Sync

```
1. Click "Sync Now"
2. Button disabled, shows "Syncing..."
3. POST to /api/admin/sync-ghl
4. API runs: npm run fetch-products
5. Script fetches from GHL:
   - Fetching: Auto Generator Start – Onboard Generators
   - Fetching: VE.Direct Cable
   - ... (one per product)
6. Script saves products.json
7. Logs stream back to client in real-time
8. Final summary:
   ✓ Saved 8 products → /Users/.../src/data/products.json
   ⚠ 5 product(s) still have placeholder weight
9. Button re-enables
10. Success message shows
```

---

## Files

| File | Job |
|---|---|
| `src/pages/sync-ghl.astro` | Admin form page (gated by `locationId`) |
| `src/pages/api/admin/sync-ghl.ts` | `POST` handler (runs fetch-products, gated by `locationId`) |
| `src/scripts/fetch-products.mjs` | Existing script (unchanged, just called by API) |
| `.env.local` | `LOCATION_ID` (gate check), `PIT_TOKEN` + `GHL_LOCATION_ID` (for fetch-products) |

---

## Env Vars This Depends On

- `LOCATION_ID` — The gate check (same as banner)
- `PIT_TOKEN` — GHL API token for fetching products (from `.env.local`)
- `GHL_LOCATION_ID` — GHL location (from `.env.local`)

---

## How It Differs from Automated GitHub Actions Sync

| | GitHub Actions (Auto) | Manual Sync Button |
|---|---|---|
| Trigger | Schedule (every 15 min, hourly, etc.) | Click whenever you want |
| Good for | Passive, hands-off updates | Testing, immediate updates |
| Use case | "Keep products fresh 24/7" | "I just updated GHL, want to see it now?" |

**Both can run together** — GitHub Actions runs on schedule, button is for manual urgent syncs.

---

## UX Flow

```
┌────────────────────────────────────────────┐
│ GHL Product Sync                           │
│                                            │
│ Last Sync: Nov 2, 2:30 PM                  │
│ Products: 8 total                          │
│                                            │
│ ┌──────────────────────────────────────┐   │
│ │ [🔄 Sync Now]                        │   │
│ └──────────────────────────────────────┘   │
│                                            │
│ ┌─ Logs ────────────────────────────────┐  │
│ │ Fetching: Auto Generator Start...     │  │
│ │ Fetching: VE.Direct Cable             │  │
│ │ Fetching: Victron MultiPlus-II...     │  │
│ │                                        │  │
│ │ ✓ Saved 8 products                    │  │
│ │ ⚠ 5 products with placeholder weights │  │
│ │ Duration: 2.45s                       │  │
│ └────────────────────────────────────────┘  │
│                                            │
│ Status: ✓ Sync complete                    │
└────────────────────────────────────────────┘
```

---

## Notes

- Logs are **live-streamed** so you see each product as it's fetched (not just a final summary)
- Button disabled during sync to prevent double-clicks
- Same products.json used for the site — changes visible immediately after sync (no redeploy needed, since products.json is already on disk)
- If sync fails, error message shows what went wrong (auth failure, script error, etc.)

