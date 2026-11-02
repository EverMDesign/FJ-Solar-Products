# Meta Pixel Implementation

**Status as of 2026-11-02:** ✅ Live and tracking full conversion funnel

Meta Pixel (Facebook Pixel) tracks the complete e-commerce conversion journey from product discovery through purchase, enabling audience building, retargeting, and conversion optimization in Meta's advertising platform.

## Pixel ID

- **Pixel ID:** `2432707093923661`
- **Setup Method:** Manual (via base code in `src/layouts/Layout.astro`)
- **Status:** Active, verified receiving events

## Events Tracked

The pixel fires the following events in sequence as customers move through the store:

| Event | Trigger | Location | Purpose |
|-------|---------|----------|---------|
| **PageView** | Page load | `Layout.astro` | Track all site visits |
| **Add to Cart** | "Add to Cart" button click | `src/lib/cart.ts` | Track product interest |
| **Initiate Checkout** | "Get Shipping Rate" button click | `src/pages/cart.astro` | Track checkout start |
| **Purchase** | Thank-you page load (after payment) | `src/pages/thank-you.astro` | Track completed sales |

## Event Details

### PageView
- **Fires on:** Every page load
- **Data:** None (standard pageview)
- **Code location:** `Layout.astro` line 47
- **Automatic tracking:** Yes (via Meta Pixel base code)

### Add to Cart
```javascript
fbq('track', 'AddToCart', {
  value: price * quantity,        // Product price × quantity
  currency: 'USD',
  content_name: product.name,
  content_ids: [product.slug],
  content_type: 'product',
  quantity: quantity
});
```
- **Fires on:** User clicks "Add to Cart" button
- **Data location:** `src/lib/cart.ts` line 60
- **Includes:** Product name, price, quantity, cart value
- **Note:** Duplicate clicks prevented via `data-listener-attached` guard in `src/pages/index.astro` and `src/pages/products/[slug].astro`

### Initiate Checkout
```javascript
fbq('track', 'InitiateCheckout', {
  value: subtotal / 100,          // Cart subtotal in dollars
  currency: 'USD',
  content_ids: cart.map(i => i.slug),
  num_items: cart.length
});
```
- **Fires on:** User clicks "Get Shipping Rate" button on `/cart/`
- **Data location:** `src/pages/cart.astro` line 217
- **Includes:** Subtotal, number of items in cart
- **Timing:** Before ShipStation quote API call (marks checkout intent)

### Purchase
```javascript
fbq('track', 'Purchase', {
  value: finalAmount || 0,        // Order total in dollars
  currency: 'USD',
  content_type: 'product'
});
```
- **Fires on:** Thank-you page loads (after successful Authorize.net payment)
- **Data location:** `src/pages/thank-you.astro` line 53
- **Includes:** Total order amount (subtotal + shipping + tax)
- **Implementation detail:** Uses retry mechanism to wait for fbq to load (see below)

## Data Flow Architecture

### Order Total Tracking

Since Authorize.net's postMessage doesn't include transaction response data, the total amount is passed through sessionStorage:

```
checkout.astro
├─ Receives order total from API
├─ Stores in sessionStorage: fj-order-total
└─ Redirects to /thank-you/

thank-you.astro (client-side script)
├─ Recovers fj-order-total from sessionStorage
├─ Waits for fbq to load (retry mechanism)
└─ Fires Purchase event with amount
```

### FBQ Availability Retry

The Meta Pixel script loads asynchronously from Facebook's CDN, so `window.fbq` may not be available immediately when the thank-you page script runs.

```javascript
function firePixelPurchase() {
  if (typeof window !== 'undefined' && window.fbq) {
    window.fbq('track', 'Purchase', { ... });
  } else {
    setTimeout(firePixelPurchase, 100);  // Retry every 100ms
  }
}
```

This retry loop waits up to ~1s for fbq to become available, preventing lost Purchase events due to timing.

## Audience Building

With these events tracked, you can create audiences in Meta Ads Manager:

- **Cart Abandoners:** Add to Cart → no Purchase (retarget with discounts)
- **Checkout Starters:** Initiate Checkout → no Purchase (gentle follow-up)
- **Customers:** Purchase event (build lookalike audiences)
- **Browsers:** PageView only (cold traffic, education-focused ads)
- **High-Value Buyers:** Purchase with value > $100 (VIP messaging)

## Verification

Events are visible in Meta Pixel Events Manager:

1. Visit Meta Ads Manager → Events Manager
2. Select your Pixel ID
3. View "Events Received" tab (updated in real-time)
4. Each event should show "Processed" status within 1-2 minutes

**Last verified:** 2026-11-02, all events flowing correctly (PageView, Add to Cart, Initiate Checkout, Purchase)

## Files Modified

- `src/layouts/Layout.astro` — Meta Pixel base code + PageView event
- `src/lib/cart.ts` — Add to Cart tracking
- `src/pages/cart.astro` — Initiate Checkout tracking
- `src/pages/checkout.astro` — Store order total in sessionStorage
- `src/pages/thank-you.astro` — Purchase event + fbq retry logic
- `src/pages/index.astro` — Duplicate click prevention guard
- `src/pages/products/[slug].astro` — Duplicate click prevention guard
- `src/pages/api/create-authorize-session.ts` — Return totalAmount in API response

## Known Limitations

- **Transaction ID unavailable:** Authorize.net's postMessage doesn't include transaction details; Purchase events track amount but not transaction ID
- **Async fbq loading:** Retry mechanism handles this, but events could theoretically be lost if fbq takes >1 second to load (rare)
- **No webhook data:** The webhook runs asynchronously and can't feed back into pixel tracking; pixel fires before webhook confirms payment

## Next Steps

- Monitor Events Manager for event volume and anomalies
- Create initial audiences (cart abandoners, customers) in Ads Manager
- Test retargeting campaigns with cart abandoners
- Build lookalike audiences from purchasers for scaled acquisition
- A/B test ad creative and messaging based on audience segment

## Troubleshooting

**Purchase events not showing in Events Manager:**
1. Check browser console for `[thank-you] Firing Purchase event:` log
2. Verify `fbq` is defined: `console.log(window.fbq)` should show function
3. Check Pixel ID is correct: `2432707093923661`
4. Allow 1-2 minutes for event processing in Meta's systems

**Duplicate Add to Cart events:**
1. Verify `data-listener-attached` guard is in place (prevents re-attachment)
2. Hard refresh page (Cmd+Shift+R) to clear cached scripts
3. Check browser console for error messages

**Events show "Pending" instead of "Processed":**
1. Check internet connection (events queued locally if offline)
2. Wait 2-5 minutes; Meta's system may be slow to process
3. Verify Pixel ID and setup method in Events Manager
