# GHL Coupon Integration Plan

**Status:** Planned (not yet implemented)  
**Priority:** Medium (dealer discounts blocked without this)  
**Complexity:** Medium (GHL API + custom validation + Authorize.net line item adjustments)

---

## Overview

GoHighLevel (EverReach) has a native coupon system, but it has **significant limitations** that prevent it from handling FJ Solar's dealer pricing structure directly. This document outlines what's possible, what's not, and the hybrid approach needed.

## GHL Coupon Capabilities vs. Limitations

### ✅ What GHL Coupons CAN Do

| Feature | Support | Notes |
|---------|---------|-------|
| Percentage discount (e.g., 10% off) | ✅ Yes | Works perfectly |
| Fixed dollar amount off | ✅ Yes | E.g., "$10 off order" |
| Coupon code creation | ✅ Yes | Unlimited codes |
| Usage limits per code | ✅ Yes | Can limit to X uses |
| Expiration dates | ✅ Yes | Set start/end dates |
| Per-customer usage limit | ✅ Yes | Can lock to specific customer |
| Coupon activation/deactivation | ✅ Yes | Toggle on/off in EverReach |
| API access | ✅ Yes | Via EverReach API |

### ❌ What GHL Coupons CANNOT Do

| Feature | Support | Reason |
|---------|---------|--------|
| Free shipping only | ❌ No | No shipping-specific discount type |
| Minimum cart quantity | ❌ No | Can't enforce "2+ units required" |
| Per-product discounts | ❌ No | Only order-level discounts |
| Bulk pricing (tiered) | ❌ No | E.g., "$270/unit at 5+ units" |
| Dealer-specific locking | ⚠️ Partial | Can lock per customer, but manual per customer |
| Product exclusions | ❌ No | Can't say "discount excludes Fan Kit" |

---

## FJ Solar's Dealer Coupon Needs

From the meeting notes, the required structure is:

| Scenario | Discount | Shipping | Notes |
|----------|----------|----------|-------|
| Single unit | 5% off | Free shipping | Any product |
| 2-unit order | 10% off | Free shipping | Bundle discount |
| 5-unit order | $270/unit | $30 flat | Bulk pricing (fixed price) |
| 10-unit order | $250/unit | $50 flat | Bulk pricing (fixed price) |
| External fan kit (2+) | 10% off | $10 flat | Product-specific |

**Problem:** GHL can do the percentages (5%, 10%) and flat-rate codes, but NOT:
- Free shipping discount (no shipping-only type)
- Bulk pricing with fixed per-unit prices
- Conditional logic (5 units → use this price, 10 units → use that price)
- Product-specific rules (fan kit gets different treatment)

---

## Hybrid Solution: GHL + Custom Backend

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CHECKOUT FLOW                            │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
                    1. COUPON CODE ENTRY
                    (User types code on /cart/)
                               │
                               ▼
          ┌─────────────────────────────────────────┐
          │  2. VALIDATE COUPON                     │
          │  /api/validate-coupon endpoint          │
          │  ├─ Check GHL API for code              │
          │  ├─ Run custom validation rules         │
          │  └─ Return: {valid, discount, error}    │
          └─────────────────────────────────────────┘
                               │
          ┌────────────────────┴────────────────────┐
          │ Valid                                   │ Invalid
          ▼                                         ▼
    3a. APPLY DISCOUNT                    3b. SHOW ERROR
    ├─ Update line items                  "Code expired"
    ├─ Show discount breakdown            "Code not valid"
    ├─ Recalculate tax/shipping           "Min qty required"
    └─ Enable checkout                    "Product excluded"
                               │
                               ▼
                    4. PROCEED TO AUTHORIZE.NET
                    (Discounted line items)
                               │
                               ▼
          ┌─────────────────────────────────────────┐
          │  5. CREATE AUTHORIZE SESSION            │
          │  /api/create-authorize-session          │
          │  ├─ Build line items (with discount)    │
          │  ├─ Recalculate tax (on discounted amt) │
          │  └─ Calculate shipping (varies by code)  │
          └─────────────────────────────────────────┘
                               │
                               ▼
                 6. SUBMIT TO AUTHORIZE.NET
                 (Paid with discount applied)
                               │
                               ▼
          ┌─────────────────────────────────────────┐
          │  7. WEBHOOK SYNC                        │
          │  /api/authorize-webhook                 │
          │  ├─ Create GHL contact                  │
          │  ├─ Create opportunity                  │
          │  └─ Increment coupon usage count        │
          └─────────────────────────────────────────┘
