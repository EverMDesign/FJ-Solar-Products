# GitHub Actions Daily Product Sync

Automatically sync products from GoHighLevel to your site every day without manual intervention.

---

## What It Does

Every day at **2 AM UTC** (10 PM EST), a GitHub Actions workflow:

1. **Pulls products from GHL** — Fetches latest product data, pricing, SKU, shipping info
2. **Updates `src/data/products.json`** — Saves to your repository
3. **Commits if changed** — Only if products.json differs from the last sync
4. **Triggers Vercel redeploy** — Live on your site within seconds
5. **Logs everything** — View run history anytime in GitHub Actions tab

No manual work. Happens while you sleep.

---

## How It Works

### The Flow

```
2 AM UTC Daily
     ↓
GitHub Actions starts
     ↓
npm run fetch-products (uses GHL API)
     ↓
Products.json updated?
     ├─ YES → commit + push to main
     │         ↓
     │      Vercel webhook triggered
     │         ↓
     │      Site redeployed + live
     │
     └─ NO → skip (no changes to commit)
```

### The Workflow File

Located at `.github/workflows/sync-products-daily.yml`

```yaml
on:
  schedule:
    - cron: '0 2 * * *'    # Daily at 2 AM UTC
  workflow_dispatch:       # Manual trigger anytime
```

**Steps:**
1. Checkout code
2. Setup Node.js 24
3. Install dependencies
4. Create `.env` from GitHub Secrets
5. Run `npm run fetch-products` (pulls from GHL)
6. Check if `products.json` changed
7. If changed: commit + push + trigger Vercel redeploy
8. If not changed: log "already up to date" and exit

---

## Setup (One-Time)

### 1. Workflow File ✅
Already created at `.github/workflows/sync-products-daily.yml`

### 2. GitHub Secrets ✅
Set in repo Settings → Secrets and variables → Actions:

| Name | Value |
|------|-------|
| `GHL_PIT_TOKEN` | Your GHL API token (from `.env.local`) |
| `GHL_LOCATION_ID` | Your GHL location ID (from `.env.local`) |
| `GHL_API_BASE` | `https://services.leadconnectorhq.com` |
| `VERCEL_DEPLOY_HOOK_URL` | Vercel webhook URL (created in Vercel dashboard) |

### 3. Vercel Deploy Hook ✅
Created in Vercel dashboard → Settings → Deploy Hooks:
- Name: "Daily Product Sync"
- Branch: `main`
- Copy the URL → add as `VERCEL_DEPLOY_HOOK_URL` secret

---

## Using It

### Automatic (Daily)
Runs at 2 AM UTC every day. Nothing to do.

### Manual Trigger
Anytime you want to sync immediately:

1. Go to GitHub → Actions tab
2. Click **"Sync Products Daily"** (left sidebar)
3. Click **"Run workflow"** (top right)
4. Select branch `main`
5. Click **"Run workflow"**
6. Watch it run (takes ~30 seconds)

### Check Results
After workflow runs:

1. Go to Actions tab → "Sync Products Daily"
2. Click the run (green ✓ = success, red X = failed)
3. Expand steps to see logs:
   - **"Fetch products from GHL"** — shows product count and any warnings
   - **"Commit and push"** — shows if changes were committed
   - **"Trigger Vercel redeploy"** — shows if webhook fired

---

## What Gets Synced

From GHL to `src/data/products.json`:

| Field | Source |
|-------|--------|
| Product name | GHL product name |
| Price | Lowest price from variants |
| SKU | From GHL pricing details |
| Shipping weight | From GHL shipping options |
| Description | GHL product description |
| Image | GHL product image |
| Brand | Auto-detected or preserved from previous run |
| checkoutUrl | Preserved from previous run (not overwritten) |

**Preserved fields** (never overwritten):
- `brand` — Set once, survives every sync
- `checkoutUrl` — Set once, survives every sync
- Variant groups and pricing — Preserved if product exists

