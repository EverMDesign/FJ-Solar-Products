# Clerk Integration + Account System

## Overview

Replace anonymous browsing with optional account system powered by Clerk. Unlocks: persistent cart, order history, abandoned cart recovery, first-time discounts, and faster repeat checkout.

**Flow Change:**
- **Before:** Anonymous → localStorage cart → checkout
- **After:** Optional sign up (with incentive) → Persistent database cart → Account dashboard with orders/abandoned carts

---

## Why Clerk?

Clerk handles:
- User signup/login (OAuth + email/password)
- Session management
- User data storage
- Zero auth code needed
- Free tier covers small stores

**What we build:** Cart persistence, order history, abandoned cart recovery, discount logic.

---

## Database Schema

### users (via Clerk, but extend with custom fields)

```sql
CREATE TABLE user_profiles (
  id TEXT PRIMARY KEY,  -- Clerk user ID
  email VARCHAR(255) UNIQUE,
  firstName VARCHAR(100),
  lastName VARCHAR(100),
  phone VARCHAR(20),
  createdAt TIMESTAMP DEFAULT NOW(),
  firstPurchaseAt TIMESTAMP NULL,
  totalSpent DECIMAL DEFAULT 0,
  hasFirstTimeDiscount BOOLEAN DEFAULT true,  -- WELCOME10 available?
  preferences JSON  -- language, notifications, etc
);
```

### carts (Persistent, user-owned)

```sql
CREATE TABLE carts (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  cartItems JSON,  -- [{productId, quantity, price}]
  cartTotal DECIMAL,
  status VARCHAR(50),  -- 'active', 'abandoned', 'converted_to_order'
  lastModifiedAt TIMESTAMP,
  abandonedAt TIMESTAMP NULL,
  recoveredAt TIMESTAMP NULL,
  recoveryEmailsSent JSON,  -- {sent1, sent2, sent3}
  createdAt TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES user_profiles(id)
);

CREATE INDEX idx_carts_userId ON carts(userId);
CREATE INDEX idx_carts_status ON carts(status);
```

### orders (Purchase history)

```sql
CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  orderNumber INT UNIQUE AUTO_INCREMENT,
  cartId TEXT,
  items JSON,  -- [{productId, quantity, price, name}]
  subtotal DECIMAL,
  shipping DECIMAL,
  tax DECIMAL,
  discount DECIMAL,
  discountCode VARCHAR(50),  -- WELCOME10, etc
  total DECIMAL,
  shippingAddress JSON,
  billingAddress JSON,
  authorizeNetTransactionId VARCHAR(255),
  shipstationOrderId VARCHAR(255),
  status VARCHAR(50),  -- 'pending', 'processing', 'shipped', 'delivered'
  orderedAt TIMESTAMP,
  shippedAt TIMESTAMP NULL,
  trackingNumber VARCHAR(255) NULL,
  createdAt TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES user_profiles(id)
);

CREATE INDEX idx_orders_userId ON orders(userId);
CREATE INDEX idx_orders_authorizeNetId ON orders(authorizeNetTransactionId);
```

### saved_addresses (Checkout faster on repeat)

```sql
CREATE TABLE saved_addresses (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  type VARCHAR(50),  -- 'shipping', 'billing'
  name VARCHAR(100),
  address VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(50),
  zip VARCHAR(10),
  country VARCHAR(100),
  isDefault BOOLEAN DEFAULT false,
  createdAt TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES user_profiles(id)
);
```

---

## UX Flow: "Add to Cart" Popup

### Current Flow (Anonymous)
```
Product page
  ↓
[Add to Cart button]
  ↓
Item added to localStorage
  ↓
Cart count updates in header
  ↓
Done
```

### New Flow (With Clerk)

**IF USER NOT LOGGED IN:**
```
Product page
  ↓
[Add to Cart button clicked]
  ↓
Modal appears:
┌─────────────────────────────────────────┐
│                                         │
│  ✓ Item added to cart!                  │
│                                         │
│  Sign in to:                            │
│  • Get 10% off with code WELCOME10      │
│  • Save your cart across devices        │
│  • See your order history               │
│  • Faster checkout next time            │
│                                         │
│  [Sign Up] [Sign In] [Continue Shopping]│
│                                         │
└─────────────────────────────────────────┘
  ↓
User either:
  A) Signs up → redirects to product page logged in
  B) Signs in → redirects to product page logged in
  C) Continues shopping → modal closes, stays on product page
  ↓
Cart saved to localStorage (if not logged in)
```

