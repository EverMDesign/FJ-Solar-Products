export interface CartItem {
  slug: string;
  name: string;
  image: string;
  price: number;
  quantity: number;
  variantOptionId?: string;
  variantName?: string;
  weightOz?: number;
  dimensions?: { length: number; width: number; height: number; unit: string } | null;
  // Note: price contains the variant price if variant is selected, otherwise product base price
}

const STORAGE_KEY = 'fj-cart';

// Two variants of the same product (e.g. Negative/Positive signal) are separate cart lines.
function sameLine(a: Pick<CartItem, 'slug' | 'variantOptionId'>, b: Pick<CartItem, 'slug' | 'variantOptionId'>) {
  return a.slug === b.slug && (a.variantOptionId || '') === (b.variantOptionId || '');
}

function readRaw(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeRaw(items: CartItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // storage unavailable (private mode, etc.) — cart just won't persist
  }
  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  window.dispatchEvent(new CustomEvent('cart:updated', { detail: { count } }));
}

export function getCart(): CartItem[] {
  return readRaw();
}

export function getCartCount(): number {
  return readRaw().reduce((sum, item) => sum + item.quantity, 0);
}

export function addToCart(item: Omit<CartItem, 'quantity'>, quantity = 1) {
  const items = readRaw();
  const existing = items.find((i) => sameLine(i, item));
  if (existing) {
    existing.quantity += quantity;
  } else {
    items.push({ ...item, quantity });
  }
  writeRaw(items);

  // Track with Meta Pixel
  if (typeof window !== 'undefined' && window.fbq) {
    window.fbq('track', 'AddToCart', {
      value: item.price * quantity,
      currency: 'USD',
      content_name: item.name,
      content_ids: [item.slug],
      content_type: 'product',
      quantity: quantity,
    });
  }
}

export function removeFromCart(slug: string, variantOptionId?: string) {
  writeRaw(readRaw().filter((i) => !sameLine(i, { slug, variantOptionId })));
}

export function setQuantity(slug: string, variantOptionId: string | undefined, quantity: number) {
  const items = readRaw();
  const existing = items.find((i) => sameLine(i, { slug, variantOptionId }));
  if (!existing) return;
  if (quantity <= 0) {
    writeRaw(items.filter((i) => !sameLine(i, { slug, variantOptionId })));
    return;
  }
  existing.quantity = quantity;
  writeRaw(items);
}

export function clearCart() {
  writeRaw([]);
}