---

## Troubleshooting

### Workflow fails with "Invalid JWT"
**Cause:** `GHL_PIT_TOKEN` secret is wrong or expired  
**Fix:** Verify the token in GitHub Secrets matches your `.env.local` exactly

### Workflow fails with "Cannot find module"
**Cause:** Missing `npm install` or wrong Node version  
**Fix:** Check the "Setup Node.js" step in logs

### Products don't update on the site
**Cause:** Products.json changed locally but Vercel deploy didn't happen  
**Fix:** 
1. Check "Trigger Vercel redeploy" step — did it fire?
2. Check Vercel dashboard → Deployments to confirm redeploy happened
3. Hard refresh site in browser (Cmd+Shift+R or Ctrl+Shift+R)

### Products show "old" data
**Cause:** Site cached the old products.json before redeploy  
**Fix:** Wait 60 seconds for CDN cache to clear, then hard refresh

---

## Limitations

### Read-Only Filesystem
Vercel serverless functions have read-only filesystems, so the sync button page (`/sync-ghl`) doesn't work in production. This workflow is the proper solution.

### One Sync Per Day
Default is 2 AM UTC daily. To change:
- Edit `.github/workflows/sync-products-daily.yml`
- Change `cron: '0 2 * * *'` to your preferred time
- Push to GitHub

Cron format: `minute hour day month dayofweek`
- `0 2 * * *` = 2 AM UTC daily
- `0 */6 * * *` = Every 6 hours
- `0 0 * * 0` = Sundays at midnight UTC

### Rate Limits
GHL API has rate limits. Daily sync should be fine, but if you do multiple manual triggers, you might hit limits temporarily.

---

## Monitoring

### Log History
All syncs (successful or failed) are logged in GitHub Actions:
- Go to Actions tab
- Click "Sync Products Daily"
- View all runs with timestamps and status

### Email Alerts
GitHub can email you on workflow failures:
- Repo Settings → Code security and analysis → Actions → Notifications
- Or set up push notifications for your phone

### Manual Check
Anytime you want to verify products are current:
1. Run the workflow manually
2. Check if it says "Products already up to date" (no changes) or "Synced X products" (updated)

---

## Advanced: Customizing the Schedule

Edit `.github/workflows/sync-products-daily.yml`:

```yaml
on:
  schedule:
    - cron: '0 2 * * *'  # Change this line
```

Examples:
| Schedule | Cron |
|----------|------|
| Daily 2 AM UTC | `0 2 * * *` |
| Every 6 hours | `0 */6 * * *` |
| Every 12 hours | `0 */12 * * *` |
| Weekdays 9 AM UTC | `0 9 * * 1-5` |
| Sundays midnight | `0 0 * * 0` |

Then commit and push — GitHub uses the new schedule immediately.

---

## FAQ

**Q: Can I run it more than once a day?**  
A: Yes, change the cron schedule. But be mindful of GHL API rate limits.

**Q: What if products.json doesn't change?**  
A: Workflow still runs, but skips the commit/push/redeploy steps (saves bandwidth).

**Q: Can I disable the daily schedule?**  
A: Yes, comment out the `schedule` section in the workflow YAML. Manual trigger (`workflow_dispatch`) still works.

**Q: Does it work if I'm offline?**  
A: Yes, GitHub Actions runs in the cloud. You don't need your computer on.

**Q: What if GHL API is down?**  
A: Workflow fails and logs the error. GitHub can email you. Retry manually when GHL is back up.

**Q: Does it affect site performance?**  
A: No. Sync happens in the background, site stays live. Redeploy takes ~30 seconds.

---

## Next Steps

- ✅ Workflow set up and tested
- ✅ GitHub Secrets configured
- ✅ Vercel Deploy Hook created
- 🔄 Wait for first automatic run at 2 AM UTC tomorrow
- 📊 Monitor in GitHub Actions tab → "Sync Products Daily"