**IF USER ALREADY LOGGED IN:**
```
Product page
  ↓
[Add to Cart button clicked]
  ↓
Item added to database cart (userId-specific)
  ↓
Toast notification: "Added to cart"
  ↓
Done (no modal, cart synced to account)
```

---

## Account Dashboard (`/dashboard`)

### Protected Route
- Clerk gates it: if not logged in, redirect to `/sign-in`
- If logged in, show user-specific data

### Dashboard Layout

```
┌─ Header ────────────────────────────┐
│ FJ Solar Products                   │
│             [Dashboard] [Logout]    │
└────────────────────────────────────┘

┌─ Sidebar ────────────────────────────┐
│ Dashboard                            │
│ ├─ Overview          ← default view  │
│ ├─ My Orders                         │
│ ├─ Abandoned Carts                   │
│ ├─ Saved Addresses                   │
│ └─ Account Settings                  │
└────────────────────────────────────┘

┌─ Main Content ──────────────────────┐
│ Welcome back, John!                 │
│                                     │
│ ┌─ Quick Stats ──────────────────┐  │
│ │ Active Cart    Items: 3        │  │
│ │ Last Order     Nov 1, 2026     │  │
│ │ Total Spent    $5,432          │  │
│ │ Member Since   Oct 2026        │  │
│ └─────────────────────────────────┘  │
│                                     │
│ ┌─ Recent Orders ─────────────────┐ │
│ │ Order #1234  Nov 1  $1,695 ✓    │ │
│ │ Order #1233  Oct 28 $2,850 ✓    │ │
│ │ Order #1232  Oct 15 $895 ✓      │ │
│ │ [View All Orders →]              │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─ Active Cart ──────────────────┐  │
│ │ Victron BMV-712  × 2           │  │
│ │ $317.90                         │  │
│ │ [Continue to Checkout]          │  │
│ │ [Save for Later]                │  │
│ └─────────────────────────────────┘  │
└────────────────────────────────────┘
```

### Dashboard Pages

#### 1. Overview (Default)
- Welcome message with name
- Quick stats: active cart, last order, total spent, member since
- Recent orders (last 3)
- Active cart status
- Abandoned carts count ("You have 2 saved carts")

#### 2. My Orders (`/dashboard/orders`)

```
┌─ Order #1234 ──────────────────────┐
│ Date: Nov 1, 2026                  │
│ Status: Shipped ✓                  │
│ Tracking: 1Z999AA10123456784      │
│                                    │
│ Items:                             │
│ • Victron BMV-712 × 2 @ $317.90    │
│ • VE.Direct Cable × 1 @ $28.50     │
│                                    │
│ Total: $1,695                      │
│ Shipping Address: 123 Main St...   │
│                                    │
│ [View Details] [Track] [Reorder]   │
└────────────────────────────────────┘
```

**Features:**
- List all orders (newest first)
- Status badge (Processing, Shipped, Delivered)
- Tracking link (if available)
- Quick "Reorder" button (add same items to cart)
- Download invoice (future)

#### 3. Abandoned Carts (`/dashboard/abandoned-carts`)

```
┌─ Saved Cart from Oct 28 ───────────┐
│ Status: Abandoned                  │
│ Value: $4,200                      │
│ Last Modified: Oct 28, 10:30 AM   │
│                                    │
│ Items:                             │
│ • Auto Generator Start × 5         │
│ • External Fan Kit × 2             │
│                                    │
│ [Resume This Cart] [Clear] [More]  │
└────────────────────────────────────┘
```

**Features:**
- List all abandoned carts (most recent first)
- Cart value + items preview
- "Resume" button (loads cart, redirects to /cart/)
- Date since abandoned
- Remove / archive option

#### 4. Saved Addresses (`/dashboard/addresses`)

```
┌─ Shipping Address ──────────────────┐
│ John Dealer                        │
│ 123 Main Street                    │
│ Dallas, TX 75201                   │
│ (Default)                          │
│ [Edit] [Delete]                    │
└────────────────────────────────────┘

┌─ Billing Address ───────────────────┐
│ Same as shipping                   │
│ [Change] [Add Different Address]   │
└────────────────────────────────────┘

[+ Add New Address]
```

**Features:**
- List all saved addresses
- Mark as default
- Edit/delete
- Quick-select during checkout

#### 5. Account Settings (`/dashboard/settings`)

```
Name: John [_____] Dealer [_____]
Email: john@example.com (from Clerk, read-only)
Phone: [+1 (555) 123-4567_______]
Preferred Language: [English ▼]

Email Preferences:
☑ Order updates & tracking
☑ Special offers & deals
☑ Cart recovery emails
☐ SMS notifications

[Save Changes] [Manage Password] [Logout]
```

