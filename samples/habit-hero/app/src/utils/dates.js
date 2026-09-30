// Dates are stored as "YYYY-MM-DD" strings ("date keys"). They ignore the
// time of day, compare easily, and can be saved as JSON without surprises.
export function toDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function daysAgo(count) {
  const date = new Date();
  date.setDate(date.getDate() - count);
  return date;
}

// The last `count` days, oldest first — the order a weekly chart needs.
export function lastNDays(count) {
  return Array.from({ length: count }, (_, i) => daysAgo(count - 1 - i));
}

// A streak is the number of consecutive completed days ending today.
// If today isn't done yet we start counting from yesterday, so an
// unfinished day doesn't break the streak until it is over.
export function calculateStreak(completedDates) {
  const done = new Set(completedDates);
  let offset = done.has(toDateKey()) ? 0 : 1;
  let streak = 0;
  while (done.has(toDateKey(daysAgo(offset)))) {
    streak += 1;
    offset += 1;
  }
  return streak;
}

export function formatToday() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

export function shortWeekday(date) {
  return date.toLocaleDateString('en-US', { weekday: 'narrow' });
}
