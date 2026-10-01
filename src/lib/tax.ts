// Flat FL sales tax: Marion County (Ocala, current ship-from) combined state + county rate,
// confirmed with Andrew 2026-10-01 — straight from Florida DOR form DR-15DSS (2026): 6% state
// + 1.5% Marion County surtax = 7.5%. Only applies when shipping TO a Florida address, since
// that's where the business has nexus. Andrew said this holds "until we move on the 15th" —
// the move changes the ship-from county, which may change this rate. Re-confirm after that
// move (see SHIP_FROM_* vars in docs/deployment.md, which also need updating then).
export const FL_TAX_RATE = 0.075;

export function calculateTaxCents(subtotalCents: number, state: string | undefined | null): number {
  if ((state || '').trim().toUpperCase() !== 'FL') return 0;
  return Math.round(subtotalCents * FL_TAX_RATE);
}
