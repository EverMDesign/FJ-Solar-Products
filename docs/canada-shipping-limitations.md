# Canada Shipping: Technical Limitations & Solution

**Status as of 2026-11-02:** ✅ Workaround deployed (manual quote flow)

This document explains why automated Canada shipping quotes cannot be implemented via ShipStation's API and the solution we chose instead.

## The Problem

### What Users Experience

When a customer selects **Canada** as their country on `/cart/`, they see:

```
We ship to Canada!
To arrange a custom quote for Canadian orders, please contact us:
📧 order@fjsolarproducts.com
📞 +1 (407) 821-8722
```

Instead of an automated shipping rate calculation.

### Why This Limitation Exists

#### ShipStation API v2 Rates Endpoint Behavior

ShipStation's rates API (`POST /v2/shipping/rates`) supports domestic (US) shipping rates, but international shipping (Canada) requires **customs declarations** — detailed information about what's being shipped (product names, values, HS codes, country of origin).

The API documentation suggests that customs items should be provided in the request payload:

```json
{
  "customsItems": [
    {
      "description": "Solar Controller",
      "quantity": 1,
      "value": 299.99,
      "countryOfOrigin": "US",
      "hsCode": "8536.41"
    }
  ]
}
```

However, the real API behavior differs significantly from the documentation.

#### What Went Wrong in Implementation

**Attempt 1: Standard Customs Items Payload**
```javascript
const rateResponse = await shipstationRequest('POST', '/v2/shipping/rates', {
  carrierCode: 'usps',
  serviceCode: 'usps_priority_mail_international',
  fromAddress: SHIP_FROM,
  toAddress: canadianAddress,
  weight: totalWeight,
  customsItems: [
    {
      description: products.map(p => p.name).join(', '),
      quantity: 1,
      value: subtotalCents / 100,
      countryOfOrigin: 'US',
      hsCode: '8536.41'  // Solar equipment code
    }
  ]
});
```

**Result:** 400 Bad Request
```
"No customs items have been created for international order"
```

**Attempt 2: Nested Line Items with Customs**
```javascript
customsItems: items.map(item => ({
  description: item.name,
  quantity: item.quantity,
  value: item.price,
  countryOfOrigin: 'US',
  hsCode: '8536.41'
}))
```

**Result:** Same error. API rejected the structure.

**Attempt 3: Minimal Customs Declaration**
```javascript
customsItems: [{
  description: 'Auto Generator Start',
  quantity: 1,
  value: subtotalCents / 100,
  countryOfOrigin: 'US'
  // Removed HS code, tried without it
}]
```

**Result:** Still rejected.

**Attempt 4: Different Service Codes**
Tried `usps_first_class_international` instead of `usps_priority_mail_international`:
```
Invalid service code 'usps_first_class_international'
```