```

---

## Implementation Steps

### Phase 1: GHL Coupon Creation (In EverReach, No Code)

**What the client does manually in EverReach:**

1. **Create coupon in EverReach > Coupons**
2. **Set up 4 base coupons:**
   - `DEALER-5-SINGLE` → 5% off, unlimited use, no expiry
   - `DEALER-10-DOUBLE` → 10% off, unlimited use, no expiry
   - `DEALER-5UNITS` → Fixed $270/unit (create as -$X off, where X = (normal price - 270) × 5)
   - `DEALER-10UNITS` → Fixed $250/unit (create as -$X off)
   - `FANKIT-10` → 10% off (fan kit only, but no GHL product-lock, so custom validation)

3. **Assign to customers via EverReach:**
   - Dealer A gets: `DEALER-5-SINGLE`, `DEALER-10-DOUBLE`, `DEALER-5UNITS`, `DEALER-10UNITS`
   - Dealer B gets: only `DEALER-5-SINGLE`
   - etc.

**Limitation:** Each dealer must be manually assigned each code. Not automated.

### Phase 2: Custom `/api/validate-coupon` Endpoint

**New file:** `src/pages/api/validate-coupon.ts`

```typescript
export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();
  const { code, cartItems, customerId } = body;

  // 1. Fetch coupon from GHL API
  const coupon = await fetchCouponFromGHL(code);
  if (!coupon) return error('Coupon not found');
  if (coupon.expired) return error('Coupon expired');

  // 2. CUSTOM VALIDATION RULES (what GHL can't do)
  
  // Rule: Bulk pricing codes require minimum quantities
  if (code === 'DEALER-5UNITS' && cartItems.length < 5) {
    return error('This coupon requires 5+ items');
  }
  if (code === 'DEALER-10UNITS' && cartItems.length < 10) {
    return error('This coupon requires 10+ items');
  }

  // Rule: Fan kit discount only applies to fan kit
  if (code === 'FANKIT-10') {
    const hasFanKit = cartItems.some(i => i.slug === 'victron-multiplus-ii-external-fan-kit');
    if (!hasFanKit) {
      return error('This coupon only applies to External Fan Kit (2+ units)');
    }
    if (cartItems.find(i => i.slug === 'victron-multiplus-ii-external-fan-kit')?.quantity < 2) {
      return error('This coupon requires 2+ External Fan Kits');
    }
  }

  // Rule: Per-customer code locking (check GHL contact)
  if (customerId) {
    const allowedCodes = await getCustomerAllowedCodes(customerId);
    if (!allowedCodes.includes(code)) {
      return error('This coupon is not valid for your account');
    }
  }

  // 3. CALCULATE DISCOUNT
  const discount = await calculateDiscount(code, cartItems, coupon);
  // discount = { type: 'percentage' | 'fixed', value, shippingFree: boolean }

  // 4. RETURN VALIDATION RESULT
  return success({
    valid: true,
    code,
    discount,
    discountAmount: calculateAmount(discount, cartItems),
    description: coupon.description, // E.g., "Dealer 5-unit pricing"
    shipping: discount.shippingFree ? 0 : null, // null = calculate normally
  });
};
```

**Validation rules this enables:**
- ✅ Minimum cart quantity ("5+ units required")
- ✅ Product-specific discounts ("Fan kit only")
- ✅ Per-customer code locking ("This code is for your account only")
- ✅ Custom error messages
- ✅ Free shipping toggle (override shipping calculation)

### Phase 3: Cart UI Integration

**File:** `src/pages/cart.astro` (new promo code section)

```html
<div id="coupon-section" class="mt-6 border-t pt-6">
  <label for="coupon-input" class="block text-sm font-semibold text-fj-navy mb-2">
    Promo Code (Dealers)
  </label>
  <div class="flex gap-2">
    <input 
      id="coupon-input"
      type="text" 
      placeholder="Enter promo code"
      class="flex-1 border border-fj-sand rounded px-3 py-2"
    />
    <button 
      id="apply-coupon-btn"
      type="button"
      class="bg-fj-navy text-white px-4 py-2 rounded font-semibold"
    >
      Apply
    </button>
  </div>
  <p id="coupon-error" class="text-red-600 text-sm mt-2 hidden"></p>
  <div id="coupon-success" class="bg-green-50 border border-green-200 rounded p-3 mt-2 hidden">
    <p id="coupon-success-text" class="text-green-800 text-sm font-semibold"></p>
    <p id="coupon-discount-amount" class="text-green-700 text-sm mt-1"></p>
  </div>
