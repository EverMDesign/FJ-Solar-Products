# Auto-Gen Purchase Email Template — Setup & Integration Guide

## Overview

The "Auto-Gen Purchase" email template is a professional, product-specific thank-you email that automatically populates with customer order details from your GHL custom fields. It includes:

- **Dynamic customer greeting** with first name
- **Order summary** with order number, items, and pricing breakdown
- **Shipping address** confirmation  
- **Product resources block** with links to manuals, FAQs, technical support, and warranty info
- **Support contact information** with email, phone, and hours
- **Responsive design** that looks great on desktop and mobile

---

## Setup Instructions

### Step 1: Create the Email Template in EverReach

1. Open **EverReach** → **Workflows** (or **Automations**)
2. Click **Create Email** or **Add Email Template**
3. Click **Design** or **HTML Editor**
4. Choose **Code Editor** (HTML view)
5. Clear the default content
6. **Copy the entire HTML** from `auto-gen-purchase-email.html`
7. **Paste it** into the HTML editor
8. Click **Save** and name it: **"Auto-Gen Purchase"**

### Step 2: Replace Placeholder URLs

The template includes placeholder URLs that need updating. Search and replace:

| Placeholder | Replace With | Example |
|------------|--------------|---------|
| `faithfuljourneysolar.com/product-manuals` | Your actual manual URL | `fjsolar.com/support/manuals` |
| `faithfuljourneysolar.com/faqs` | Your FAQ page URL | `fjsolar.com/help/faq` |
| `faithfuljourneysolar.com/technical-support` | Your support page URL | `fjsolar.com/support/contact` |
| `faithfuljourneysolar.com/warranty` | Your warranty page URL | `fjsolar.com/warranty` |
| `faithfuljourneysolar.com/contact` | Your contact form URL | `fjsolar.com/contact` |
| `support@faithfuljourneysolar.com` | Your actual support email | `support@fjsolar.com` |
| `1-800-XXX-XXXX` | Your actual phone number | `1-800-SOLAR-21` |
| `www.faithfuljourneysolar.com` | Your website URL | `fjsolar.com` |

**Social Media Links** (also in footer):
- Facebook: `https://facebook.com/faithfuljourneysolar` → Your FB page
- Instagram: `https://instagram.com/faithfuljourneysolar` → Your IG handle
- YouTube: `https://youtube.com/@faithfuljourneysolar` → Your YouTube channel

### Step 3: Add Product Image (Optional)

To display a product image in the email:

1. Find this section in the template (around line 600):
   ```html
   <!-- Optional Product Image Section (uncomment to use) -->
   <!--
   <div class="product-image">
       <img src="[PRODUCT-IMAGE-URL]" alt="Your Product" width="400">
       <div class="product-name">[PRODUCT-NAME]</div>
   </div>
   -->
   ```

2. **Uncomment** the section (remove the `<!--` and `-->`)