---

## Cart Sync Logic

### Cart Storage

**Anonymous user (not logged in):**
- Cart stored in `localStorage`
- Survives page refresh/navigation on same device
- Lost on browser clear/different device

**Logged-in user:**
- Cart stored in database (`carts` table, userId)
- Syncs across all devices/browsers
- Survives logout/login
- Persists indefinitely (until converted to order or manually cleared)

### Switching States

**User logs in:**
```javascript
1. Fetch user's cart from database
2. Merge with localStorage cart (if any)
   - Combine items: if product already in both, sum quantities
   - Use database version as source of truth
3. Replace localStorage with merged cart
4. Show toast: "Cart synced from your account"
```

**User logs out:**
```javascript
1. Save current cart to localStorage
2. Clear session
3. localStorage cart persists (anonymous browsing continues)
```

**User switches account:**
```javascript
1. Save current cart to old account (userId)
2. Log out
3. Log in with new account
4. Load new account's cart
5. Show: "Switched to [email]'s cart"
```

---

## First-Time Discount: WELCOME10

### Coupon Config

```json
{
  "code": "WELCOME10",
  "discountType": "percentage",
  "discountValue": 10,
  "appliesTo": ["all"],
  "minQuantity": 1,
  "maxQuantity": null,
  "dealerId": null,
  "usageLimit": null,
  "usagePerCustomer": 1,  // New field: one per account
  "onlyForNewAccounts": true,  // Can only use if account < 7 days old
  "expiresAt": null,
  "active": true
}
```

### Implementation

**In signup flow:**
```javascript
1. User signs up
2. Mark account flag: hasFirstTimeDiscount = true
3. Show banner: "Welcome! Use WELCOME10 for 10% off"
4. Auto-apply code to their cart (optional, or make them apply it)
```

**At checkout:**
```javascript
1. Check if user has hasFirstTimeDiscount = true
2. If yes, show WELCOME10 in suggested coupons
3. If applied, set hasFirstTimeDiscount = false after order completes
```

**Validation:**
```javascript
// In /api/validate-coupon endpoint
if (coupon.code === 'WELCOME10') {
  const user = await clerk.users.getUser(userId)
  const userProfile = await db.getUserProfile(userId)
  
  if (!userProfile.hasFirstTimeDiscount) {
    return { valid: false, error: 'WELCOME10 can only be used once' }
  }
}
```

---

## Abandoned Cart Recovery (Now Account-Tied)

### Automatic Detection

```javascript
// In /cart/ checkout page
if (userLoggedIn && cartExists && !orderCompleted) {
  // After 30 min of inactivity
  setTimeout(() => {
    POST /api/cart/abandon {
      userId: user.id,
      cartId: cart.id,
      cartItems: [...],
      cartTotal: total
    }
  }, 1800000)  // 30 min
}
```

### Recovery

```
1. Cron job detects cart abandoned 3+ hours ago
2. Send email to user@example.com
3. Link: /dashboard/abandoned-carts (shows all saved carts)
4. OR direct link: /cart/?cartId=abc123 (resume specific cart)
5. User resumes → checkout → order placed
```

**Advantage over anonymous:**
- User is logged in → can show past orders, saved addresses
- Can personalize: "Complete your order + save 10% with WELCOME10"
- Track repeat abandonment (same user abandons multiple carts)

---

## Implementation Roadmap

### Phase 1: Clerk Setup + Basic Auth (1-2 weeks)

- [ ] Install Clerk in Astro project
- [ ] Create sign-up/sign-in pages (`/sign-up`, `/sign-in`)
- [ ] Protect dashboard routes with Clerk auth
- [ ] Create basic user_profiles table
- [ ] Store Clerk user ID in our database on first login

### Phase 2: Cart Persistence (1-2 weeks)

- [ ] Create `carts` table (database)
- [ ] Modify `/api/cart/*` endpoints to check if user logged in
- [ ] If logged in: save to database (userId)
- [ ] If not logged in: stay in localStorage (current behavior)
- [ ] Cart sync logic: localStorage ↔ database when logging in/out

### Phase 3: Account Dashboard (2-3 weeks)

- [ ] Build `/dashboard` layout (sidebar + main content)
- [ ] `/dashboard/orders` — list past orders
- [ ] `/dashboard/abandoned-carts` — list saved carts, resume option
- [ ] `/dashboard/addresses` — saved addresses, edit/delete
- [ ] `/dashboard/settings` — profile, email preferences, logout

### Phase 4: Orders + History (1 week)

