export interface CartItem {
  slug: string;
  name: string;
  image: string;
  price: number;
  quantity: number;
}

const STORAGE_KEY = 'fj-cart';

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
  const existing = items.find((i) => i.slug === item.slug);
  if (existing) {
    existing.quantity += quantity;
  } else {
    items.push({ ...item, quantity });
  }
  writeRaw(items);
}

export function removeFromCart(slug: string) {
  writeRaw(readRaw().filter((i) => i.slug !== slug));
}

export function setQuantity(slug: string, quantity: number) {
  const items = readRaw();
  const existing = items.find((i) => i.slug === slug);
  if (!existing) return;
  if (quantity <= 0) {
    writeRaw(items.filter((i) => i.slug !== slug));
    return;
  }
  existing.quantity = quantity;
  writeRaw(items);
}

export function clearCart() {
  writeRaw([]);
}
