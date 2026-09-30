/**
 * The SplitMate demo's money logic is plain JavaScript, so we can test it
 * exactly like a student would: balances always sum to zero, splits never
 * lose a paisa, and the settle-up suggestions really settle everyone.
 */
import { describe, expect, it } from 'vitest';
// @ts-expect-error — plain JS sample code without type declarations
import { computeBalances, shareOf, suggestSettlements } from '../samples/split-mate/app/src/utils/balances.js';
// @ts-expect-error — plain JS sample code without type declarations
import { formatMoney, parseAmount, splitEvenly } from '../samples/split-mate/app/src/utils/money.js';
// @ts-expect-error — plain JS sample code without type declarations
import { sampleGroup } from '../samples/split-mate/app/src/data/sampleGroup.js';

type Balances = Record<string, number>;
type Payment = { from: string; to: string; amount: number };
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

describe('money helpers', () => {
  it('parses user input into integer paise', () => {
    expect(parseAmount('250')).toBe(25000);
    expect(parseAmount('99.5')).toBe(9950);
    expect(parseAmount('₹ 1,240.50')).toBe(124050);
    expect(parseAmount('0')).toBeNull();
    expect(parseAmount('1.234')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
  });

  it('formats with Indian digit grouping', () => {
    expect(formatMoney(99900)).toBe('₹999');
    expect(formatMoney(24975)).toBe('₹249.75');
    expect(formatMoney(12345678)).toBe('₹1,23,456.78');
    expect(formatMoney(-5000)).toBe('-₹50');
    expect(formatMoney(5000, { showSign: true })).toBe('+₹50');
  });

  it('splits without losing a paisa', () => {
    expect(splitEvenly(10000, 3)).toEqual([3334, 3333, 3333]);
    for (const [total, count] of [[99901, 4], [1, 3], [123457, 7]] as const) {
      const shares: number[] = splitEvenly(total, count);
      expect(shares).toHaveLength(count);
      expect(sum(shares)).toBe(total);
      expect(Math.max(...shares) - Math.min(...shares)).toBeLessThanOrEqual(1);
    }
    expect(splitEvenly(100, 0)).toEqual([]);
  });
});

describe('balances and settle-up', () => {
  const { members, expenses, settlements } = sampleGroup;

  it('computes the sample room correctly, summing to zero', () => {
    const balances: Balances = computeBalances(members, expenses, settlements);
    expect(balances).toEqual({ me: 31025, aarav: 89025, diya: -47075, kabir: -72975 });
    expect(sum(Object.values(balances))).toBe(0);
  });

  it('suggests at most n - 1 payments that settle everyone exactly', () => {
    const payments: Payment[] = suggestSettlements(computeBalances(members, expenses, settlements));
    expect(payments.length).toBeLessThanOrEqual(members.length - 1);
    const after: Balances = computeBalances(members, expenses, [...settlements, ...payments]);
    expect(Object.values(after).every((b) => b === 0)).toBe(true);
  });

  it('stays zero-sum and settleable for random rooms', () => {
    let seed = 42;
    const random = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    for (let round = 0; round < 200; round++) {
      const room = Array.from({ length: 2 + Math.floor(random() * 6) }, (_, i) => ({ id: `m${i}`, name: `M${i}` }));
      const randomExpenses = Array.from({ length: Math.floor(random() * 12) }, (_, i) => {
        const split = room.filter(() => random() > 0.3);
        return {
          id: `e${i}`,
          amount: 1 + Math.floor(random() * 500000),
          paidBy: room[Math.floor(random() * room.length)]!.id,
          splitBetween: (split.length ? split : room).map((m) => m.id),
        };
      });
      const balances: Balances = computeBalances(room, randomExpenses, []);
      expect(sum(Object.values(balances))).toBe(0);
      const payments: Payment[] = suggestSettlements(balances);
      expect(payments.length).toBeLessThanOrEqual(Math.max(0, room.length - 1));
      expect(payments.every((p) => p.amount > 0 && p.from !== p.to)).toBe(true);
      const after: Balances = computeBalances(room, randomExpenses, payments);
      expect(Object.values(after).every((b) => b === 0)).toBe(true);
    }
  });

  it("reports a member's share of one expense", () => {
    const groceries = expenses.find((e: { id: string }) => e.id === 'e3');
    expect(shareOf(groceries, 'me')).toBe(62000);
    expect(shareOf(expenses.find((e: { id: string }) => e.id === 'e4'), 'diya')).toBe(0);
  });
});
