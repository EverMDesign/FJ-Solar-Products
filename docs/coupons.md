# Coupon System Design

## Overview

Custom coupon management system built to support complex dealer pricing rules that EverReach's coupon API cannot enforce (free shipping only, minimum cart quantity, per-customer locking, tiered bulk pricing).

**Architecture:** Client admin page (`/admin/coupons`) → Custom database (`coupons` table/KV store) → Checkout validation → Applied at Authorize.net.

---

## Why Custom, Not EverReach?

EverReach coupon API gaps:
- ❌ No "free shipping only" coupon type
- ❌ No minimum cart quantity enforcement
- ❌ No per-customer (dealer-specific) coupon locking
- ❌ No tiered bulk pricing (5 units @ $X, 10 units @ $Y)

**Solution:** Build our own validation layer. EverReach becomes irrelevant; client manages all coupons in our admin UI.

---

## Database Schema

Store in **Vercel KV** (simplest) or **Postgres** (if scaling beyond ~50 coupons).

```json
{
  "id": "coupon_abc123",
  "code": "DEALER-BULK-5",
  "discountType": "percentage" | "fixed_amount" | "free_shipping",
  "discountValue": 10,
  "freeShipping": false,
  "appliesTo": ["all"] | ["product_id_1", "product_id_2"],
  "minQuantity": 5,
  "maxQuantity": null,
  "dealerId": "dealer_xyz" | null,
  "usageLimit": null,
  "usageCount": 0,
  "expiresAt": "2026-12-31T23:59:59Z" | null,
  "active": true,
  "createdAt": "2026-11-02T10:30:00Z",
  "updatedAt": "2026-11-02T10:30:00Z"
}
```

### Field Explanations

| Field | Type | Example | Notes |
|-------|------|---------|-------|
| `code` | string | `DEALER-BULK-5` | Uppercase, no spaces. Client types this at checkout. |
| `discountType` | enum | `percentage` | `fixed_amount`, `percentage`, or `free_shipping` |
| `discountValue` | number | `10` | For `percentage`: 10 = 10% off. For `fixed_amount`: $10 off total. |
| `freeShipping` | boolean | `false` | If `true`, shipping cost is zeroed at checkout. |
| `appliesTo` | array | `["all"]` | `["all"]` = all products, or array of product IDs like `["6ab165ec791299e19f54c8e8"]` |
| `minQuantity` | number | `5` | Only apply coupon if cart has ≥5 items matching `appliesTo`. |
| `maxQuantity` | number | `null` | Only apply if cart has ≤ this many. `null` = unlimited. |
| `dealerId` | string | `dealer_xyz` | If set, only this dealer's email can use this coupon. `null` = public. |
| `usageLimit` | number | `100` | Max times this coupon can be used across all customers. `null` = unlimited. |
| `usageCount` | number | `42` | Auto-incremented on each successful checkout. |
| `expiresAt` | ISO string | `2026-12-31T23:59:59Z` | Coupon stops working after this time. `null` = never expires. |
| `active` | boolean | `true` | Quick on/off toggle. If `false`, fails validation. |

---

## Client Workflow: Creating a Coupon

**Page:** `/admin/coupons` (protected, requires login)

### Form Fields

```
Coupon Code*
  Input: [DEALER-BULK-5________]
  Help: Uppercase, no spaces. Customers type this at checkout.

Discount Type*
  Dropdown: [Percentage Off ▼]
           Options: Percentage Off, Fixed Amount ($), Free Shipping Only

Discount Value
  Input: [10] % 
  (Hidden if Discount Type = Free Shipping)
  Help: For %, use 10 for 10%. For $, use the dollar amount.

Applies To*
  Dropdown: [All Products ▼]
           Options: All Products, Specific Product(s)
  (If "Specific Product(s)" selected, show multi-select of product list)

Min Quantity Required
  Input: [5] items
  Help: Coupon only valid if cart has ≥ this many items.

Max Quantity Allowed
  Input: [____] items (optional)
  Help: Leave blank for unlimited.

Dealer Lock
  Toggle: [OFF/ON]
  (If ON, show dropdown to select which dealer)

Usage Limit
  Input: [100] times (optional)
  Help: Leave blank for unlimited.

Expires
  Date picker: [2026-12-31] or Toggle: [Never expires]

Active
  Toggle: [ON/OFF]
  Help: Turn off to temporarily disable without deleting.

[Save Coupon] [Cancel]
```

