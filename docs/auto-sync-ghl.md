# Auto-Sync Products from GHL

Automatically pull product updates (new products, SKU changes, shipping info) from GHL on a schedule, commit to repo, and trigger Vercel redeploy — zero manual intervention.

---

## Overview

**Current Flow (Manual):**
```
1. You run: npm run fetch-products
2. Changes saved locally
3. You run: git add/commit/push
4. Vercel sees push → redeploys
```

**New Flow (Automated):**
```
GitHub Actions (Scheduled) 
  ↓
Runs: npm run fetch-products
  ↓
Detects changes in products.json
  ↓
Auto-commits + pushes to repo
  ↓
Vercel webhook triggered
  ↓
Site redeployed with new products
  ↓
(Happens while you sleep, on any schedule you want)
```

---

## Implementation: GitHub Actions

### Step 1: Ensure Repo is on GitHub

FJ Solar must be pushed to a GitHub repository. Currently, it's a local git repo.

**Setup:**
```bash
# Create repo on GitHub (empty, no README/license)
# Then push local repo:

git remote add origin https://github.com/YOUR_ORG/FJ-Solar-Products.git
git branch -M main
git push -u origin main
```

### Step 2: Create GitHub Actions Workflow

Create file: `.github/workflows/sync-ghl-products.yml`

```yaml
name: Auto-Sync Products from GHL

on:
  schedule:
    # Run every 15 minutes (adjust as needed)
    # Format: minute hour day-of-month month day-of-week
    - cron: '*/15 * * * *'
  
  # Also allow manual trigger from Actions tab
  workflow_dispatch:

jobs:
  sync:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout repo
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '24'

      - name: Install dependencies
        run: npm ci

      - name: Fetch latest products from GHL
        run: npm run fetch-products
        env:
          PIT_TOKEN: ${{ secrets.GHL_PIT_TOKEN }}
          LOCATION_ID: ${{ secrets.GHL_LOCATION_ID }}
          GHL_API_BASE: https://services.leadconnectorhq.com

      - name: Check if products.json changed
        id: git-diff
        run: |
          if git diff --quiet src/data/products.json; then
            echo "changed=false" >> $GITHUB_OUTPUT
          else
            echo "changed=true" >> $GITHUB_OUTPUT
          fi

      - name: Commit and push changes
        if: steps.git-diff.outputs.changed == 'true'
        run: |
          git config user.name "GHL Auto-Sync Bot"
          git config user.email "noreply@github.com"
          git add src/data/products.json
          git commit -m "Auto-sync: Update products from GHL [skip ci]"
          git push origin main
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Trigger Vercel redeploy
        if: steps.git-diff.outputs.changed == 'true'
        run: |
          curl -X POST "${{ secrets.VERCEL_DEPLOY_HOOK_URL }}" \
            -H "Content-Type: application/json" \
            -d '{"name":"GHL Product Sync"}'
        continue-on-error: true
```

### Step 3: Add Secrets to GitHub

Go to GitHub repo → Settings → Secrets and Variables → Actions

**Add these secrets:**

| Secret Name | Value | Where to Get |
|-------------|-------|-------------|
| `GHL_PIT_TOKEN` | Your PIT token | `.env` local file → `PIT_TOKEN` |
| `GHL_LOCATION_ID` | Your location ID | `.env` local file → `LOCATION_ID` |
| `VERCEL_DEPLOY_HOOK_URL` | Vercel webhook URL | See "Step 4" below |

**How to add a secret:**
1. Click "New repository secret"
2. Name: `GHL_PIT_TOKEN`
3. Value: (paste from your `.env` file)
4. Click "Add secret"

### Step 4: Create Vercel Deploy Hook

This triggers a redeploy when products change.

**In Vercel Dashboard:**
1. Go to your project
2. Settings → Git → Deploy Hooks
3. Click "Create Deploy Hook"
4. Name: "GHL Product Sync"
5. Branch: `main`
6. Copy the webhook URL
7. Paste URL into GitHub secret `VERCEL_DEPLOY_HOOK_URL`

---

## How It Works

### Timing

**Cron schedule breakdown:**
```yaml
*/15 * * * *
│   │ │ │ │
│   │ │ │ └─ Day of week (0-6, 0=Sunday) — * = every day
│   │ │ └─── Month (1-12) — * = every month
│   │ └───── Day of month (1-31) — * = every day
│   └─────── Hour (0-23) — * = every hour
└─────────── Minute (0-59) — */15 = every 15 minutes
```

**Common schedules:**
```yaml
'0 * * * *'      # Every hour at :00
'0 9 * * *'      # Daily at 9 AM UTC
'0 */6 * * *'    # Every 6 hours
'*/15 * * * *'   # Every 15 minutes (aggressive)
'0 2 * * 0'      # Weekly Sunday at 2 AM UTC
```

### What Happens

1. **GitHub Actions runs on schedule** (e.g., every 15 min)
2. **Checks out repo** → installs Node → runs `npm run fetch-products`
3. **Compares products.json** to previous version
4. **If changed:**
   - Commits changes: "Auto-sync: Update products from GHL"
   - Pushes to main branch
   - Calls Vercel webhook
   - Vercel sees push → auto-redeploys
5. **If not changed:**
   - Silently skips (no commit, no redeploy)
   - Runs again in 15 minutes