3. Replace:
   - `[PRODUCT-IMAGE-URL]` with the actual image URL (use GHL's image library or Vercel CDN)
   - `[PRODUCT-NAME]` with the product name (e.g., "200W Solar Panel")

4. Save

**Note:** Product images should be **300-600px wide** and **under 2MB** for email delivery.

---

## Merge Tags & Custom Fields

The template uses **GHL contact-level custom fields** that are automatically populated when an order is placed. Ensure these fields exist in your GHL account:

| Merge Tag | Custom Field | What It Shows |
|-----------|--------------|---------------|
| `{{contact.firstName}}` | Built-in (Standard) | Customer's first name |
| `{{contact.order_number}}` | Order Number | Authorize.net transaction ID |
| `{{contact.last_order_items}}` | Last Order Items | Formatted list: "Product x Qty @ $Price" |
| `{{contact.order_subtotal}}` | Order Subtotal | Amount before shipping & tax |
| `{{contact.order_shipping}}` | Order Shipping | Calculated shipping cost |
| `{{contact.order_tax}}` | Order Tax | Sales tax (if applicable) |
| `{{contact.order_total}}` | Order Total | Final order amount |
| `{{contact.shipping_address}}` | Shipping Address | Full address with customer name |

**See Also:** `docs/custom-fields-system.md` for the complete field ID reference and data flow.

---

## How to Use This Template

### Scenario 1: Automated Thank-You Email

1. **Create a Workflow** or **Automation** in EverReach
2. **Trigger:** When an opportunity is created with status "New Order" (in the Orders pipeline)
3. **Action:** Send email using "Auto-Gen Purchase" template
4. **To:** The linked contact

This automatically sends thank-you emails when orders are placed.

### Scenario 2: Manual Send

1. Go to a **Contact** in your GHL account
2. Click **Send Email**
3. Select **"Auto-Gen Purchase"** template
4. Review (all merge tags will populate with that contact's data)
5. Click **Send**

### Scenario 3: Product-Specific Version

Create multiple versions of this template for different product categories:
- `Auto-Gen Purchase - Solar Panels`
- `Auto-Gen Purchase - Batteries`
- `Auto-Gen Purchase - Monitoring Equipment`

Each can have different resource links and product images.

---

## Customization Guide

### Change Colors

The template uses FJ Solar brand colors. To change:

Find these color values in the `<style>` section and replace:

| Use | Color Value | Variable Name |
|-----|-------------|---------------|
| Primary Navy | `#1a3a52` | Main headings, borders |
| Secondary Navy | `#2d5a7b` | Links, resource section |
| Gold Accent | `#d4a574` | Highlights, borders, buttons |
| Light Gray BG | `#f9f9f9` or `#f0f8fc` | Sections, summary boxes |

**Example:** To change the gold accent to blue:
- Search: `#d4a574`
- Replace all with: `#0066cc` (your blue)

### Modify Resource Links

Edit the **Product Resources & Support** section (around line 620):

```html
<div class="resource-item">
    <div class="resource-link">
        <a href="YOUR-URL-HERE">→ Your Link Text</a>
    </div>
    <div class="resource-desc">
        Your description here.
    </div>
</div>
```

Copy this block to add more resources (5+ items work fine, but keep it scannable).

### Update Support Information

Find the **Need Assistance?** section (around line 650) and update:

```html
<div class="support-info">
    📧 Email: <a href="mailto:YOUR-EMAIL@domain.com">YOUR-EMAIL@domain.com</a><br>
    📞 Phone: YOUR-PHONE-NUMBER<br>
    🕐 Hours: YOUR-HOURS
</div>
```

---

## Testing

### Before Going Live

1. **Test with real data:**
   - Place a test order on the website
   - A test contact should appear in GHL with order custom fields populated
   - Send yourself the "Auto-Gen Purchase" email using that contact
   - Verify all merge tags populated correctly

2. **Check on mobile:**
   - Most email clients open on phones — use the **Mobile Preview** in GHL
   - Ensure text is readable and layout doesn't break

3. **Verify links:**
   - Click every link in the email to ensure URLs are correct
   - Check that your support contact info is accurate

4. **Test in multiple clients:**
   - Gmail
   - Outlook
   - Apple Mail
   - Mobile clients

### Debugging

If merge tags don't populate:
- Verify the custom field exists in GHL (check Field ID)
- Confirm the order webhook is firing (check `src/pages/api/authorize-webhook.ts` logs)
- Check that the contact has values in those fields (EverReach → Contacts → [Customer] → Custom Fields)
- Try manual send first, then set up automation

---

## Integration with Order Workflow

### Current Data Flow

```
Authorize.net Payment
    ↓
/api/authorize-webhook (on your Vercel app)
    ↓
Creates GHL Contact + Populates Custom Fields
    ↓
Creates GHL Opportunity ("New Order")
    ↓
Workflow Trigger: "New Opportunity Created"
    ↓
Sends "Auto-Gen Purchase" Email
```

### Workflow Setup (EverReach)

1. **Automation > Create Automation**
2. **Trigger Type:** Select "Opportunity" → "Status Changed" or "New Opportunity"
3. **Condition:** Pipeline = "Orders", Stage = "New Order"
4. **Action:** Send Email → Select "Auto-Gen Purchase"
5. **Enable:** Toggle ON
6. **Save**

---

## Best Practices

✅ **DO:**
- Update all placeholder URLs before going live
- Test with a real order before enabling automation
- Keep resource links working and up-to-date
- Monitor email delivery in GHL's email logs
- Create product-specific variants for different product types

❌ **DON'T:**
- Leave placeholder URLs in the template
- Remove required custom field merge tags (will show blank fields)
- Forget to update the support email/phone
- Use image URLs that expire or go offline

---

## Support & Troubleshooting

### Email not sending?
- Check that automation is **enabled** in EverReach
- Verify the trigger (opportunity creation) is firing
- Check GHL's **Email Logs** for bounce/delivery errors

### Merge tags showing as blank?
- Ensure custom fields are populated (check a real contact)
- Verify field IDs match exactly in the webhook code
- See `docs/custom-fields-system.md` for field reference

### Design looks broken on mobile?
- EverReach may compress images — test actual send, not preview
- Use responsive width in `<img>` tags (max-width in CSS handles it)
- Check your email client's mobile view

### Want to add a new section?
- Copy an existing section block (e.g., `resource-item` or `order-section`)
- Update the styling classes and content
- Test before enabling automation

---

## Files Reference

- **Template HTML:** `templates/auto-gen-purchase-email.html`
- **Custom Fields Documentation:** `docs/custom-fields-system.md`
- **Webhook Implementation:** `src/pages/api/authorize-webhook.ts`
- **Checkout Flow:** `docs/checkout.md`

---

## Version History

| Date | Version | Changes |
|------|---------|---------|
| 2026-10-30 | 1.0 | Initial template creation with order details, resources, and support sections |

