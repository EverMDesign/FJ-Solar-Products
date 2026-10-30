# Authorize.net Integration — Accept Hosted Checkout

## Overview (User-Friendly)

The FJ Solar website uses **Authorize.net's Accept Hosted** service to handle payment securely. Here's the customer journey:

1. **Customer adds items to cart** → proceeds to `/cart/`
2. **On cart page, customer enters:**
   - First name & last name
   - Street address
   - City, State, ZIP, Country
3. **Customer clicks "Get Shipping Rate"** → calculates USPS shipping
4. **Customer clicks "Checkout"** → opens Authorize.net's secure payment form in an embedded iframe
5. **On Authorize.net form, customer enters:**
   - Email address (pre-filled if set)
   - Card details (card number, expiration, CVV)
   - Billing address (pre-filled from cart form)
   - (Shipping address hidden — we already collected it)
6. **Customer clicks "Pay"** → payment processes
7. **Authorize.net webhook notifies us** → order syncs to EverReach + ShipStation
8. **Customer redirected to thank-you page** → sees order confirmation

**Why Authorize.net?** PCI compliance. We never touch the customer's card number — Authorize.net's iframe handles that securely.

---

## How Name Data Flows

### Cart Page → Authorize.net Form

```
Customer enters on /cart/:
├─ First Name: "John"
├─ Last Name: "Doe"
├─ Street: "123 Main St"
├─ City: "Dallas"
├─ State: "TX"
├─ ZIP: "75001"
└─ Country: "US"
        ↓
JavaScript collects FormData
        ↓
Sent to /api/create-authorize-session as:
{
  "items": [...],
  "shippingCents": 1500,
  "address": {
    "firstName": "John",
    "lastName": "Doe",
    "street": "123 Main St",
    "city": "Dallas",
    "state": "TX",
    "zip": "75001",
    "country": "US"
  }
}
        ↓
API builds Authorize.net request:
{
  "transactionRequest": {
    "billTo": {
      "firstName": "John",
      "lastName": "Doe",
      "address": "123 Main St",
      "city": "Dallas",
      "state": "TX",
      "zip": "75001",
      "country": "US"
    },
    "shipTo": {
      "firstName": "John",
      "lastName": "Doe",
      "address": "123 Main St",
      "city": "Dallas",
      "state": "TX",
      "zip": "75001",
      "country": "US"
    }
  }
}
        ↓
Authorize.net returns a token
        ↓
Token sent to browser, iframe loads Authorize.net form
        ↓
Form displays with pre-filled billing address + name
```

---

## Technical Details

### 1. Cart Page Form (`src/pages/cart.astro`)

**Name fields added to shipping form:**
```html
<p class="text-sm font-semibold text-fj-navy">Your name</p>
<div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
  <input name="firstName" required placeholder="First name" />
  <input name="lastName" required placeholder="Last name" />
</div>
<p class="text-sm font-semibold text-fj-navy">Shipping address</p>
<input name="street" required placeholder="Street address" />
<!-- ... rest of address fields ... -->
```

**JavaScript collects the form and sends to API:**
```javascript
const formData = new FormData(shippingForm);
const address = {
  firstName: String(formData.get('firstName') || ''),
  lastName: String(formData.get('lastName') || ''),
  street: String(formData.get('street') || ''),
  city: String(formData.get('city') || ''),
  state: String(formData.get('state') || ''),
  zip: String(formData.get('zip') || ''),
  country: String(formData.get('country') || 'US'),
};

const res = await fetch('/api/quote-shipping', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ items: getCart(), address }),
});
```

### 2. Create Authorize Session API (`src/pages/api/create-authorize-session.ts`)

**Receives address with firstName/lastName:**
```javascript
const address = body.address || {};
// address now has: firstName, lastName, street, city, state, zip, country
```

**Builds billTo and shipTo objects for Authorize.net:**
```javascript
billTo: {
  firstName: address.firstName || '',
  lastName: address.lastName || '',
  address: address.street || '',
  city: address.city || '',
  state: address.state || '',
  zip: address.zip || '',
  country: address.country || 'US',
},
shipTo: {
  firstName: address.firstName || '',
  lastName: address.lastName || '',
  address: address.street || '',
  city: address.city || '',
  state: address.state || '',
  zip: address.zip || '',
  country: address.country || 'US',
},
```