### Logs & Monitoring

**View sync runs:**
1. Go to GitHub repo → Actions tab
2. See "Auto-Sync Products from GHL" workflow
3. Click any run to see logs
4. Green checkmark = success, red = failed

**Example log:**
```
Fetching: Auto Generator Start – Onboard Generators
Fetching: VE.Direct Cable
Fetching: Victron MultiPlus-II External Fan Kit
...
✓ Saved 8 products → src/data/products.json
Auto-sync: Update products from GHL [skip ci]
Pushing to origin main
Vercel redeploy triggered
```

---

## Backup: Manual Trigger

Even with automation, you can manually sync anytime:

**In GitHub Actions tab:**
1. Click "Auto-Sync Products from GHL" workflow
2. Click "Run workflow" → "Run workflow"
3. Runs immediately

Or from command line (local):
```bash
npm run fetch-products
git add src/data/products.json
git commit -m "Manual sync: Update products from GHL"
git push origin main
```

---

## Cost & Performance

**GitHub Actions:** Free tier includes 2,000 minutes/month
- 15-min interval × 96 runs/day × 30 days = ~48 hours/month ✓ (well under free limit)
- No cost impact

**Vercel redeploys:** Included in your plan (no overage)

**GHL API calls:** ~8 calls per run (one per product)
- Unlikely to hit rate limits

---

## What Gets Auto-Synced

✅ **New products added in GHL** → Appear on site automatically  
✅ **Product prices updated** → Reflected in products.json  
✅ **SKU numbers changed** → Updated for ShipStation  
✅ **Shipping weights/dimensions** → Latest from GHL  
✅ **Product images updated** → New images fetched  
✅ **Product descriptions edited** → Updated on site  

❌ **Brand field** — Kept from previous run (manual override preserved)  
❌ **Custom fields** — Anything set by hand in products.json stays

---

## Customizations

### Sync Only at Specific Times

Avoid syncing during peak hours:
```yaml
on:
  schedule:
    # Every 2 hours, but only between 11 PM and 7 AM UTC (off-hours)
    - cron: '0 */2 23,0,1,2,3,4,5,6,7 * *'
```

### Sync on GHL Webhook (Real-Time)

If you need real-time sync (product updates appear instantly):

**Alternative: Use GHL Webhooks**
```
GHL Product Updated Webhook
  ↓
GitHub Workflow Dispatch API call
  ↓
Workflow runs immediately (not on schedule)
  ↓
products.json updated + Vercel redeploys
```

This requires:
1. Setting up a webhook listener (tiny Astro API route or external service)
2. Calling GitHub's workflow dispatch API on webhook
3. More complex, but zero delay

---

## Troubleshooting

### Workflow not running

**Check:**
1. Is `.github/workflows/sync-ghl-products.yml` in the repo?
2. Are secrets properly set? (Settings → Secrets)
3. Is the cron schedule correct? (Test at crontab.guru)

### Auth errors

**Check:**
1. `GHL_PIT_TOKEN` is valid (copy from `.env` exactly)
2. `GHL_LOCATION_ID` is valid
3. Secrets don't have extra spaces/newlines

### Vercel redeploy not triggering

**Check:**
1. Deploy hook URL is correct (no typos)
2. URL is in `VERCEL_DEPLOY_HOOK_URL` secret
3. Branch is set to `main` in Vercel hook settings

### Too many commits

If you see too many auto-sync commits:
1. Increase cron interval (from `*/15` to `0 * * * *`)
2. Or add a check to only commit if meaningful changes (filter out metadata-only updates)

---

## Monitoring Dashboard (Optional)

Track sync health over time:

**Create `/dashboard/sync-health` page** (future):
- Last sync time
- Next sync time
- Total syncs this month
- Failed syncs
- Average products per sync

**Use GitHub API:**
```javascript
GET /repos/YOUR_ORG/FJ-Solar-Products/actions/runs
// Lists all workflow runs (successful, failed, pending)
```

---

## Best Practices

1. **Set reasonable intervals**
   - `*/15` = every 15 min (aggressive, but safe)
   - `0 * * * *` = hourly (good default)
   - `0 2 * * 0` = weekly (if changes are rare)

2. **Monitor the first week**
   - Watch Actions tab
   - Check that Vercel redeploys trigger correctly
   - Verify products.json updates look correct

3. **Keep manual sync option**
   - `npm run fetch-products` always available locally
   - GitHub manual trigger always available in Actions tab

4. **Preserve manual overrides**
   - `brand` field: kept across syncs
   - Custom fields: kept across syncs
   - Any field you set by hand stays set

5. **Alert on failures (future)**
   - GitHub Actions can email on failure
   - Or send Slack notification
   - Set up if you want to be notified of sync issues

---

## Summary

| Step | What | Where |
|------|------|-------|
| 1 | Push repo to GitHub | GitHub.com |
| 2 | Create workflow file | `.github/workflows/sync-ghl-products.yml` |
| 3 | Add secrets | GitHub Settings → Secrets |
| 4 | Create Vercel webhook | Vercel Dashboard → Deploy Hooks |
| 5 | Done! | Sits idle, syncs automatically |

**Result:** Products auto-update from GHL without any manual work. New products, price changes, SKU updates, shipping info — all synced on schedule.

