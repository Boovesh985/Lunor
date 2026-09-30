import { useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useGroup } from '../context/GroupContext';
import { shareOf } from '../utils/balances';
import { formatMoney } from '../utils/money';
import { categories, colors, getCategory, radius, spacing, typography } from '../theme';

const FILTERS = [{ id: 'all', label: 'All', icon: 'apps-outline', color: colors.primary }, ...categories];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function ActivityScreen() {
  const { members, expenses, settlements, currentUserId, deleteExpense, deleteSettlement } = useGroup();
  const [filter, setFilter] = useState('all');

  // One timeline with both expenses and payments, newest first. useMemo
  // skips this work unless the data or the filter actually changed.
  const items = useMemo(() => {
    const expenseItems = expenses
      .filter((expense) => filter === 'all' || expense.category === filter)
      .map((expense) => ({ ...expense, kind: 'expense' }));
    const paymentItems = filter === 'all' ? settlements.map((payment) => ({ ...payment, kind: 'payment' })) : [];
    return [...expenseItems, ...paymentItems].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [expenses, settlements, filter]);

  const nameOf = (id) => members.find((member) => member.id === id)?.name ?? 'Former roommate';

  function confirmDelete(item) {
    const isExpense = item.kind === 'expense';
    Alert.alert(
      isExpense ? 'Delete expense?' : 'Delete payment?',
      isExpense
        ? `"${item.title}" will be removed and everyone's balance recalculated.`
        : `${nameOf(item.from)}'s payment to ${nameOf(item.to)} will be removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => (isExpense ? deleteExpense(item.id) : deleteSettlement(item.id)) },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            <Text style={styles.title}>Activity</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
              {FILTERS.map((option) => {
                const isActive = filter === option.id;
                return (
                  <Pressable
                    key={option.id}
                    onPress={() => setFilter(option.id)}
                    style={[styles.chip, isActive && { backgroundColor: option.color, borderColor: option.color }]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isActive }}
                  >
                    <Ionicons name={option.icon} size={14} color={isActive ? '#FFFFFF' : option.color} />
                    <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{option.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            {items.length > 0 && <Text style={styles.hint}>Long-press an item to delete it</Text>}
          </View>
        }
        renderItem={({ item }) =>
          item.kind === 'expense' ? (
            <ExpenseItem expense={item} currentUserId={currentUserId} nameOf={nameOf} onLongPress={() => confirmDelete(item)} />
          ) : (
            <PaymentItem payment={item} nameOf={nameOf} onLongPress={() => confirmDelete(item)} />
          )
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🧾</Text>
            <Text style={styles.emptyTitle}>Nothing here yet</Text>
            <Text style={styles.emptyText}>
              {filter === 'all' ? 'Add your first shared expense and SplitMate does the maths.' : 'No expenses in this category.'}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

function ExpenseItem({ expense, currentUserId, nameOf, onLongPress }) {
  const category = getCategory(expense.category);
  const myShare = shareOf(expense, currentUserId);
  const iPaid = expense.paidBy === currentUserId;
  // How this expense changed *your* balance: lent = others owe you, borrowed = you owe.
  const effect = (iPaid ? expense.amount : 0) - myShare;
  const label = effect > 0 ? 'you lent' : effect < 0 ? 'you borrowed' : iPaid || myShare ? 'no change' : 'not involved';

  return (
    <Pressable onLongPress={onLongPress} style={({ pressed }) => [styles.item, pressed && styles.pressed]} accessibilityHint="Long-press to delete">
      <View style={[styles.icon, { backgroundColor: category.color + '1F' }]}>
        <Ionicons name={category.icon} size={20} color={category.color} />
      </View>
      <View style={styles.itemBody}>
        <Text style={styles.itemTitle} numberOfLines={1}>
          {expense.title}
        </Text>
        <Text style={styles.itemMeta} numberOfLines={1}>
          {nameOf(expense.paidBy)} paid {formatMoney(expense.amount)} · {formatDay(expense.createdAt)}
        </Text>
      </View>
      <View style={styles.itemRight}>
        <Text style={styles.effectLabel}>{label}</Text>
        {effect !== 0 && <Text style={[styles.effect, effect > 0 ? styles.positive : styles.negative]}>{formatMoney(Math.abs(effect))}</Text>}
      </View>
    </Pressable>
  );
}

function PaymentItem({ payment, nameOf, onLongPress }) {
  return (
    <Pressable onLongPress={onLongPress} style={({ pressed }) => [styles.item, pressed && styles.pressed]} accessibilityHint="Long-press to delete">
      <View style={[styles.icon, { backgroundColor: colors.positiveSoft }]}>
        <Ionicons name="swap-horizontal" size={20} color={colors.positive} />
      </View>
      <View style={styles.itemBody}>
        <Text style={styles.itemTitle} numberOfLines={1}>
          {nameOf(payment.from)} paid {nameOf(payment.to)}
        </Text>
        <Text style={styles.itemMeta}>Settle-up · {formatDay(payment.createdAt)}</Text>
      </View>
      <Text style={[styles.effect, styles.positive]}>{formatMoney(payment.amount)}</Text>
    </Pressable>
  );
}

// "Today", "Yesterday", "3 days ago" or "12 Sep".
function formatDay(iso) {
  const date = new Date(iso);
  const today = new Date().setHours(0, 0, 0, 0);
  const day = new Date(iso).setHours(0, 0, 0, 0);
  const daysAgo = Math.round((today - day) / (24 * 60 * 60 * 1000));
  if (daysAgo === 0) return 'Today';
  if (daysAgo === 1) return 'Yesterday';
  if (daysAgo < 7) return `${daysAgo} days ago`;
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  list: {
    padding: spacing.lg,
    paddingBottom: 110,
  },
  title: {
    ...typography.title,
  },
  filters: {
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  hint: {
    ...typography.caption,
    marginBottom: spacing.sm,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: spacing.sm,
  },
  pressed: {
    opacity: 0.7,
  },
  icon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemBody: {
    flex: 1,
  },
  itemTitle: {
    ...typography.body,
    fontWeight: '600',
  },
  itemMeta: {
    ...typography.caption,
    marginTop: 2,
  },
  itemRight: {
    alignItems: 'flex-end',
  },
  effectLabel: {
    ...typography.caption,
    fontSize: 12,
  },
  effect: {
    fontSize: 15,
    fontWeight: '700',
  },
  positive: {
    color: colors.positive,
  },
  negative: {
    color: colors.negative,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyEmoji: {
    fontSize: 44,
  },
  emptyTitle: {
    ...typography.heading,
    marginTop: 12,
  },
  emptyText: {
    ...typography.caption,
    textAlign: 'center',
    marginTop: 6,
    maxWidth: 250,
  },
});