</div>
```

**JavaScript logic:**
```typescript
applyBtn.addEventListener('click', async () => {
  const code = couponInput.value.toUpperCase();
  const response = await fetch('/api/validate-coupon', {
    method: 'POST',
    body: JSON.stringify({
      code,
      cartItems: getCart(),
      customerId: null, // Only if user is logged in (future)
    }),
  });
  
  const result = await response.json();
  
  if (!result.valid) {
    showError(result.error);
    return;
  }
  
  // Store coupon in sessionStorage
  sessionStorage.setItem('fj-applied-coupon', JSON.stringify({
    code,
    discount: result.discount,
    discountAmount: result.discountAmount,
    shipping: result.shipping,
  }));
  
  // Update totals
  updateCartTotals();
  showSuccess(result.description);
});
```

### Phase 4: Authorize.net Integration

**File:** `src/pages/api/create-authorize-session.ts` (modify line items)

```typescript
// When creating Authorize.net session, check if coupon applied
const couponData = body.appliedCoupon; // Passed from checkout.astro

if (couponData) {
  // Apply coupon discount to line items
  if (couponData.discount.type === 'percentage') {
    // Reduce each item price by percentage
    lineItems = lineItems.map(item => ({
      ...item,
      unitPrice: (parseFloat(item.unitPrice) * (1 - couponData.discount.value / 100)).toFixed(2),
    }));
  } else if (couponData.discount.type === 'fixed') {
    // Deduct fixed amount from order total
    subtotal -= couponData.discountAmount;
  }
  
  // Apply free shipping or flat rate
  if (couponData.shipping === 0) {
    shipping = { amount: '0.00', name: 'Free Shipping (Coupon)' };
  } else if (couponData.shipping) {
    shipping = { amount: couponData.shipping.toFixed(2), name: 'Flat Rate Shipping (Coupon)' };
  }
  // else: use normal shipping rate passed in
}

// Recalculate tax on discounted subtotal
const taxCents = calculateTaxCents(Math.round(subtotal * 100), address.state);
```

### Phase 5: Webhook Coupon Tracking

**File:** `src/pages/api/authorize-webhook.ts` (track usage)

```typescript
// After successful payment, log coupon usage in GHL
if (couponCode) {
  await incrementGHLCouponUsage(couponCode);
  
  // Create GHL contact note with coupon info
  const note = `Applied coupon: ${couponCode}\nDiscount: ${discountAmount}\nFinal total: ${totalAmount}`;
  await addNoteToGHLContact(contactId, note);
}
```

---

## What This Solves

| Limitation | GHL | Custom Endpoint | Combined |
|-----------|-----|-----------------|----------|
| Free shipping only | ❌ | ✅ | ✅ Can offer |
| Min cart quantity | ❌ | ✅ | ✅ Can enforce |
| Bulk pricing | ❌ | ✅ | ✅ Can support |
| Per-customer locking | ⚠️ Manual | ✅ Auto-checked | ✅ Automatic |
| Product exclusions | ❌ | ✅ | ✅ Can enforce |

---

## What This DOESN'T Solve

- **Per-unit bulk pricing:** Still need to create fixed-amount coupons. E.g., for 5-unit pricing at $270/unit, the coupon is `-$150 off` (assuming normal price is $300/unit). Not ideal UX (shows weird numbers), but works.
  
- **Dynamic pricing:** Can't change price based on quantity in real-time. Coupons are static. Would need separate flow for bulk quote (sales conversation).

- **Dealer assignment:** Still manual in EverReach. To automate, would need:
  - Clerk integration to link dealer accounts
  - Auto-assign coupons based on role/tier
  - Not scoped for Phase 1

---

## Data Flow Summary

```
DEALER FLOW:

1. Dealer enters code on /cart/
2. /api/validate-coupon checks:
   - GHL coupon exists (via EverReach API)
   - Custom rules (min qty, product, exclusions)
   - Per-customer permission (via GHL contact tags)
3. If valid:
   - Store in sessionStorage
   - Update cart display
   - Pass to checkout
4. On checkout:
   - Modify line items in Authorize.net request
   - Adjust shipping (free or flat rate)
   - Recalculate tax
5. After payment:
   - Webhook increments coupon usage in GHL
   - Log discount on GHL contact record
```

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/pages/api/validate-coupon.ts` | Create | Validate coupon code + custom rules |
| `src/pages/cart.astro` | Modify | Add coupon code input section |
| `src/pages/cart.astro` (script) | Modify | Call validate endpoint + update totals |
| `src/pages/checkout.astro` (script) | Modify | Pass coupon data to API |
| `src/pages/api/create-authorize-session.ts` | Modify | Apply coupon discounts to line items |
| `src/pages/api/authorize-webhook.ts` | Modify | Track coupon usage in GHL |
| `src/lib/ghl.ts` | Create/Modify | GHL coupon API client |

---

## GHL API Requirements

**Endpoints needed:**
- `GET /services/coupons/{code}` — Fetch coupon details
- `POST /services/coupons/{code}/usage` — Increment usage count
- `GET /contacts/{contactId}` — Check customer's allowed coupons (via tags)

**Existing:** These should be standard EverReach/GHL APIs. Client's PIT_TOKEN has access.

---

## Alternatives Considered

### Alternative 1: Full Custom Coupon Database
- **Pros:** Unlimited flexibility, no GHL dependency
- **Cons:** Duplicate coupon data (maintain in 2 places), no sales team visibility in GHL
- **Decision:** Rejected — better to keep single source of truth in GHL

### Alternative 2: Stripe (Instead of GHL)
- **Pros:** Stripe coupons handle bulk pricing better
- **Cons:** Would require full payment processor swap (Authorize.net ↔ Stripe), out of scope
- **Decision:** Rejected — too complex for current project

### Alternative 3: Manual Sales Quotes (No Automation)
- **Pros:** Simple, no code needed
- **Cons:** Slow, error-prone, poor UX
- **Decision:** Rejected — this hybrid approach is better UX

---

## Timeline & Effort

| Phase | Task | Effort | Blockers |
|-------|------|--------|----------|
| 0 | Create coupons in EverReach | 30 min | None |
| 1 | Build `/api/validate-coupon` | 4-6 hours | GHL API credentials |
| 2 | Cart UI + coupon input | 2-3 hours | None |
| 3 | Authorize.net line item adjustment | 3-4 hours | Authorize.net API testing |
| 4 | Webhook coupon tracking | 2-3 hours | None |
| 5 | Testing (all discount scenarios) | 4-6 hours | Access to real GHL account |

**Total:** ~15-25 hours (2-3 days of dev work)

---

## Testing Checklist

- [ ] Single unit with 5% discount (code: DEALER-5-SINGLE)
- [ ] 2-unit order with 10% discount + free shipping (code: DEALER-10-DOUBLE)
- [ ] 5-unit order with bulk pricing (code: DEALER-5UNITS)
- [ ] 10-unit order with bulk pricing (code: DEALER-10UNITS)
- [ ] Fan kit 10% off (code: FANKIT-10) — requires 2+ units
- [ ] Invalid code error handling
- [ ] Expired coupon error
- [ ] Quantity requirement validation
- [ ] Per-customer code locking
- [ ] Tax recalculation on discounted amount
- [ ] Webhook usage count increment
- [ ] GHL contact note with coupon details

---

## Future Enhancements

- **Tier system:** Auto-assign coupons based on customer account tier (via Clerk integration)
- **Time-limited promos:** Create seasonal bulk discounts
- **Referral codes:** Generate unique codes for dealers (auto-assign to referred customers)
- **Analytics dashboard:** Track coupon usage, popular codes, discount impact on revenue