### Coupon Preview (Before Save)

Show what the coupon will do:
```
✓ Code: DEALER-BULK-5
✓ 10% off all products
✓ Minimum 5 items in cart
✓ Expires: 2026-12-31
✓ Active: Yes
```

---

## Admin Dashboard: View/Edit/Delete Coupons

**Table columns:**
- Code
- Discount (e.g., "10% off", "$30 off", "Free shipping")
- Applies To (e.g., "All", "Specific product")
- Min Qty
- Dealer Lock (e.g., "Public" or dealer name)
- Expires
- Status (Active/Inactive)
- Usage (5/100 used)
- Actions (Edit, Copy, Delete)

**Example row:**
```
DEALER-BULK-5  | 10% off       | All        | 5   | Public | 2026-12-31 | Active  | 5/100   | Edit | Delete
TEST-10%       | 10% off       | All        | —   | Public | Never      | Active  | 0/∞     | Edit | Delete
FAN-KIT-2      | $10 off       | Fan Kit    | 2   | Public | 2026-11-15 | Inactive| 12/—    | Edit | Delete
```

---

## Checkout Validation: `/api/validate-coupon`

**Request:**
```javascript
GET /api/validate-coupon?code=DEALER-BULK-5&cartItems=[...cart...]&customerId=xyz

cartItems format:
[
  { productId: "6ab165ec791299e19f54c8e8", quantity: 5 },
  { productId: "6ab165f5c21f7bc9a548c123", quantity: 2 }
]
```

**Response (Valid):**
```javascript
{
  valid: true,
  code: "DEALER-BULK-5",
  discountType: "percentage",
  discountValue: 10,
  freeShipping: false,
  appliedToQuantity: 5,
  error: null
}
```

**Response (Invalid):**
```javascript
{
  valid: false,
  code: "DEALER-BULK-5",
  error: "Coupon requires minimum 5 items in cart (you have 3)"
}
```

**Validation Logic:**
1. Coupon exists in database
2. `active === true`
3. Not expired (`expiresAt` is null or in future)
4. Cart quantity ≥ `minQuantity`
5. Cart quantity ≤ `maxQuantity` (if set)
6. Cart contains at least one product in `appliesTo` (if specific products set)
7. If `dealerId` set, customer email matches that dealer (optional enforcement)
8. Usage count < `usageLimit` (if set)

**Increment usage:**
After successful checkout (Authorize.net webhook fires), increment `usageCount` by 1.

---

## Integration with Checkout

**Current flow:**
1. Customer adds items to cart
2. Goes to `/cart/`
3. Enters shipping address
4. Clicks "Proceed to Checkout"
5. Authorize.net hosted page loads with order summary

**New flow (with coupons):**
1. Customer adds items to cart
2. Goes to `/cart/`
3. **New:** Enter promo code in cart page, click "Apply"
4. Frontend calls `/api/validate-coupon`
5. If valid: update cart total with discount, show discount breakdown
6. If invalid: show error message ("Minimum 5 items required")
7. Clicks "Proceed to Checkout"
8. Discount is baked into the line items sent to Authorize.net (see `create-authorize-session.ts`)
9. Hosted page shows corrected order total

**In `create-authorize-session.ts`:**
- Check if validated coupon exists in session/cookies
- Apply discount to `lineItems` before building the request
- Example: if cart subtotal is $500 with 10% off, send `lineItems` with $450 total

---

## Implementation Phases

### Phase 1: Database + Validation Endpoint
- [ ] Set up Vercel KV store (or Postgres table)
- [ ] Create `/api/validate-coupon` endpoint
- [ ] Test locally with sample coupons

### Phase 2: Admin UI
- [ ] Build `/admin/coupons` page (form + table)
- [ ] Create/Edit/Delete endpoints
- [ ] Protect route with authentication (Clerk or IP-based)
- [ ] Test coupon creation and validation end-to-end