**Authorize.net API request:**
```javascript
const requestBody = {
  getHostedPaymentPageRequest: {
    merchantAuthentication: {
      name: apiLoginId,
      transactionKey,
    },
    transactionRequest: {
      transactionType: 'authCaptureTransaction',
      amount: totalAmount,
      lineItems: { lineItem },
      tax: { ... },
      shipping: { ... },
      billTo: { firstName, lastName, ... },
      shipTo: { firstName, lastName, ... },
    },
    hostedPaymentSettings: {
      setting: [
        { settingName: 'hostedPaymentIFrameCommunicatorUrl', ... },
        { settingName: 'hostedPaymentStyleOptions', settingValue: JSON.stringify({ bgColor: '#EBAF16' }) },
        { settingName: 'hostedPaymentCustomerOptions', settingValue: JSON.stringify({ showEmail: true, requiredEmail: true }) },
        { settingName: 'hostedPaymentShippingAddressOptions', settingValue: JSON.stringify({ show: false }) },
        { settingName: 'hostedPaymentReturnOptions', ... },
      ],
    },
  },
};
```

### 3. Authorize.net Hosted Form Configuration

**Key settings:**

| Setting | Value | Purpose |
|---------|-------|---------|
| `hostedPaymentStyleOptions` | `{ bgColor: '#EBAF16' }` | FJ Gold accent color for buttons |
| `hostedPaymentCustomerOptions` | `{ showEmail: true, requiredEmail: true }` | Show email field (required by Authorize.net account settings) |
| `hostedPaymentShippingAddressOptions` | `{ show: false }` | Hide shipping section (we already collected it) |
| `hostedPaymentIFrameCommunicatorUrl` | Points to `public/authorize-net-communicator.html` | Allows iframe to communicate success/cancel back to parent page |

### 4. Iframe Communication (`public/authorize-net-communicator.html`)

Authorize.net's hosted form runs in an iframe. When payment succeeds/fails, it needs to tell the parent page. This is done via `postMessage`:

```html
<script>
  window.addEventListener('message', function(event) {
    // Authorize.net posts a message when payment completes
    if (event.data && event.data.response) {
      // Parent page (cart.astro) receives this and redirects
      window.parent.postMessage(event.data, '*');
    }
  });
</script>
```

**In `src/pages/checkout.astro` (iframe parent):**
```javascript
const iframeEl = document.getElementById('checkout-iframe');

window.addEventListener('message', (event) => {
  if (event.source !== iframeEl.contentWindow) return;
  
  // Handle response from Authorize.net form
  if (event.data?.response?.[0]?.messages?.[0]?.code === '1') {
    // Success: redirect to thank-you page
    window.location.href = '/thank-you/';
  } else {
    // Error: show error message
    errorEl.textContent = event.data?.response?.[0]?.messages?.[0]?.text || 'Payment failed';
  }
});
```

### 5. Checkout Page Flow (`src/pages/checkout.astro`)

1. Retrieves session data (items, shipping cost, address) from `sessionStorage` (set by cart.astro)
2. Creates a hidden form to POST the Authorize.net token to their payment page
3. Renders an iframe containing the secure payment form
4. Listens for `postMessage` from iframe when payment completes
5. Redirects to `/thank-you/` on success or shows error on failure

**Form submission to Authorize.net:**
```javascript
const form = document.createElement('form');
form.method = 'POST';
form.action = paymentUrl; // https://accept.authorize.net/payment/payment (or sandbox)
form.innerHTML = `<input type="hidden" name="token" value="${token}" />`;
form.submit();
```

### 6. Webhook Processing (`src/pages/api/authorize-webhook.ts`)

After payment succeeds, Authorize.net sends a webhook to `/api/authorize-webhook`:

1. **Verifies webhook signature** (HMAC-SHA512) to ensure it came from Authorize.net
2. **Fetches full transaction details** from Authorize.net API
3. **Extracts billTo data:**
   ```javascript
   const billTo = transaction.billTo || {};
   // billTo now has: firstName, lastName, address, city, state, zip, country, email
   ```
