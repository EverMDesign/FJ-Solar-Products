# Custom Fields System — Order Data in EverReach

## Overview (User-Friendly)

When a customer places an order on the FJ Solar website, we automatically capture their order details and store them in their **EverReach (GHL) contact record** using custom fields. These fields let you see order information directly in the contact's profile, and they can be used in automated emails to show customers what they ordered, how much they paid, and where it's shipping.

**What gets captured:**
- Order number (from Authorize.net)
- Items ordered with prices
- Shipping address
- Order subtotals (before shipping/tax)
- Shipping cost
- Tax amount
- Total order amount

All of this happens automatically — no manual data entry. The data flows from the payment form → Authorize.net → our webhook → EverReach.

---

## How It Works (Technical)

### 1. Custom Fields in EverReach

Seven custom contact fields were created in the FJ Solar Products pipeline (2026-10-30). These store per-order data:

| Field Name | Field ID | Type | Used In |
|------------|----------|------|---------|
| Last Order Items | `vPKiThQLwX2I5S3FmSkc` | Text (HTML) | Email, contact profile |
| Order Number | `VLEflKOf8wEPVWdwiwPo` | Text | Email, contact profile |
| Shipping Address | `3sZBfBcBsLcSmsGOAzUO` | Text (HTML) | Email, contact profile |
| Order Subtotal | `RmjTyByucr5yapmHY8Hu` | Currency | Email, contact profile |
| Order Shipping | `CRkQnxjjn6RMIrzTKE1s` | Currency | Email, contact profile |
| Order Tax | `ZlQ6cAmVi7fBDC64H465` | Currency | Email, contact profile |
| Order Total | `Hg860V4KvRtjprIM66vM` | Currency | Email, contact profile |

**Important:** These are **contact-level fields**, not location-level Custom Values. Each contact has their own set of values. Repeat customers get their latest order data (replacing previous order data in these fields).

### 2. Data Flow

```
Customer Order
    ↓
Authorize.net Payment (getTransactionDetails)
    ↓
/api/authorize-webhook (webhook processor)
    ↓
├→ upsertGhlContact()
│  ├─ Extracts: name, email, address, phone
│  ├─ Calculates: subtotal, shipping, tax, total
│  ├─ Formats: items list (HTML <br>-joined), shipping address (HTML)
│  └─ Populates: 7 custom fields via GHL API
│
├→ createNewOrderOpportunity()
│  ├─ Creates GHL Opportunity in "Orders" pipeline
│  ├─ Links to contact
│  └─ Sets monetary value (order total)
│
└→ createShipStationShipment()
   ├─ Extracts: items with SKU, weight, dimensions
   ├─ Links: external_shipment_id = Opportunity ID
   └─ Creates: unlabeled shipment for Andrew to label
```

### 3. Authorize.net Webhook

**Endpoint:** `POST /api/authorize-webhook`
**Triggered by:** Authorize.net event `net.authorize.payment.authcapture.created`
**Webhook URL:** https://fj-solar-products.vercel.app/api/authorize-webhook (must update when custom domain goes live)

The webhook:
1. Verifies the request signature (HMAC-SHA512)
2. Fetches full transaction details from Authorize.net
3. Extracts `billTo`, `shipTo`, `lineItems`, amounts
4. Calls `upsertGhlContact()` to update/create the contact and populate custom fields
5. Calls `createNewOrderOpportunity()` to track the order in the pipeline
6. Calls `createShipStationShipment()` to create the fulfillment record

**File:** `src/pages/api/authorize-webhook.ts`

### 4. Custom Field Population

**In `upsertGhlContact()`:**

