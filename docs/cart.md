# Cart

The cart is entirely client-side — no server, no database. It lives in the shopper's browser only.

## Backend: `src/lib/cart.ts`

Not a "backend" in the server sense — this is the one shared module every cart UI reads and writes through. Storage is `localStorage`, key `fj-cart`, value a JSON array of:

```ts
interface CartItem {
  slug: string;
  name: string;
  image: string;
  price: number;
  quantity: number;
}
```

Exported functions: `getCart()`, `getCartCount()`, `addToCart(item, quantity?)`, `removeFromCart(slug)`, `setQuantity(slug, quantity)`, `clearCart()`.

**Every write dispatches a `cart:updated` custom event** on `window`, with `{ detail: { count } }`. This is how the header's cart-count badge and the drawer stay in sync without any shared state manager — they just listen for that event. If you add a new place that changes the cart, make sure it goes through these functions (not direct `localStorage` calls) so that event still fires.

If `localStorage` is unavailable (private browsing, blocked storage), writes silently no-op — the cart just won't persist. This is intentional, not a bug to fix reactively.

## Frontend: 3 places cart UI lives

1. **Header badge** (`src/layouts/Layout.astro`) — shows `getCartCount()` on load, updates on `cart:updated`. Clicking "Cart" fires a `cart:open` event rather than navigating — that's what opens the drawer.
2. **Slide-out drawer** (`src/components/CartDrawer.astro`) — listens for `cart:open` to slide in, renders line items with qty +/- and remove, shows a running subtotal. **This is a preview, not checkout** — its primary button links to `/cart/`, it does not start a payment session. See `docs/checkout.md` for why (shipping rate has to happen first).
3. **Cart page** (`src/pages/cart.astro`) — the real checkout entry point. Renders full line items, a shipping address form, calls `/api/quote-shipping` for a rate, then `/api/create-authorize-session` to start Authorize.net's hosted checkout.

## Adding a product to the cart

Any element with class `add-to-cart-btn` or `add-to-cart-icon` and `data-slug` / `data-name` / `data-image` / `data-price` attributes gets wired up automatically by the click handler in `index.astro`'s script (and separately in `products/[slug].astro`'s script, since that page doesn't share the homepage's script bundle). If you add a new "add to cart" button somewhere else, you need to wire its own click handler — it's not automatic site-wide.