4. **Uses the name to:**
   - Upsert GHL contact (first/lastName stored in contact record)
   - Create GHL Opportunity (used in opportunity name: "John Doe — Order #12345")
   - Create ShipStation shipment (used in shipment ship_to name)

---

## Important Details

### Name is Required
Authorize.net's account settings require a Ship To name even though we hide the shipping section. If firstName/lastName is missing, the payment fails with "Ship To First Name is required."

**Solution:** We always collect name on the cart page. If a customer somehow bypasses that, the checkout won't create a session token.

### Shipping Address Hidden
The hosting payment form no longer shows the shipping address section because:
- We already collected it on `/cart/`
- Showing it caused visual bugs on narrow widths (Order Summary amounts went blank)
- We pre-fill it in the API call; Authorize.net uses it even when hidden

### Local Dev Testing
Authorize.net rejects `localhost` URLs for return/cancel pages. When running locally:
- The API detects `localhost` and swaps in the production domain (`https://fj-solar-products.vercel.app`)
- This only affects the return URLs Authorize.net knows about
- The actual webhook handling still happens on your local machine (cart.astro's iframe catches the `postMessage`)

```javascript
const isLocalDev = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
const origin = isLocalDev ? 'https://fj-solar-products.vercel.app' : `${url.protocol}//${url.host}`;
```

### Transaction Data Structure
Authorize.net's `getTransactionDetails` response has these fields we rely on:
- `transaction.transId` → order number
- `transaction.authAmount` → total amount captured
- `transaction.billTo.firstName/lastName/address/city/state/zip/country`
- `transaction.shipTo.firstName/lastName/address/city/state/zip/country`
- `transaction.customer.email`
- `transaction.lineItems` → array of items ordered
- `transaction.tax.amount` → if FL tax applies
- `transaction.shipping.amount` → shipping cost

---

## Environment Variables

```env
AUTHORIZE_NET_API_LOGIN_ID=xxxxx          # Sandbox or production
AUTHORIZE_NET_TRANSACTION_KEY=xxxxx       # Sandbox or production
AUTHORIZE_NET_ENVIRONMENT=sandbox         # or "production"
```

Switch environments by updating these. Webhook URL also needs to be updated in Authorize.net dashboard when custom domain goes live.

---

## Webhook Registration

**Current webhook:**
- Event: `net.authorize.payment.authcapture.created`
- URL: `https://fj-solar-products.vercel.app/api/authorize-webhook`
- Webhook ID: `af0fe111-5d3a-4bd2-a4cc-17e588a21140`

**When custom domain goes live:**
Update the webhook URL via Authorize.net dashboard or API:
```
PUT /webhooks/af0fe111-5d3a-4bd2-a4cc-17e588a21140
{ "url": "https://your-custom-domain.com/api/authorize-webhook" }
```

---

## Testing Checklist

- [ ] Add item to cart
- [ ] Fill in first name, last name, address
- [ ] Click "Get Shipping Rate"
- [ ] Click "Checkout"
- [ ] Verify Authorize.net form loads in iframe
- [ ] Verify first/last name is NOT shown (shipping section hidden)
- [ ] Verify billing address is pre-filled
- [ ] Verify email field is shown and required
- [ ] Complete payment with test card (sandbox: `4111 1111 1111 1111`, any future expiry)
- [ ] Verify webhook fires (check Vercel logs)
- [ ] Verify contact created/updated in EverReach
- [ ] Verify Opportunity created in "Orders" pipeline
- [ ] Verify shipment created in ShipStation

---

## Files & References

- **Cart page:** `src/pages/cart.astro`
- **Checkout page:** `src/pages/checkout.astro`
- **Create session API:** `src/pages/api/create-authorize-session.ts`
- **Webhook handler:** `src/pages/api/authorize-webhook.ts`
- **Iframe communicator:** `public/authorize-net-communicator.html`
- **Related docs:** `docs/checkout.md`, `docs/custom-fields-system.md`