```javascript
// Items: name, quantity, unit price (HTML formatted with <br> breaks)
const itemsHtml = getLineItems(transaction)
  .map(item => `${item.name} x${item.quantity} @ $${item.unitPrice}`)
  .join('<br>');

// Shipping address: customer name + street + city, state, zip (HTML formatted)
const shippingAddressHtml = [
  `${shipTo.firstName} ${shipTo.lastName}`,
  shipTo.address,
  `${shipTo.city}, ${shipTo.state} ${shipTo.zip}`
].filter(Boolean).join('<br>');

// Money amounts: formatted to 2 decimals with $ prefix
const money = (n) => `$${n.toFixed(2)}`;

// Sent to GHL via customFields array with field IDs
customFields: [
  { id: LAST_ORDER_ITEMS_FIELD_ID, fieldValue: itemsHtml },
  { id: ORDER_NUMBER_FIELD_ID, fieldValue: transaction.transId },
  { id: SHIPPING_ADDRESS_FIELD_ID, fieldValue: shippingAddressHtml },
  { id: ORDER_SUBTOTAL_FIELD_ID, fieldValue: money(subtotalAmount) },
  { id: ORDER_SHIPPING_FIELD_ID, fieldValue: money(shippingAmount) },
  { id: ORDER_TAX_FIELD_ID, fieldValue: money(taxAmount) },
  { id: ORDER_TOTAL_FIELD_ID, fieldValue: money(totalAmount) },
]
```

### 5. Using Custom Fields in Emails

In EverReach email templates, reference these fields with `{{contact.FIELD_NAME}}`:

```
Order #{{contact.order_number}}

Items:
{{contact.last_order_items}}

Shipping to:
{{contact.shipping_address}}

Subtotal: {{contact.order_subtotal}}
Shipping: {{contact.order_shipping}}
Tax: {{contact.order_tax}}
Total: {{contact.order_total}}
```

**Note:** If using location-wide Custom Values instead ({{custom_values.X}}), the values are shared across all contacts in that location — wrong for per-order data. Always use {{contact.X}} for these fields.

### 6. Related Systems

**SKU Integration:**
- SKUs come from GHL product pricing (Inventory section)
- Pulled via `npm run fetch-products`
- Used in ShipStation shipment line items
- See `docs/product-catalog.md` for details

**Authorize.net Integration:**
- Embedded iframe checkout on `/checkout/` page
- Collects: first name, last name, billing address, email, card
- Shipping address pre-filled from `/cart/` form
- Hosted form style: `fj-gold` accent color
- See `docs/checkout.md` for full details

**GHL Opportunities:**
- Created in "Orders" pipeline (ID: `1hY3ZSKUDcn6JGnbpjxk`)
- Stage: "New Order" (ID: `2084ca26-91fb-4dd4-b4a3-e1d5532631a7`)
- Linked to contact
- Linked to ShipStation shipment via `external_shipment_id`

**ShipStation Integration:**
- Shipments created with customer contact info
- Items include SKU (from products.json), name, quantity, unit price
- Weight calculated from product dimensions
- See `src/lib/shipstation.ts` for shared constants

---

## Common Tasks

### View Custom Fields for a Contact
1. Open EverReach → Contacts
2. Click on a customer
3. Scroll to "Custom Fields" section
4. See all 7 order fields populated

### Update the Order Data Format
Edit `src/pages/api/authorize-webhook.ts`:
- `itemsHtml` → format of items list
- `shippingAddressHtml` → format of shipping address
- `money()` → currency formatting
- Re-deploy to Vercel

### Add a New Custom Field
1. Create field in EverReach (Contacts > Custom Fields)
2. Get the field ID from the GHL API or UI
3. Add constant to `authorize-webhook.ts` (e.g., `const NEW_FIELD_ID = 'xxx'`)
4. Add to `customFields` array in `upsertGhlContact()`
5. Deploy

### Test the Webhook
1. Place a test order via the website
2. Check Vercel runtime logs: `vercel logs`
3. Search for "GHL contact upsert" or the contact name
4. Verify the contact appears in EverReach with custom fields populated

---

## Files & References

- **Webhook handler:** `src/pages/api/authorize-webhook.ts`
- **Field IDs:** Constants at top of `authorize-webhook.ts`
- **GHL API:** See `Docs/leadconnector-api.md` (not yet in this repo)
- **Checkout flow:** `docs/checkout.md`
- **Product catalog:** `docs/product-catalog.md`
- **SKU system:** `src/lib/shipstation.ts`

