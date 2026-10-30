# Product Variants & Multi-Dimensional Dropdowns

## Overview

FJ Solar products support **multi-dimensional variants** — products with multiple independent options that combine to create different SKUs. For example, the Onboard AGS has two dimensions: Signal Type (Negative/Positive) and WAGO Connectors (Yes/No).

Each combination gets its own price from GHL and flows through the entire checkout → order system as a single line item with the full variant description.

## Data Structure

### In `src/data/products.json`

Products with variants have three new fields:

```json
{
  "name": "Auto Generator Start – Onboard Generators",
  "variantGroups": [
    {
      "name": "Signal Type",
      "options": ["Negative", "Positive (Pre Configured)", "Positive (DIY)"]
    },
    {
      "name": "WAGO Electrical Connectors",
      "options": ["Yes", "No"]
    }
  ],
  "variants": [
    {
      "optionId": "6x7t35hksjc",
      "name": "Negative / Yes",
      "options": ["Negative", "Yes"],
      "price": 338,
      "weightOz": 96,
      "dimensions": { "length": 8, "width": 6, "height": 4, "unit": "in" }
    },
    // ... more variant combinations
  ]
}
```

**Key fields:**
- **`variantGroups`** — Metadata: dimension names and available options for each dimension
- **`variants`** — All possible combinations with pricing and shipping data
  - **`name`** — Combined format: "Negative / Yes" (used throughout the checkout flow)
  - **`options`** — Parsed array: ["Negative", "Yes"] (for matching dropdown selections)
  - **`price`** — GHL pricing for this specific combination
  - **`weightOz`** & **`dimensions`** — For ShipStation shipping rate calculations

## How Variants Are Populated

### 1. Data Source: GHL Products

In GHL, variants are defined per product:
- **Variant Groups** — The dimensions (e.g., "Signal Type", "WAGO Connectors")
- **Variant Prices** — Each combination has its own price entry in GHL's Inventory section

### 2. Fetch Script: `scripts/fetch-products.mjs`

The `npm run fetch-products` command:

1. **Fetches from GHL API** — Pulls products, variant groups, and variant prices
2. **Parses variant names** — Splits combined names by " / " delimiter
   ```javascript
   const parsedOptions = variantName.split(' / ').map(s => s.trim());
   // "Negative / Yes" → ["Negative", "Yes"]
   ```
3. **Captures variant groups** — Builds `variantGroups` array with all available options per dimension
4. **Maps prices** — Each variant combo keeps its GHL price
5. **Writes to `products.json`** — All data stored locally for fast product page rendering

**Warning:** The script logs placeholder weights for products without shipping data set in GHL:
```
⚠ 6 product(s) still have a placeholder weight (16oz) — correct these for real shipping rates
```

## Frontend: Product Detail Page

### 1. Separate Dropdowns

`src/pages/products/[slug].astro` renders one dropdown per variant dimension:

```html
{product.variantGroups.map((group, idx) => (
  <select id={`variant-group-${idx}`} class="variant-select">
    <option value="">Select {group.name}</option>
    {group.options?.map((option) => (
      <option value={option}>{option}</option>
    ))}
  </select>
))}
```

Each dropdown is independent — users can select from any dimension in any order.

### 2. Default Selections

Defined in the product page component:

```javascript
const PRODUCT_DEFAULTS: Record<string, string[]> = {
  'auto-generator-start-onboard-generators': ['Negative', 'No'],
  'auto-generator-start-portable-generators': ['15\'', 'No', 'Westinghouse'],
};
```

On page load, the script applies defaults:
```javascript
const defaults = JSON.parse(defaultsJson);
defaults.forEach((defaultValue: string, idx: number) => {
  if (selects[idx] && defaultValue) {
    selects[idx].value = defaultValue;
  }
});
updatePriceFromSelections(); // Apply default price
```

### 3. Price Matching & Updates

When a user changes any dropdown, the script:

1. **Collects selected values** from all dropdowns
2. **Matches against variant combinations** by parsing the variant `name` field
   ```javascript
   const vOptions = variant.name.split(' / ').map(s => s.trim());
   // Matches ["Negative", "Yes"] against user selections
   ```
3. **Applies the matching variant's price** to the button
   ```javascript
   btn.dataset.price = String(matchedVariant.price);
   ```
4. **Updates shipping info** if dimensions are available
   ```javascript
   // "Ships in a 8 × 6 × 4 in box, 6.00 lb"
   ```

## Checkout Flow

### 1. Add to Cart

