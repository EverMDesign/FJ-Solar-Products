# Webhooks Overview

This document describes all webhooks used in the FJ Solar store system and how they integrate with Authorize.net, ShipStation, and EverReach (GHL).

## Architecture

```
Customer Order
    ↓
Authorize.net Payment
    ↓
├─ Authorize.net Webhook → /api/authorize-webhook
│  ├─ Verifies signature
│  ├─ Fetches transaction details
│  ├─ Upserts GHL contact
│  ├─ Creates GHL Opportunity
│  ├─ Adds order note to contact
│  └─ Creates ShipStation shipment
│
└─ ShipStation Webhook → /api/shipstation-webhook
   ├─ Monitors shipment status
   └─ Updates GHL opportunity to "Completed" when shipped
```

---

## 1. Authorize.net Webhook

**Purpose:** Process payment confirmations and sync order data to GHL

### Registration

- **Event ID:** `af0fe111-5d3a-4bd2-a4cc-17e588a21140`
- **Event Type:** `net.authorize.payment.authcapture.created`
- **URL:** `https://www.fjsolarproducts.com/api/authorize-webhook`
- **Status:** ✅ Registered (2026-10-29) — **Updated to live domain (2026-10-30)**

### How It Works

1. **Customer completes payment** on `/checkout/`
2. **Authorize.net processes transaction** (real charge)
3. **Authorize.net fires webhook** → `POST /api/authorize-webhook`
4. **Our webhook:**
   - Verifies signature (HMAC-SHA512)
   - Calls `getTransactionDetailsRequest` to fetch full customer/billing info
   - **Upserts GHL contact** with:
     - Customer name, email, phone, address
     - Tags: `Customer`, `FJ Solar Store`, `fjsp-new-order`
     - Custom fields: order number, items, address, subtotal, shipping, tax, total
   - **Creates GHL Opportunity** in "Orders" pipeline:
     - Stage: "New Order"
     - Linked to contact
     - Monetary value: order total
   - **Adds order note** to contact timeline with full order details
   - **Creates ShipStation shipment** (unlabeled):
     - Links to opportunity via `external_shipment_id`
     - Contains items with SKU, quantity, price, weight

### Key Details

- **Signature Verification:** Uses `X-ANET-Signature` header (HMAC-SHA512 of raw body)
- **Field Names:** `transaction.billTo.*`, `transaction.customer.email` (documented, not yet verified against real response)
- **Custom Fields Created:** 8 contact-level fields for order data
- **Tag Triggers:** `fjsp-new-order` tag watched by EverReach workflow to send new-order-alert email to Andrew

### Endpoint Code

**File:** `src/pages/api/authorize-webhook.ts`

### When to Update

- ⚠️ **Custom domain goes live:** Update URL via `PUT https://api.authorize.net/rest/v1/webhooks/af0fe111-5d3a-4bd2-a4cc-17e588a21140` with new domain

---

## 2. ShipStation Webhook

**Purpose:** Monitor shipment status and automatically update GHL opportunity when shipped

### Registration

- **Event Type:** `shipmentshipped`
- **URL:** `https://www.fjsolarproducts.com/api/shipstation-webhook`
- **Friendly Name:** `FJ Solar - Mark Order Complete`
- **Status:** ✅ Registered (manual setup in ShipStation) — **URL updated to live domain (2026-10-30)**

### How It Works

1. **Andrew creates shipment** in ShipStation (from our auto-created order)
2. **Andrew prints label** and marks shipment as "shipped"
3. **ShipStation fires webhook** → `POST /api/shipstation-webhook`
4. **Our webhook:**
   - Extracts `external_shipment_id` (GHL Opportunity ID)
   - Makes `PUT` request to GHL Opportunities API
   - **Updates opportunity status to `won`** (= "Completed")
   - Order fulfillment tracking complete!

### Key Details

