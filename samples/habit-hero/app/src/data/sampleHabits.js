import { daysAgo, toDateKey } from '../utils/dates';

// Turns a pattern like "-xx-x" into date keys. Index 0 is today, index 1 is
// yesterday, and so on; "x" means the habit was done that day.
function history(pattern) {
  return pattern
    .split('')
    .map((mark, index) => (mark === 'x' ? toDateKey(daysAgo(index)) : null))
    .filter(Boolean);
}

// Seed data so the app looks alive on first launch. Dates are generated
// relative to today, so the streaks are always realistic.
export const sampleHabits = [
  {
    id: 'h1',
    name: 'Drink 8 glasses of water',
    emoji: '💧',
    color: '#2F9BFF',
    createdAt: toDateKey(daysAgo(20)),
    completedDates: history('-xxxxxx-xxxx-x'),
  },
  {
    id: 'h2',
    name: 'Solve one DSA problem',
    emoji: '💻',
    color: '#FF8A3D',
    createdAt: toDateKey(daysAgo(20)),
    completedDates: history('xxxxxxxxx-xx'),
  },
  {
    id: 'h3',
    name: 'Read 20 pages',
    emoji: '📚',
    color: '#6C5CE7',
    createdAt: toDateKey(daysAgo(12)),
    completedDates: history('-xx-xxx-x'),
  },
  {
    id: 'h4',
    name: 'Morning run',
    emoji: '🏃',
    color: '#22B07D',
    createdAt: toDateKey(daysAgo(9)),
    completedDates: history('--x-x-xx'),
  },
];
