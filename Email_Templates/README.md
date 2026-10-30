# FJ Solar Products — Order Flow Email Templates

Three HTML templates, built to the brand style guide (`fj-navy` #060E1A, `fj-green` #54876C, `fj-cream` #F3EBDD, `fj-sand` #E7DBC3, `fj-gold` #EBAF16; Montserrat headings / Inter body). Table-based layout with inline styles for email-client compatibility, 600px container, mobile-responsive.

| File | Sends to | Trigger |
|---|---|---|
| `new-order-alert.html` | Andrew (internal) | Payment captured / Opportunity created |
| `order-thank-you.html` | Customer | Order marked complete |
| `review-request-followup.html` | Customer | ~2–3 weeks after order completion |

## Before importing into EverReach

Each template uses GHL's standard contact/business merge fields (`{{contact.first_name}}`, `{{business.email}}`, `{{unsubscribe_link}}`, etc.) — those work out of the box. The "View in EverReach" button in `new-order-alert.html` is already a live link: `https://app.everreach.link/v2/location/9Xlh2V4MI9gfWXNitjME/contacts/detail/{{contact.id}}` — location ID is FJ Solar Products' real one, `{{contact.id}}` resolves per-contact automatically.

The **order-specific** fields are placeholders using GHL's custom values syntax and need a source before go-live:

- `{{custom_values.order_number}}`
- `{{custom_values.order_line_items}}`
- `{{custom_values.order_subtotal}}` / `order_shipping` / `order_tax` / `order_total`
- `{{custom_values.shipping_address}}`
- `{{custom_values.product_name}}` / `product_doc_link` / `product_video_link`
- `{{custom_values.review_link}}` (review-request-followup only)

These need to be populated by whatever creates the GHL Opportunity/contact note at checkout (see the `authorize-webhook.ts` extension discussed with Ever — not built yet) — either as GHL custom values set via the API at order time, or as workflow merge fields if the trigger carries that data natively.

`product_doc_link` / `product_video_link` are blocked on Andrew sending the install docs and walkthrough videos per product (tracked in the site's `TODO.md`).