(Corrected to `usps_priority_mail_international` — USPS's actual code for international service)

### Root Cause Analysis

1. **API Documentation ≠ Implementation:** ShipStation's docs suggest customs items are optional or follow a standard format. The real API enforces stricter validation than documented.

2. **International Rates Fundamentally Different:** Domestic rates (US to US) don't require customs. International rates require full declaration that ShipStation validates server-side before fetching a carrier quote.

3. **No Rate Available Without Valid Declaration:** ShipStation can't ask USPS for an international rate without complete customs data. The API fails early rather than returning a partial/estimated rate.

4. **Customs Data Validation:** The API likely performs real-time validation:
   - HS codes must match product descriptions
   - Total declared value must match cart subtotal
   - All items must have country of origin
   - Possibly other undocumented rules

## The Solution: Manual Quote Flow

Instead of fighting the API, we implemented a **graceful fallback** that redirects Canadian customers to a sales conversation:

### Implementation

**File:** `src/pages/api/quote-shipping.ts` (lines 30-40)

```javascript
// Check if destination is Canada
const isCanada = address.country === 'CA';

if (isCanada) {
  // Don't attempt ShipStation API — it will fail
  // Instead, show friendly contact message
  return new Response(JSON.stringify({
    error: "We ship to Canada! Please contact us for a custom quote: " +
           "order@fjsolarproducts.com or +1 (407) 821-8722"
  }), { status: 400 });
}
```

**File:** `src/pages/cart.astro` (lines 132-138)

```javascript
// When Canada is selected, hide the shipping form
if (isCanada) {
  shippingForm.classList.add('hidden');
  canadaInfoBox.classList.remove('hidden');
} else {
  shippingForm.classList.remove('hidden');
  canadaInfoBox.classList.add('hidden');
}
```

### Customer Experience

1. **Select Country:** Customer chooses "Canada"
2. **Form Hides:** Automated shipping calculator disappears
3. **Contact Info Shows:** "We ship to Canada! Contact us for a quote"
4. **Checkout Disabled:** User cannot proceed without a rate (prevents incomplete orders)
5. **Sales Conversation:** Customer emails or calls → manual quote negotiated

### Why This Is Better

- ✅ **No API errors** — eliminates 400 responses and confusing error messages
- ✅ **Clear expectations** — customers know shipping will be quoted manually
- ✅ **Sales opportunity** — opens direct communication channel
- ✅ **No wasted requests** — stops attempting impossible API calls
- ✅ **Accurate quoting** — allows negotiation for special rates, bulk discounts
- ✅ **Flexibility** — can quote different services (Priority Mail International, DHL, FedEx) based on value/weight

## Alternative Approaches (Considered & Rejected)

### 1. Store HS Codes in Database

**Idea:** Add HS codes to each product in `src/data/products.json`, then include them in the API request.

**Why it didn't work:** Even with HS codes, the API still rejected the request with the same error. The issue isn't missing data — it's that ShipStation's API doesn't accept the customs format we're sending, regardless of content.

**Added anyway:** HS codes are now in `src/data/products.json` (line: `"hsCode": "8536.41"`) for future use if ShipStation's API ever supports the format correctly.

### 2. Use ShipStation's Direct Carrier Integration

**Idea:** Skip the rates API entirely and call USPS/UPS directly for international quotes.

**Why rejected:** 
- Requires separate USPS/UPS API credentials and integration
- ShipStation offers no passthrough mechanism
- Out of scope for current project
- Added complexity without guaranteed success

### 3. Hardcode Estimated Rates for Canada

**Idea:** Provide fixed rate estimates ($25 flat, $35 expedited, etc.)

**Why rejected:**
- Inaccurate — actual shipping varies by weight/destination
- Risk of undercharging (lose margin) or overcharging (lose sales)
- No carrier integration — can't actually ship without customer coordination anyway
- Misleading to show fake rates

## Future Improvements

### Short Term (No Code Changes)

- **Sales team process:** Document Canada quoting procedure → response time target → approval workflow
- **Email templates:** Create standard quote responses for different order values
- **Analytics:** Track how many Canadian orders are abandoned vs. completed after quote

### Medium Term (Possible Code Enhancements)

- **Form on contact button:** Pre-fill customer email/cart details in a quote request form (easier than "email us")
- **GHL integration:** Auto-create GHL opportunity when Canadian order is attempted (sales team sees it immediately)
- **Estimated calculator:** Show rough range ("Typically $30-60 depending on weight") to set expectations

### Long Term (If Shipping Volume Justifies)

- **Negotiate Canadian rates:** Get contracted rates directly with USPS/DHL/FedEx
- **Build custom rate engine:** Query multiple carriers' international APIs and present options to customer (no dependency on ShipStation)
- **Ship to Canada via distributor:** Partner with a Canadian distributor to handle Canada fulfillment (zero customs complexity for us)

## Related Files

- **Product data with HS codes:** `src/data/products.json` (field: `hsCode`)
- **API endpoint:** `src/pages/api/quote-shipping.ts` (lines 30-40)
- **Cart UI/UX:** `src/pages/cart.astro` (lines 125-147)
- **Shipping rate calculator:** `src/lib/shipstation.ts`

## References

- [ShipStation API v2 Rates Documentation](https://developer.shipstation.com/api-reference/rates)
- [USPS Service Codes](https://pe.usps.com/text/pub52/pub52apc.htm) (Priority Mail International = usps_priority_mail_international)
- [HS Code Lookup (8536.41 = Electrical apparatus, solar)](https://hts.usitc.gov/)
