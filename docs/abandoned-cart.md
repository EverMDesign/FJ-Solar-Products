# Abandoned Cart Strategy

## Overview

Multi-layered approach to capture, track, and recover abandoned carts without relying on Facebook Pixel or intrusive pop-ups. Focus: email capture → automated recovery sequence → analytics.

---

## 1. Email Capture (Non-Intrusive)

### Option A: Optional Email in Cart Drawer

**Location:** Slide-out cart drawer (top right, already exists)

```
┌─ Your Cart ──────────────────┐
│ Product 1          qty: 1     │
│ Product 2          qty: 2     │
│                               │
│ Subtotal:          $XXX       │
│ Shipping:          $XX        │
│                               │
│ Email (optional):             │
│ [your@email.com____]          │
│ □ Send me order updates       │
│                               │
│ [Proceed to Checkout]         │
│ [Continue Shopping]           │
└───────────────────────────────┘
```

**Benefits:**
- No friction — field is optional, doesn't block checkout
- Captures email early (before they abandon)
- Checkbox for consent/GDPR compliance

**Drawback:** Low adoption (most users won't fill it out unless prompted)

---

### Option B: Urgency-Triggered Email Capture

**Trigger:** When cart sits idle for 3+ minutes without activity (add/remove/proceed to checkout)

```
┌─────────────────────────────────────────┐
│ ⏱️ Still Shopping?                      │
│                                         │
│ We can email you a link to save this    │
│ cart in case you come back later.       │
│                                         │
│ Email: [your@email.com_____________]    │
│                                         │
│ [Save Cart]  [No thanks]                │
└─────────────────────────────────────────┘
```

**Benefits:**
- Gentle prompt at the right moment (idle, not intrusive)
- Solves the problem: "I want to come back but might forget"
- Dismissible (not a hard pop-up)

**Drawback:** Still requires user action; some will dismiss

---

### Option C: Email as Part of Checkout Flow

**Location:** Shipping form on `/cart/` (before final checkout)

Already captured if they reach the shipping address page. If they bounce after starting shipping but before payment:
- You have their email → automatically log as abandoned
- Send recovery email

**Benefits:**
- Guaranteed email capture (required field)
- They've already shown intent (filled address)
- Highest-value recoveries

**Drawback:** Only captures people who got to step 2 (shipping form). Misses early abandonments.

---

## 2. Recovery Workflow

### Database Schema

```json
{
  "id": "cart_abc123",
  "email": "dealer@example.com",
  "cartItems": [
    { "productId": "6ab165ec791299e19f54c8e8", "quantity": 5, "price": 329 }
  ],
  "cartTotal": 1645,
  "shippingEstimate": 50,
  "estimatedTotal": 1695,
  "recoveryUrl": "https://fjsolarproducts.com/recover-cart/abc123",
  "cartHash": "sha256(cartItems)" // to detect if user modifies cart later,
  "abandonedAt": "2026-11-02T14:30:00Z",
  "recoveredAt": null,
  "orderPlaced": false,
  "emails": {
    "sent1": "2026-11-02T17:30:00Z",  // First email at 3 hours
    "sent2": "2026-11-03T14:30:00Z",  // Second email at 24 hours
    "sent3": "2026-11-05T14:30:00Z"   // Third email at 72 hours
  },
  "conversions": {
    "clicked": false,
    "cartRestored": false,
    "orderCompleted": false,
    "finalOrderId": null
  }
}
```

### Recovery Email Sequence

**Email 1: "You left items in your cart" (3 hours after abandonment)**

```
Subject: You left $XXX in your cart

Hi [First Name],

We noticed you left some items in your cart. If you'd like to complete 
your order, here's your recovery link:

[Your Cart Link] (button)

Questions? Reply to this email or call [phone].

— FJ Solar Products Team
```

**Why 3 hours?** Sweet spot — not too aggressive, but while they still remember.

---

**Email 2: "Don't miss out" (24 hours after abandonment)**

```
Subject: Your FJ Solar order is still waiting

Hi [First Name],

These items are ready to ship to you:

[Product 1] × 5
[Product 2] × 2

Total: $1,695

Get back to your cart: [Your Cart Link] (button)

Still deciding? [View product details] or [Chat with us]

— FJ Solar Products Team
```

**Why 24 hours?** They've had time to think. This is a gentle reminder + option to ask questions.

---

**Email 3: "Last chance" (72 hours, with incentive)**

```
Subject: Here's $50 off your order (24 hours only)

Hi [First Name],

We really want to help you get this equipment. Use code COMEBACK50 for 
$50 off your order — just for abandoned carts.

Valid until tomorrow at noon.

[Complete Your Order] (button)

Code: COMEBACK50

— FJ Solar Products Team
```

**Why 72 hours + incentive?** By now, they've decided to abandon. An incentive (coupon code, free shipping) can push them over the edge.

---

### Recovery Link Mechanics

**URL Format:**
```
https://fjsolarproducts.com/recover-cart/abc123?token=xyz789
```

**On page load:**
```javascript
1. Extract cart ID from URL
2. Validate token (security check, one-time use if desired)
3. Fetch abandoned cart from database
4. Load cart items into localStorage
5. Redirect to /cart/ with cart pre-filled
6. Show banner: "We've restored your saved cart!"
```

**Security:**
- One-time token (burns after first use, prevents reuse)
- Token expires after 30 days
- Validate email hasn't changed (optional, stricter security)

---

## 3. Anonymous Tracking (No Email Captured)

For users who never give email, use device fingerprinting to track if they return.

### Device Fingerprinting

```javascript
const fingerprint = sha256(
  navigator.userAgent +
  navigator.language +
  new Date().getTimezoneOffset() +
  screen.width + 'x' + screen.height
)
```

**Store in localStorage:**
```javascript
localStorage.setItem('device_fingerprint', fingerprint)
```

**Limitations:**
- Not 100% accurate (same device ≠ same person)
- Changes with browser update
- Shared computers (family) create false positives

**Use case:** Analytics only (not for email targeting)

### Returning Visitor Detection

**On page load:**
```javascript
1. Check localStorage for abandoned cart
2. Check device fingerprint for previous visits
3. If old cart exists + no email:
   Show inline banner: "Continue shopping? [Yes, restore cart] [No, clear]"
4. Log to analytics: "Anonymous returning visitor"
```

**Dashboard metric:**
- "X% of returning visitors completed their abandoned order"

---

## 4. GHL Integration

### Data Flow: FJ Solar → GHL

When cart is abandoned:
```
1. FJ Solar saves abandoned cart to database
2. Backend sends webhook/API call to GHL:
   POST /contacts (or update if contact exists)
   {
     firstName: "John",
     email: "john@example.com",
     phone: "+1234567890", // if captured
     tags: ["AbandonedCart"],
     customFields: {
       "abandoned_cart_value": "$1,695",
       "abandoned_cart_url": "https://...",
       "abandoned_at": "2026-11-02T14:30:00Z"
     }
   }

3. GHL creates contact + tags with "AbandonedCart"
4. Workflow triggers (set up in GHL):
   - Send sequence of emails
   - Track opens/clicks
   - Update customer record
```

### GHL Workflow Setup

In GoHighLevel dashboard:
1. Create workflow: "Trigger: Contact tagged 'AbandonedCart'"
2. Wait 3 hours
3. Send email 1 (with recovery link from custom field)
4. Wait 21 hours
5. Send email 2
6. Wait 48 hours
7. Send email 3 (with COMEBACK50 coupon code)
8. Log conversion: if email is clicked, update contact status

### Two Approaches

**A. GHL Sends All Emails**
- Pros: One dashboard, GHL's email builder, tracking native
- Cons: Custom recovery links need to be in GHL custom fields, less flexible

**B. FJ Solar Sends Emails, GHL Tracks**
- Pros: Full control over emails, can use templates, dynamic content
- Cons: Need to sync conversion data back to GHL

**Recommendation:** Start with B (FJ Solar sends via your email service), later migrate to A if GHL's email editor is sufficient.

---

## 5. Analytics Dashboard

### Key Metrics

```
FUNNEL VIEW:
─────────────────────────────────────────
Carts Opened:              1,234 (100%)
  ↓
Carts with Email:            567 (46%)
  ↓
Recovery Emails Sent:        567 (100% of captured)
  ↓
Emails Opened:               234 (41%)
  ↓
Recovery Link Clicked:       89 (38% of opens)
  ↓
Cart Restored:               72 (81% of clicks)
  ↓
Order Completed:             34 (47% of restored)
─────────────────────────────────────────
Recovered Revenue:       ~$XX,XXX
```

### By-Product Analysis

```
Product: Victron BMV-712
─────────────────────────
Abandoned in carts:     156 times
As sole item:           42 times
With other products:    114 times
Recovery rate:          18% (28 recovered)
Conversion rate:        11% (4 orders)
```

### By-Cohort Analysis

```
Abandoned Cart Value:
$0-$500:      42% recovery rate (cheaper items, less friction)
$500-$1000:   31% recovery rate
$1000+:       19% recovery rate (more deliberation needed)

Email Captured:
Yes:          35% recovery rate
No:           2% (anonymous return rate)
```

### Timing Analysis

```
How long after abandonment do people return?
< 6 hours:        8% of recoveries
6-24 hours:       31% of recoveries
24-72 hours:      41% of recoveries
> 72 hours:       12% of recoveries
Never return:     8%
```

---

## 6. Technical Implementation

### Files to Create/Modify

```
New Files:
  src/pages/api/cart/abandon.ts          // Log abandoned cart
  src/pages/api/cart/recover.ts          // Restore from recovery URL
  src/pages/recover-cart/[id].astro      // Recovery page (pre-filled cart)
  src/lib/abandoned-carts.ts             // Database queries
  src/lib/email-templates.ts             // Recovery email templates
  src/tasks/send-recovery-emails.mjs     // Cron job (3h, 24h, 72h)

Modified Files:
  src/layouts/Layout.astro               // Add fingerprinting script
  src/pages/cart/index.astro             // Add email capture + recovery banner
```

### Database (Vercel KV or Postgres)

```sql
CREATE TABLE abandoned_carts (
  id TEXT PRIMARY KEY,
  email VARCHAR(255),
  cart_items JSON,
  cart_total DECIMAL,
  recovery_url TEXT,
  abandoned_at TIMESTAMP,
  recovered_at TIMESTAMP NULL,
  order_placed BOOLEAN DEFAULT false,
  emails_sent JSON,
  conversions JSON,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_abandoned_carts_email ON abandoned_carts(email);
CREATE INDEX idx_abandoned_carts_abandoned_at ON abandoned_carts(abandoned_at);
```

### Recovery Email Cron Job

**Using Vercel Cron (or external trigger like GitHub Actions):**

```javascript
// src/tasks/send-recovery-emails.mjs
// Run every hour; sends emails at 3h, 24h, 72h thresholds

import { getAbandondedCarts, updateCartEmails } from '../lib/abandoned-carts'

export async function sendRecoveryEmails() {
  const now = Date.now()
  
  // Email 1: 3 hours (10800000 ms)
  const email1Carts = await getAbandonedCarts({
    minutesSinceAbandonment: { min: 180, max: 185 },
    emailsSent: { sent1: null }
  })
  
  for (const cart of email1Carts) {
    await sendEmail(cart, 'recovery-1')
    await updateCartEmails(cart.id, { sent1: now })
  }
  
  // Email 2: 24 hours (1440 minutes)
  const email2Carts = await getAbandonedCarts({
    minutesSinceAbandonment: { min: 1440, max: 1445 },
    emailsSent: { sent2: null }
  })
  
  for (const cart of email2Carts) {
    await sendEmail(cart, 'recovery-2')
    await updateCartEmails(cart.id, { sent2: now })
  }
  
  // Email 3: 72 hours (4320 minutes)
  const email3Carts = await getAbandonedCarts({
    minutesSinceAbandonment: { min: 4320, max: 4325 },
    emailsSent: { sent3: null }
  })
  
  for (const cart of email3Carts) {
    await sendEmail(cart, 'recovery-3-with-coupon')
    await updateCartEmails(cart.id, { sent3: now })
  }
}

async function sendEmail(cart, template) {
  // Use GHL API or SendGrid/Resend to send email
}
```

---

## 7. Conversion Optimization

### What Actually Gets People to Come Back?

**Research suggests (across ecommerce):**
- **Time:** 24-72 hours is sweet spot (before they forget, after they've thought about it)
- **Personalization:** "Hi John, your $1,695 order..." beats generic
- **Incentive:** Even small coupon (5-10% off, $10-50) lifts conversion 10-30%
- **Reciprocity:** "We want to help" tone beats "COME BACK NOW!"
- **Social proof:** "X people just bought this" or reviews (if products have them)
- **Scarcity (light touch):** "Limited stock on this model" (only if true)

### A/B Test Ideas

1. **Email timing:** 3h vs 6h vs 12h for first email
2. **Incentive:** No coupon vs $30 off vs free shipping
3. **Subject line:** "You left $XXX in your cart" vs "Your order is ready to ship"
4. **CTA button:** "Recover Cart" vs "Complete Order" vs "Review & Checkout"
5. **Product reminder:** Include product image/details vs just the total

---

## 8. Mobile vs Desktop Differences

### Mobile Users Abandon More

- **Why:** Small screen, accidentally closed browser, payment friction on mobile
- **Solution:** 
  - Email recovery links go to mobile-optimized page
  - SMS recovery option (if you have phone number)
  - One-click checkout on mobile (Apple Pay, Google Pay)

### Tracking Setup

```javascript
const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent)
const abandonedCart = {
  ...cart,
  device: isMobile ? 'mobile' : 'desktop'
}
```

**Analytics:**
- Mobile abandonment rate: 68%
- Desktop abandonment rate: 42%
- Mobile recovery rate: 22%
- Desktop recovery rate: 38%

---

## 9. Incentive Strategy

### Coupon Codes for Recovery Emails

```json
{
  "code": "COMEBACK50",
  "discountType": "fixed_amount",
  "discountValue": 50,
  "applicableToEmail": "recovery-email-3-only",
  "minCartValue": 500,
  "usageLimit": 1000,  // How many times total
  "expiresAt": "2026-11-10T23:59:59Z",
  "active": true
}
```

**Incentive Tiers (by cart value):**
- $0-$500 cart: $10 off or 5% off
- $500-$1000 cart: $25 off or 10% off
- $1000+ cart: $50 off + free shipping

**Or:** Same coupon for all, but only valid in recovery emails (usage analytics shows where conversions come from).

---

## 10. Multi-Channel Recovery (Future)

### Email (Phase 1)
✅ Implemented first, easiest

### SMS (Phase 2)
- Send text to phone number (if captured during shipping)
- Higher open rate than email (~90% vs 40%)
- Legal: require opt-in first (Twilio handles compliance)

**Example SMS:**
```
Hi John! You left a $1,695 order at FJ Solar. Finish checkout here: 
[short link]. Valid 48h.
```

### Push Notifications (Phase 3)
- Browser push (if they allow notifications)
- App push (if you build an app later)
- Lowest friction: "Cart ready, click to restore"

---

## Implementation Phases

### Phase 1: Email Capture + Recovery (MVP) — 2-3 weeks
- [ ] Add optional email field to cart drawer
- [ ] Create abandoned cart database table
- [ ] Build `/api/cart/abandon` endpoint (logs cart when user leaves)
- [ ] Create recovery email templates (3 emails)
- [ ] Set up Vercel Cron to send emails at 3h/24h/72h
- [ ] Build `/recover-cart/[id]` page (restores cart)
- [ ] Test end-to-end (abandon → email → recovery)

### Phase 2: Email Capture (Urgency Prompt) — 1 week
- [ ] Add idle timeout (3+ minutes) trigger in cart drawer
- [ ] Show "Still shopping?" prompt with email input
- [ ] Log converted emails

### Phase 3: GHL Integration — 1 week
- [ ] Webhook: Send abandoned cart data to GHL on `/api/cart/abandon`
- [ ] Create GHL contact tag "AbandonedCart"
- [ ] Set up GHL workflow to send emails (optional, parallel to FJ emails)

### Phase 4: Analytics Dashboard — 2 weeks
- [ ] Dashboard page: `/admin/abandoned-carts`
- [ ] Funnel chart: carts → emails sent → clicked → recovered → converted
- [ ] By-product analysis table
- [ ] By-cohort (value range, device) metrics

### Phase 5: A/B Testing + Optimization — ongoing
- [ ] Test email timing, subject lines, incentives
- [ ] Track conversion rate per variant
- [ ] Iterate on best performers

### Phase 6: SMS + Multi-Channel — future
- [ ] Capture phone during checkout
- [ ] SMS recovery for high-value carts
- [ ] Browser push notifications

---

## Success Metrics

| Metric | Baseline | Target (3 months) | Target (6 months) |
|--------|----------|-------------------|-------------------|
| Cart abandonment rate | ~65% | 60% (via checkout UX) | 55% |
| Email capture rate | ~20% | 45% | 60% |
| Email open rate | — | 35% | 40% |
| Recovery click rate | — | 30% | 35% |
| Cart restored rate | — | 70% | 75% |
| Recovery conversion | — | 15% | 25% |
| Recovered revenue (monthly) | $0 | $2,000 | $5,000+ |

---

## Risk Mitigation

**Risk:** Users feel spammed by 3 recovery emails
- **Mitigation:** Track complaints, unsubscribe rate; cap at 2 emails if >5% unsubscribe

**Risk:** Recovery URLs get shared (someone uses someone else's recovery link)
- **Mitigation:** Add one-time token, tie to email address, log suspicious usage

**Risk:** High cart abandonment due to poor UX (shipping cost shock)
- **Mitigation:** Show shipping estimate earlier (cart drawer), not just at checkout

**Risk:** Recovery emails marked as spam
- **Mitigation:** Use branded sender, white-label domain, follow email best practices (SPF/DKIM/DMARC)

