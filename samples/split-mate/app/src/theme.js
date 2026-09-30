// Design tokens: every colour, spacing value and text style used in SplitMate
// lives here, so the whole app changes look by editing one file.

export const colors = {
  background: '#F4F6FB',
  surface: '#FFFFFF',
  primary: '#2563EB',
  primaryDark: '#1E3A8A',
  primarySoft: '#E8EFFE',
  text: '#0F172A',
  textMuted: '#64748B',
  border: '#E2E8F0',
  positive: '#16A34A',
  positiveSoft: '#DCFCE7',
  negative: '#DC2626',
  negativeSoft: '#FEE2E2',
};

// Each roommate gets one of these colours for their avatar.
export const avatarColors = ['#2563EB', '#F97316', '#10B981', '#A855F7', '#EC4899', '#0EA5E9', '#CA8A04'];

// Expense categories: an Ionicons glyph and a tint for each.
export const categories = [
  { id: 'groceries', label: 'Groceries', icon: 'cart-outline', color: '#16A34A' },
  { id: 'utilities', label: 'Electricity', icon: 'flash-outline', color: '#CA8A04' },
  { id: 'internet', label: 'Wi-Fi', icon: 'wifi-outline', color: '#0EA5E9' },
  { id: 'rent', label: 'Rent', icon: 'home-outline', color: '#A855F7' },
  { id: 'food', label: 'Food', icon: 'fast-food-outline', color: '#F97316' },
  { id: 'other', label: 'Other', icon: 'pricetag-outline', color: '#64748B' },
];

export function getCategory(id) {
  return categories.find((category) => category.id === id) ?? categories[categories.length - 1];
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const radius = {
  sm: 8,
  md: 14,
  lg: 22,
  pill: 999,
};

export const typography = {
  title: { fontSize: 28, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  heading: { fontSize: 17, fontWeight: '700', color: colors.text },
  body: { fontSize: 15, color: colors.text },
  caption: { fontSize: 13, color: colors.textMuted },
};
