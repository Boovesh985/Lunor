// Money helpers. Amounts are stored as whole paise (integers), never as
// decimal rupees: in JavaScript 0.1 + 0.2 !== 0.3, but 10 + 20 === 30.

// Turns what the user typed ("1,240.50", "₹ 99") into paise, or null if invalid.
export function parseAmount(text) {
  const cleaned = String(text).replace(/[₹,\s]/g, '');
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return null;
  const paise = Math.round(Number(cleaned) * 100);
  return paise > 0 ? paise : null;
}

// 123456 paise → "₹1,234.56". Uses Indian digit grouping (₹1,23,456) and
// hides the paise when they are zero.
export function formatMoney(paise, { showSign = false } = {}) {
  const abs = Math.abs(Math.round(paise));
  const rupees = String(Math.floor(abs / 100));
  const cents = abs % 100;

  const lastThree = rupees.slice(-3);
  const rest = rupees.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  const grouped = rest ? `${rest},${lastThree}` : lastThree;
  const value = cents ? `${grouped}.${String(cents).padStart(2, '0')}` : grouped;

  const sign = paise < 0 ? '-' : showSign && paise > 0 ? '+' : '';
  return `${sign}₹${value}`;
}

// Splits a total into `count` shares that add up exactly to the total.
// ₹100 between 3 people → [3334, 3333, 3333] paise; nobody loses a paisa.
export function splitEvenly(total, count) {
  if (count <= 0) return [];
  const base = Math.floor(total / count);
  const remainder = total - base * count;
  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
}
