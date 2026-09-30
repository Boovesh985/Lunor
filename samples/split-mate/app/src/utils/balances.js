import { splitEvenly } from './money';

// Net balance for every member, in paise.
//   positive → the group owes them money (they paid more than their share)
//   negative → they owe the group
// Every expense adds and subtracts the same amount, so balances sum to zero.
export function computeBalances(members, expenses, settlements) {
  const balances = Object.fromEntries(members.map((member) => [member.id, 0]));
  const add = (memberId, amount) => {
    if (memberId in balances) balances[memberId] += amount;
  };

  for (const expense of expenses) {
    // The payer fronted the whole amount...
    add(expense.paidBy, expense.amount);
    // ...and everyone in the split (payer included) owes their share of it.
    const shares = splitEvenly(expense.amount, expense.splitBetween.length);
    expense.splitBetween.forEach((memberId, index) => add(memberId, -shares[index]));
  }

  for (const payment of settlements) {
    // Paying someone back cancels out part of what you owe them.
    add(payment.from, payment.amount);
    add(payment.to, -payment.amount);
  }

  return balances;
}

// Turns balances into a short list of payments that settles everyone.
// Greedy: match whoever owes the most with whoever is owed the most. Each
// payment clears at least one person, so n people need at most n - 1 payments.
export function suggestSettlements(balances) {
  const debtors = [];
  const creditors = [];
  for (const [memberId, amount] of Object.entries(balances)) {
    if (amount < 0) debtors.push({ memberId, amount: -amount });
    if (amount > 0) creditors.push({ memberId, amount });
  }
  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const payments = [];
  let d = 0;
  let c = 0;
  while (d < debtors.length && c < creditors.length) {
    const amount = Math.min(debtors[d].amount, creditors[c].amount);
    payments.push({ from: debtors[d].memberId, to: creditors[c].memberId, amount });
    debtors[d].amount -= amount;
    creditors[c].amount -= amount;
    if (debtors[d].amount === 0) d += 1;
    if (creditors[c].amount === 0) c += 1;
  }
  return payments;
}

// One member's share of a single expense (0 if they weren't part of the split).
export function shareOf(expense, memberId) {
  const index = expense.splitBetween.indexOf(memberId);
  if (index === -1) return 0;
  return splitEvenly(expense.amount, expense.splitBetween.length)[index];
}
