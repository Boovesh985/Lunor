// Starter data so the app is useful on first launch. Dates are relative to
// "now", so the sample activity always looks recent. Amounts are in paise.
const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (days) => new Date(Date.now() - days * DAY).toISOString();

export const sampleGroup = {
  name: 'Room 204',
  currentUserId: 'me',
  members: [
    { id: 'me', name: 'You' },
    { id: 'aarav', name: 'Aarav' },
    { id: 'diya', name: 'Diya' },
    { id: 'kabir', name: 'Kabir' },
  ],
  expenses: [
    { id: 'e4', title: 'Late-night Maggi', amount: 36000, category: 'food', paidBy: 'kabir', splitBetween: ['me', 'aarav', 'kabir'], createdAt: daysAgo(1) },
    { id: 'e3', title: 'DMart groceries', amount: 248000, category: 'groceries', paidBy: 'aarav', splitBetween: ['me', 'aarav', 'diya', 'kabir'], createdAt: daysAgo(2) },
    { id: 'e2', title: 'Wi-Fi recharge', amount: 99900, category: 'internet', paidBy: 'diya', splitBetween: ['me', 'aarav', 'diya', 'kabir'], createdAt: daysAgo(4) },
    { id: 'e1', title: 'Electricity bill', amount: 240000, category: 'utilities', paidBy: 'me', splitBetween: ['me', 'aarav', 'diya', 'kabir'], createdAt: daysAgo(6) },
  ],
  settlements: [{ id: 's1', from: 'kabir', to: 'me', amount: 50000, createdAt: daysAgo(1) }],
};

// What a brand-new group looks like before anything is loaded.
export const emptyGroup = {
  name: 'My room',
  currentUserId: 'me',
  members: [{ id: 'me', name: 'You' }],
  expenses: [],
  settlements: [],
};