- [ ] Create `orders` table
- [ ] After checkout success (Authorize.net webhook), create order record
- [ ] Link order to userId
- [ ] Sync order status updates from ShipStation
- [ ] Show in `/dashboard/orders`

### Phase 5: First-Time Discount (1 week)

- [ ] Create WELCOME10 coupon config
- [ ] Add "Reorder" button on past orders (copies items to cart)
- [ ] On signup, set hasFirstTimeDiscount = true
- [ ] Show banner: "Welcome! Use WELCOME10 for 10% off"
- [ ] Validate coupon only works once per account

### Phase 6: Abandoned Cart Recovery (1 week)

- [ ] Detect abandoned carts (userId + no order after 30+ min)
- [ ] 3-email sequence (same as docs/abandoned-cart.md, but personalized)
- [ ] Email includes "/dashboard/abandoned-carts" link or direct `/cart/?cartId=abc`
- [ ] Track recovery metrics per user

### Phase 7: Repeat Order + Wishlist (Future)

- [ ] "Reorder" button on past orders (auto-load items)
- [ ] Wishlist: save items for later (not in cart)
- [ ] Email: "These items are back in stock / on sale"

---

## Files to Create/Modify

```
New Pages:
  src/pages/sign-up.astro           // Clerk signup page
  src/pages/sign-in.astro           // Clerk signin page
  src/pages/dashboard/index.astro   // Dashboard overview
  src/pages/dashboard/orders.astro  // Order history
  src/pages/dashboard/abandoned-carts.astro
  src/pages/dashboard/addresses.astro
  src/pages/dashboard/settings.astro

New API Routes:
  src/pages/api/auth/sync-user.ts   // Create user profile on Clerk signup
  src/pages/api/cart/sync.ts        // Merge localStorage → database
  src/pages/api/cart/save.ts        // Save cart to user account
  src/pages/api/orders/list.ts      // Get user's orders
  src/pages/api/addresses/list.ts   // Get user's saved addresses

New Libraries:
  src/lib/clerk.ts                  // Clerk helpers
  src/lib/user-carts.ts             // Cart sync logic
  src/lib/orders.ts                 // Order queries

Modified Files:
  src/layouts/Layout.astro          // Add sign-in button in header
  src/pages/cart/index.astro        // Add sign-in popup on "Add to Cart"
  src/pages/api/cart/abandon.ts     // Tie to userId instead of email
  .env.local                        // Add CLERK_PUBLISHABLE_KEY, etc
  package.json                      // Add @clerk/astro
```

---

## Environment Variables

```env
# Clerk
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_SIGN_IN_URL=/sign-in
CLERK_SIGN_UP_URL=/sign-up
CLERK_SIGN_OUT_URL=/
CLERK_REDIRECT_URL=http://localhost:3000

# Database (if not using Vercel KV)
DATABASE_URL=postgresql://user:pass@db.neon.tech/fjsolar
```

---

## Success Metrics

| Metric | Baseline | Target (3 mo) | Target (6 mo) |
|--------|----------|---------------|---------------|
| Signup rate (% of visitors) | 0% | 8% | 15% |
| Cart persistence rate | — | 70% (across devices) | 85% |
| Repeat order rate | 0% | 20% (logged-in) | 35% |
| WELCOME10 redemption | — | 60% (of signups) | 75% |
| Abandoned cart recovery (logged-in) | — | 25% | 40% |
| Avg order value (repeat) | — | +15% | +25% |
| Customer lifetime value | — | +50% | +100% |

---

## Why This Beats Anonymous Cart Recovery

| Feature | Anonymous | With Clerk |
|---------|-----------|-----------|
| Email guarantee | 10-20% | 100% |
| Cart persistence | 1 device | All devices |
| Order history | None | Full history |
| Abandoned cart recovery | Blind email | Personalized, account-tied |
| Repeat checkout | Slow | Fast (saved address) |
| Customer identity | Fingerprint | Real user |
| Email personalization | Generic | "Hi John" |
| First-time incentive | None | WELCOME10 |
| Repeat discount | None | Can target repeat customers |
| Lifetime value | Low | High (builds loyalty) |

---

## Notes

- **Clerk is free for <10k monthly active users** — FJ Solar will be well below that
- **Migration from Stripe wasn't your issue; friction is** — Easy signup at add-to-cart moment removes friction
- **WELCOME10 is powerful** — 10% off is worth signing up for most people
- **Repeat orders = repeat customers** — "Reorder" button drives 2x repeat rate in ecommerce
- **This unlocks future features:** loyalty points, bulk discounts, email segmentation, etc.

