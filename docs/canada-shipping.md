# Canada Shipping

## Status

**Canada shipping is available via custom quote only.**

ShipStation's API does not support automated customs declaration for rate calculation, which is required for USPS Priority Mail International to Canada. 

## How Customers Order to Canada

1. Customer adds items to cart
2. Enters Canada address in checkout
3. Shipping calculation returns: "We ship to Canada! Please contact us for a custom quote: sales@fjsolarproducts.com or +1 (407) 821-8722"
4. Customer contacts sales for quote
5. Sales provides custom rate based on weight/destination
6. Customer can then proceed with order (manual payment processing)

## Why Manual?

- ShipStation's v2 `/rates` API doesn't support customs item declaration
- Customs forms are required for international USPS shipments
- Rates vary significantly by package size and destination postal code
- Custom quotes ensure accurate pricing and compliance

## Technical Details

**API Endpoint**: `POST /api/quote-shipping`

When `address.country === 'CA'`:
- Returns 400 error with contact information
- No automatic rate calculation available
- User is directed to sales team

**Products Ready for Canada**:
- All products have required HS (Harmonized Tariff) codes:
  - Auto Generator Start (both): 8536.41
  - Victron External Fan Kit: 8414.59.15
  - Others: [HS codes to be added as needed]

## Future Options

If ShipStation's API is updated to support customs:
1. Remove this manual flow
2. Implement automated rate calculation
3. Display rates directly in checkout

For now, manual quotes ensure accuracy and compliance.