- **Event Payload:** Contains shipment ID and external reference (our opportunity ID)
- **Status Update:** Sets `status: 'won'` (GHL's "Completed" status)
- **No Insurance:** Unlike FJ Solar products, Victron products use flat $15 shipping with no insurance added
- **Real-Time:** Updates happen immediately when shipment is marked shipped

### Endpoint Code

**File:** `src/pages/api/shipstation-webhook.ts`

### When to Update

- ⚠️ **Custom domain goes live:** Update webhook URL in ShipStation settings (just change the URL field, no need to recreate)

---

## 3. LeadConnector (GHL) Native ShipStation Webhooks

**Note:** These are separate from our custom webhooks. GHL receives ShipStation fulfillment events natively at:

```
https://services.leadconnectorhq.com/store-marketplace/shipstation/webhook/9Xlh2V4MI9gfWXNitjME
```

**Events received:**
- `FULFILLMENT_SHIPPED` — Shipment marked as shipped
- `FULFILLMENT_REJECTED` — Shipment rejected/returned
- `ITEM_SHIP_NOTIFY` — Individual items shipped
- `SHIP_NOTIFY` — Order shipped

**Current use:** GHL receives these events but doesn't automatically act on them. Our custom webhook (`shipstation-webhook.ts`) handles the opportunity status update instead.

---

## Order Data Flow

### What Gets Captured

From Authorize.net transaction:

| Field | GHL Location | Purpose |
|-------|--------------|---------|
| Transaction ID | `contact.order_number` | Order identifier |
| Line items | `contact.last_order_items` | What was ordered |
| Subtotal | `contact.order_subtotal` | Pre-tax/shipping amount |
| Shipping | `contact.order_shipping` | Calculated shipping cost |
| Tax | `contact.order_tax` | Sales tax (FL only) |
| Total | `contact.order_total` | Final charged amount |
| Ship-to address | `contact.shipping_address` | Delivery address |
| Customer name | `contact.firstName`, `contact.lastName` | Billing name |
| Customer email | Standard contact field | Communication |
| Customer phone | Standard contact field | Fulfillment contact |

### Where Data Goes

1. **GHL Contact** — Customer profile with all order data as custom fields
2. **GHL Opportunity** — "Orders" pipeline entry with monetary value
3. **GHL Note** — Detailed order summary on contact timeline
4. **ShipStation Shipment** — Items, weight, dimensions, customer address

---

## Troubleshooting

### Authorize.net Webhook

**Problem:** Webhook not firing after payment
- Check webhook is registered: `GET https://api.authorize.net/rest/v1/webhooks` (Basic auth)
- Verify URL is correct and accessible
- Check Authorize.net logs for delivery failures

**Problem:** GHL contact not created
- Check webhook signature verification passed (see logs)
- Verify field names match actual Authorize.net response
- Check GHL API token is valid and has contact write permission

**Problem:** ShipStation shipment not created
- Verify `SHIPSTATION_API_KEY` is set in environment
- Check ShipStation API response for errors (see logs)
- Verify product SKUs match ShipStation inventory

### ShipStation Webhook

**Problem:** Webhook not updating opportunity
- Verify webhook is registered in ShipStation
- Test manually: mark a shipment as shipped, check logs for webhook fire
- Verify `external_shipment_id` is correctly stored on opportunity (should be opportunity UUID)
- Check GHL API token is valid and has opportunity write permission

**Problem:** Webhook fires but opportunity doesn't update
- Check our API is receiving the POST (enable request logging)
- Verify opportunity ID extraction is correct
- Check GHL API response for errors (authorization, invalid ID, etc.)

---

## Required Environment Variables

| Variable | Used By | Purpose |
|----------|---------|---------|
| `AUTHORIZE_NET_API_LOGIN_ID` | authorize-webhook | Signature verification |
| `AUTHORIZE_NET_TRANSACTION_KEY` | authorize-webhook | Signature verification |
| `AUTHORIZE_NET_SIGNATURE_KEY` | authorize-webhook | Signature verification |
| `PIT_TOKEN` | authorize-webhook, shipstation-webhook | GHL API authentication |
| `LOCATION_ID` | authorize-webhook, shipstation-webhook | GHL location identifier |
| `SHIPSTATION_API_KEY` | authorize-webhook (shipment creation) | ShipStation API auth |
| `GHL_API_BASE` | authorize-webhook, shipstation-webhook | GHL API endpoint (defaults to services.leadconnectorhq.com) |

---

## Related Documentation

- **Checkout Flow:** `docs/checkout.md` — Complete payment/shipping flow
- **Custom Fields:** `docs/custom-fields-system.md` — Order data storage in GHL
- **Email Templates:** `docs/AUTO-GEN-PURCHASE-TEMPLATE.md` — Uses webhook data to populate emails
- **ShipStation Integration:** `src/lib/shipstation.ts` — Helper functions for shipment creation

---

## Summary

**Two critical webhooks power the order flow:**

1. **Authorize.net** → Payment received → Create GHL order record + ShipStation shipment
2. **ShipStation** → Shipment shipped → Mark GHL order as completed

Both run automatically. Updates required when custom domain goes live.
