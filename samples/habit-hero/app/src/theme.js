// Design tokens: every colour, spacing value and text style used in the app
// lives here, so changing HabitHero's look means editing one file.

export const colors = {
  background: '#F6F5FB',
  surface: '#FFFFFF',
  primary: '#6C5CE7',
  primarySoft: '#EDEAFD',
  text: '#1E1B39',
  textMuted: '#6E6A86',
  border: '#E6E3F2',
  success: '#22B07D',
  danger: '#E5484D',
};

// Colours and icons a user can pick for a new habit.
export const habitColors = ['#6C5CE7', '#22B07D', '#FF8A3D', '#E5484D', '#2F9BFF', '#D946EF'];
export const habitEmojis = ['💧', '📚', '🏃', '🧘', '💻', '🥗', '😴', '✍️', '🎸', '🧹'];

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const radius = {
  sm: 8,
  md: 16,
  lg: 24,
  pill: 999,
};

export const typography = {
  title: { fontSize: 28, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  heading: { fontSize: 17, fontWeight: '700', color: colors.text },
  body: { fontSize: 15, color: colors.text },
  caption: { fontSize: 13, color: colors.textMuted },
};
