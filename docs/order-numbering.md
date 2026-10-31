# Sequential Order Numbering

FJ Solar uses sequential order numbers in the format `FJSP-XXXXXX` (e.g., `FJSP-103026`, `FJSP-103027`). Each order gets the next number in sequence, stored in a GHL location-wide custom value.

## How It Works

### 1. GHL Custom Value

The counter is stored as a location-wide custom value in GHL:
- **Name**: `next_order_number`
- **Merge field**: `{{custom_values.next_order_number}}`
- **Current value**: Retrieved from GHL each time an order arrives
- **Starting value**: 103026 (set manually in GHL when first deployed)

### 2. Order Creation Flow

When an Authorize.net payment succeeds:

1. **Webhook receives payment** → `POST /api/authorize-webhook`
2. **Fetch current counter** → GHL API `GET /locations/{locationId}/custom-values`
3. **Generate order number** → Format as `FJSP-{counter}` (e.g., `FJSP-103026`)
4. **Increment counter** → GHL API `PUT /locations/{locationId}/custom-values`
5. **Create order record** → Store order number in:
   - Contact custom field `ORDER_NUMBER_FIELD_ID`
   - Opportunity name (e.g., "Customer Name — FJSP-103026")
   - Contact timeline notes (order details)

### 3. Code Location

Implementation in `src/pages/api/authorize-webhook.ts`:
- **Function**: `getAndIncrementOrderNumber()`
- **Lines**: 50–99 (fetch, format, increment, update)
- **Called by**: Main POST handler before `upsertGhlContact()`

## Managing the Counter

### View Current Value

In GHL:
1. Go to **Settings** > **Custom Values**
2. Find `next_order_number`
3. Current value shown in the field

### Manually Update Counter

If you need to adjust the counter (e.g., after a test order or manual order):

1. Go to **Settings** > **Custom Values**
2. Edit `next_order_number` to the desired next number
3. Example: If the last order was `FJSP-103025`, set it to `103026`

### Gap in Sequence

If an order fails after the counter increments but before the order is fully created, you'll have a gap. This is acceptable — the counter never goes backwards. To skip the gap number:

1. Manually increment the counter in GHL Custom Values
2. Next successful order will use the new number

## Race Conditions

With low order volume (FJ Solar's current state), race conditions are unlikely. However, if concurrent orders arrive simultaneously:

- Both might read counter value `103026`
- Both might increment to `103027`
- One order gets `FJSP-103026`, the other also gets `FJSP-103026` (duplicate)

**Solution if needed**: Migrate to **Vercel KV** for atomic counter increments. This would require setup; for now, manual monitoring is acceptable.

## Testing

### Sandbox Testing

1. Set `AUTHORIZE_NET_ENVIRONMENT=sandbox` in `.env.local`
2. Process a test payment
3. Check GHL:
   - Order number should be next sequential value
   - Custom value should increment
   - Opportunity name should show order number

### Example

- Before test: `custom_values.next_order_number = 103026`
- Process test order
- Opportunity created: "Test Customer — FJSP-103026"
- After order: `custom_values.next_order_number = 103027`

## Troubleshooting

### Order created but number not incremented

**Cause**: `getAndIncrementOrderNumber()` failed silently
**Check**: Vercel logs for GHL API errors
**Fix**: Manually increment counter in GHL Custom Values

### Multiple orders have the same number

**Cause**: Concurrent orders hit the same counter value (race condition)
**Check**: GHL order records, check timestamps
**Fix**: Manually adjust one order's number in GHL; consider migrating to Vercel KV

### Counter stuck or incorrect

**Fix**: Manually set `next_order_number` in GHL Custom Values to the correct next value

## Future Improvements

- **Vercel KV**: Replace GHL custom value with Redis for atomic counters
- **Monthly reset**: Reset counter monthly (FJSP-2611-001, FJSP-2612-001) for better organization
- **Prefix variants**: Different prefixes for different product types (AGS orders vs. Victron orders)
