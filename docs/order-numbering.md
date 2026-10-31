# Order Numbering

FJ Solar uses Authorize.net's transaction ID to derive order numbers in the format `FJSP-XXXXXX` (e.g., `FJSP-847291`). Each order gets a unique customer-facing number derived from Authorize.net's internal transaction ID.

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
3. **Derive order number** → `FJSP-` + last 6 digits of `transaction.transId`
   - Example: `transId=60171234567` → Order number: `FJSP-234567`
4. **Create order record** → Store order number in:
   - Contact custom field `ORDER_NUMBER_FIELD_ID`
   - Opportunity name (e.g., "Customer Name — FJSP-234567")
   - Contact timeline notes (includes both the customer-facing number and the full `transId` for audit)

### 3. Code Location

Implementation in `src/pages/api/authorize-webhook.ts`:
- **Function**: `deriveOrderNumber(transId: string)` (line ~50)
- **Called by**: Main POST handler, creates order number synchronously (no API calls)

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

Last 6 digits = ~1,000,000 possible customer-facing numbers. For FJ Solar's expected order volume (hundreds/year), collision odds are effectively zero. However, the full `transaction.transId` is always stored in the contact timeline note as the authoritative, unambiguous identifier for audits and lookups.

## Testing

### Sandbox Testing

1. Set `AUTHORIZE_NET_ENVIRONMENT=sandbox` in `.env.local`
2. Process a test payment
3. Check GHL:
   - Opportunity name shows `FJSP-XXXXXX` (derived from sandbox transId)
   - Contact timeline note shows both the shortened order number and the full transId

### Example Output

For a sandbox transaction with `transId=60171234567`:
- **Opportunity name**: "Test Customer — FJSP-234567"
- **GHL timeline note**: "Order #FJSP-234567" + "Authorize.net Transaction ID: 60171234567"

## Future: Atomic Counters via Vercel KV

If sequential order numbers become important, migrate to **Vercel KV** (Redis) for atomic counter increments. This would:
- Restore sequential numbering (FJSP-103026, 103027, ...)
- Eliminate race conditions automatically
- Require no external API dependencies
- See plan file `/Users/Ever/.claude/plans/iterative-painting-journal.md` for migration notes