### Phase 3: Checkout Integration
- [ ] Add promo code input to `/cart/`
- [ ] Integrate with `create-authorize-session.ts` to apply discount
- [ ] Show discount breakdown in order summary
- [ ] Test full checkout with valid/invalid coupons

### Phase 4: Analytics (Optional)
- [ ] Track coupon usage per code
- [ ] Dashboard showing total discount given per coupon
- [ ] Identify popular/never-used coupons

---

## Example Coupon Configs

### Dealer Bulk Orders

**5-Unit Bulk:**
```json
{
  "code": "DEALER-BULK-5",
  "discountType": "percentage",
  "discountValue": 10,
  "appliesTo": ["all"],
  "minQuantity": 5,
  "active": true
}
```

**10-Unit Bulk (Fixed Price Per Unit):**
Note: Fixed-price-per-unit isn't directly supported in this schema. Instead, use fixed discount:
```json
{
  "code": "DEALER-BULK-10",
  "discountType": "fixed_amount",
  "discountValue": 200,  // $200 off 10 items
  "appliesTo": ["all"],
  "minQuantity": 10,
  "active": true
}
```

### Free Shipping Promotions

```json
{
  "code": "FREE-SHIP",
  "discountType": "free_shipping",
  "freeShipping": true,
  "appliesTo": ["all"],
  "expiresAt": "2026-12-31T23:59:59Z",
  "active": true
}
```

### Product-Specific Deal

**External Fan Kit: 10% off 2 units**
```json
{
  "code": "FAN-KIT-2",
  "discountType": "percentage",
  "discountValue": 10,
  "appliesTo": ["6ab165f5c21f7bc9a548c123"],  // Fan Kit product ID
  "minQuantity": 2,
  "active": true
}
```

---

## Known Limitations & Future Work

1. **Per-unit pricing tiers** — The schema supports fixed or percentage discounts, not "10 units @ $250 each". Workaround: client creates separate coupon codes for each tier.

2. **One coupon per order** — Current design validates only one coupon code. Could extend to allow stacking (e.g., 10% off + free shipping).

3. **Broadcast vs. Dealer-Specific** — `dealerId` field supports locking a coupon to one dealer, but doesn't easily support "10 dealers can use this code". Workaround: create multiple identical codes, one per dealer.

4. **Promo code not shown in Authorize.net receipt** — Once applied, the discount is baked into line items, so Authorize.net's receipt just shows the final price, not "DEALER-BULK-5 applied". Could add a note or `lineItemDescription`.

---

## Files to Create/Modify

| File | Purpose |
|------|---------|
| `src/pages/admin/coupons.astro` | Admin dashboard + create/edit forms |
| `src/pages/api/admin/coupons.ts` | POST/PUT/DELETE endpoints for coupon CRUD |
| `src/pages/api/validate-coupon.ts` | GET endpoint for checkout to validate codes |
| `src/lib/coupons.ts` | Shared coupon validation logic |
| `src/data/coupons.json` or KV store | Coupon database |
| `src/pages/cart/index.astro` | Add promo code input field |
| `.env.local` | `COUPON_DB_TYPE` (kv/postgres), `VERCEL_KV_URL` (if KV) |

---

## Testing Checklist

- [ ] Create coupon: DEALER-BULK-5 (10% off, 5 qty min)
- [ ] Test valid: 5 items in cart → validate returns `valid: true`, `discountValue: 10`
- [ ] Test invalid: 3 items in cart → validate returns error message
- [ ] Test expired: create coupon with past expiration → validate fails
- [ ] Test product-specific: create coupon for Fan Kit only → valid only with Fan Kit in cart
- [ ] Test free shipping: apply coupon → shipping cost becomes $0 at checkout
- [ ] Test fixed discount: apply $50 off → order total reduces by exactly $50
- [ ] Test usage limit: set to 1 → second checkout with same code fails
- [ ] Test dealer lock: lock to one dealer → other emails can't use code
- [ ] End-to-end: create coupon in admin → apply at checkout → verify discount in Authorize.net order summary

