# Order Numbering

FJ Solar uses Authorize.net's transaction ID to derive order numbers in the format `FJSP-XXXXX` (e.g., `FJSP-34567`). Each order gets a unique customer-facing number derived from the **last 5 digits** of Authorize.net's internal transaction ID, ensuring consistency across Authorize.net, GHL (EverReach), and ShipStation.

## How It Works

### 1. Derive from Authorize.net transId

When an Authorize.net payment succeeds, the webhook receives a `transactionId` from the payment gateway. This ID is:
- **Guaranteed unique** by Authorize.net (never duplicates across transactions)
- **Immediately available** after payment (no external storage needed)
- **Non-sequential but unambiguous** (not a clean counting number, but reliable)

### 2. Order Creation Flow

When an Authorize.net payment succeeds:

1. **Webhook receives payment** → `POST /api/authorize-webhook`
2. **Extract transaction details** → Authorize.net API `getTransactionDetailsRequest`
3. **Derive order number** → `FJSP-` + **last 5 digits** of `transaction.transId`
   - Example: `transId=60171234567` → Order number: `FJSP-34567`
4. **Create order record** → Store order number in:
   - Contact custom field `ORDER_NUMBER_FIELD_ID`
   - Opportunity name (e.g., "Customer Name — FJSP-60171")
   - Contact timeline notes (includes both the customer-facing number and the full `transId` for audit)

### 3. Code Location

Implementation in `src/pages/api/authorize-webhook.ts`:
- **Function**: `deriveOrderNumber(transId: string)` (line ~50)
- **Called by**: Main POST handler, creates order number synchronously (no API calls)

## Order Number Workflow: Authorize.net → GHL → ShipStation

The order number flows through three systems with a unified ID:

```
Authorize.net Payment
    ↓
    transId: 60171234567
    ↓
    Derived Order #: FJSP-34567 (last 5 digits)
    ↓
[Authorize.net Webhook] → POST /api/authorize-webhook.ts
    ↓
    ├─ Create GHL Opportunity
    │  ├─ Name: "Customer Name — FJSP-34567"
    │  ├─ Custom field: FJSP-34567
    │  └─ Timeline note: Full transId for audit + line items with variants
    │
    └─ Create ShipStation Shipment
       └─ external_shipment_id: "FJSP-34567"
          (order number only)
```

### ShipStation Integration

When an order is created, the webhook:

1. Derives the order number from `transId` (last 5 digits)
2. Creates a GHL opportunity with order number in name and custom field
3. Creates a ShipStation shipment with `external_shipment_id: "{orderNumber}"`

The order number is used to link ShipStation orders to GHL opportunities. Shipment status tracking happens in ShipStation's UI (manual).

## Why transId Instead of a Counter?

**Trade-off chosen**: Reliability & simplicity over sequential meaning.

| Aspect | transId-derived | Counter (prior approach) |
|--------|-----------------|-------------------------|
| **Uniqueness** | Guaranteed by Authorize.net | Depends on external storage |
| **Race conditions** | Zero (Authorize.net handles it) | Possible with concurrent orders |
| **Storage needed** | None (read-only) | GHL custom value (API dependency) |
| **Sequential meaning** | No (looks random) | Yes (FJSP-103026, 103027, ...) |
| **Lookups** | Match by full `transId` in GHL note | Match by shortened number |
| **Failure risk** | Only if Authorize.net changes API | Counter increments can silently fail |

This approach reverted from a GHL custom-value counter (deployed 2026-10-30) after the counter's write endpoint became unavailable on this account.

## Collision Risk

Last 5 digits = ~100,000 possible customer-facing numbers. For FJ Solar's expected order volume (hundreds/year), collision odds are effectively zero. However, the full `transaction.transId` is always stored in the contact timeline note as the authoritative, unambiguous identifier for audits and lookups.

## Testing

### Sandbox Testing

1. Set `AUTHORIZE_NET_ENVIRONMENT=sandbox` in `.env.local`
2. Process a test payment with variant options
3. Check GHL and ShipStation:
   - **GHL opportunity name**: `FJSP-XXXXX` (derived from last 5 digits of sandbox transId)
   - **GHL timeline note**: 
     - Order number and full transId
     - **Line items with variants** (e.g., "Victron SmartShunt 500A - Current Monitor")
   - **ShipStation external_shipment_id**: `FJSP-XXXXX` (order number only)

### Example Output

For a sandbox transaction with `transId=60171234567`:
- **Order number derived**: `FJSP-34567` (last 5 digits)
- **GHL opportunity name**: "Test Customer — FJSP-34567"
- **GHL timeline note**: "Order #FJSP-34567" + "Authorize.net Transaction ID: 60171234567" + line items with variants
- **ShipStation external_shipment_id**: "FJSP-34567"

## Future: Atomic Counters via Vercel KV

If sequential order numbers become important, migrate to **Vercel KV** (Redis) for atomic counter increments. This would:
- Restore sequential numbering (FJSP-103026, 103027, ...)
- Eliminate race conditions automatically
- Require no external API dependencies
- See plan file `/Users/Ever/.claude/plans/iterative-painting-journal.md` for migration notes
