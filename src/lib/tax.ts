// Flat FL sales tax: Hernando County (current ship-from) combined state + county rate:
// 6% FL state + 0.5% Hernando County surtax = 6.5%. Only applies when shipping TO a Florida
// address, since that's where the business has nexus.
export const FL_TAX_RATE = 0.065;

export function calculateTaxCents(subtotalCents: number, state: string | undefined | null): number {
  if ((state || '').trim().toUpperCase() !== 'FL') return 0;
  return Math.round(subtotalCents * FL_TAX_RATE);
}