When the user clicks "Add to Cart", the product page script includes the variant:

```javascript
const item = {
  slug: btn.dataset.slug,
  name: btn.dataset.name,
  price: Number(btn.dataset.price), // Variant price
  variantOptionId: btn.dataset.variantOptionId,
  variantName: btn.dataset.variantName, // e.g., "Negative / Yes"
  // ... other fields
};
addToCart(item);
```

Cart items are stored in localStorage with full variant details.

### 2. Shipping Quote

When the user requests a shipping rate:

1. **Cart page** calls `POST /api/quote-shipping`
2. **API** looks up each product in `products.json` to get weight & dimensions
3. **ShipStation** returns rate based on total weight and destination
4. Uses variant price (from cart) for declared value insurance

### 3. Authorize.net Checkout

`POST /api/create-authorize-session` creates the payment session:

1. **Looks up variant prices** from the cart items
2. **Creates line items** for Authorize.net with:
   ```javascript
   {
     itemId: "slug:variantOptionId",  // e.g., "onboard-ags:6x7t35hksjc"
     name: "Product Name - Variant 1 / Variant 2",  // Full variant combo
     unitPrice: variantPrice,
     description: fullName  // Untruncated for GHL
   }
   ```

### 4. Order Sync to GHL

When Authorize.net webhook arrives (`POST /api/authorize-webhook`):

1. **Reconstructs variant combo** from `itemId` (slug:variantOptionId format)
   ```javascript
   const [slug, variantId] = itemId.split(':');
   const variant = product.variants.find(v => v.optionId === variantId);
   // Gets: "Negative / Yes"
   ```
2. **Builds order notes** with full product name + variant
   ```
   - Auto Generator Start – Onboard Generators – Negative / Yes x1 @ $338.00
   ```
3. **Creates contact + opportunity** in GHL with the full variant combo
   - Custom field `last_order_items` stores full untruncated names
   - Contact notes show complete order details

## Key Design Decisions

### 1. Variant Names as Delimiter-Separated Strings

Instead of storing variants as structured objects, we use a simple string format: `"Negative / Yes / Westinghouse"`. This:
- **Survives truncation** — When Authorize.net truncates to 31 chars, we can still reconstruct from the `slug:variantId` pair
- **Is human-readable** — Shows exactly what the customer ordered
- **Matches GHL display** — GHL shows combined variant names the same way

### 2. Separate Storage of Variant Metadata

`variantGroups` is purely metadata for the UI — it's not used by any backend logic. This keeps:
- **Dropdowns dynamic** — Just loop over `variantGroups[i].options`
- **Parsing simple** — Variant matching just splits the `name` field
- **Scalable** — Adding a 4th or 5th dimension is just a new group in the array

### 3. Default Selections

Defaults are hardcoded per product in the frontend, not stored in `products.json`. This:
- **Reduces data bloat** — Not every product needs default logic
- **Makes changes fast** — No fetch-products cycle needed
- **Is simple to test** — Just edit the constant and reload

## Testing Variants

### 1. Product Page

1. Navigate to a multi-variant product (Onboard AGS, Portable AGS)
2. Verify dropdowns appear with correct options
3. Check defaults are applied (Onboard should show "Negative" and "No")
4. Verify price updates when you change selections
5. Check "Add to Cart" button includes variant price

### 2. Cart Page

1. Add variant product to cart
2. Check cart shows correct variant name (e.g., "Negative / Yes")
3. Verify price matches the variant price (not base product price)
4. Check shipping rate calculation works (if product has weight/dimensions)

### 3. Checkout → GHL

1. Complete checkout with a variant product
2. Check GHL contact notes show full variant combo
3. Verify custom field shows untruncated product name + variant
4. Confirm order reflects correct variant price

## Troubleshooting

### Dropdowns not showing
- Check `product.variantGroups` is defined and has options
- Verify `product.variants` array has length > 0
- Check browser console for errors in the script

### Price not updating
- Ensure variant options exactly match the split variant names
- Check that `btn.dataset.price` is being set correctly
- Verify all dropdowns are filled before expecting a price match

### Missing weights/dimensions
- Run `npm run fetch-products` to sync from GHL
- Check GHL product has shipping weight/dimensions set at the **product level**
- Look for the warning message in fetch output

### Variant combos not appearing in GHL
- Verify `variantName` is being passed through cart → checkout → webhook
- Check webhook is parsing `itemId` correctly (should be `slug:variantOptionId`)
- Confirm `description` field is being sent to Authorize.net
