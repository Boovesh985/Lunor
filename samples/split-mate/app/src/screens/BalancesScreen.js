import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Avatar from '../components/Avatar';
import { useBalances, useGroup } from '../context/GroupContext';
import { formatMoney } from '../utils/money';
import { colors, radius, spacing, typography } from '../theme';

export default function BalancesScreen() {
  const { name, members, expenses, currentUserId, settleUp } = useGroup();
  const { balances, payments } = useBalances();

  // Derived values, recalculated on every render from the group state.
  const byId = Object.fromEntries(members.map((member) => [member.id, member]));
  const myBalance = balances[currentUserId] ?? 0;
  const totalSpent = expenses.reduce((sum, expense) => sum + expense.amount, 0);

  function confirmPayment(payment) {
    const from = byId[payment.from].name;
    const to = byId[payment.to].name;
    Alert.alert('Record this payment?', `${from} paid ${to} ${formatMoney(payment.amount)}.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Mark as paid',
        onPress: () => {
          settleUp(payment);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.group}>{name}</Text>
        <Text style={styles.title}>Balances</Text>

        <LinearGradient colors={[colors.primary, colors.primaryDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <Text style={styles.heroLabel}>{myBalance > 0 ? 'You get back' : myBalance < 0 ? 'You owe' : 'You are all square'}</Text>
          <Text style={styles.heroAmount}>{formatMoney(Math.abs(myBalance))}</Text>
          <View style={styles.heroFooter}>
            <Ionicons name="receipt-outline" size={14} color="rgba(255,255,255,0.75)" />
            <Text style={styles.heroMeta}>
              {formatMoney(totalSpent)} spent by {members.length} roommates
            </Text>
          </View>
        </LinearGradient>

        <Text style={styles.section}>Settle up</Text>
        {payments.length === 0 ? (
          <View style={[styles.card, styles.settled]}>
            <Text style={styles.settledEmoji}>🎉</Text>
            <Text style={styles.settledText}>Everyone is settled up.</Text>
          </View>
        ) : (
          payments.map((payment) => (
            <View key={`${payment.from}-${payment.to}`} style={[styles.card, styles.payment]}>
              <View style={styles.pair}>
                <Avatar member={byId[payment.from]} size={34} />
                <Ionicons name="arrow-forward" size={14} color={colors.textMuted} />
                <Avatar member={byId[payment.to]} size={34} />
              </View>
              <View style={styles.paymentBody}>
                <Text style={styles.paymentTitle} numberOfLines={1}>
                  {byId[payment.from].name} → {byId[payment.to].name}
                </Text>
                <Text style={styles.paymentAmount}>{formatMoney(payment.amount)}</Text>
              </View>
              <Pressable
                onPress={() => confirmPayment(payment)}
                style={({ pressed }) => [styles.payButton, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={`Mark ${byId[payment.from].name}'s payment to ${byId[payment.to].name} as paid`}
              >
                <Text style={styles.payText}>Mark paid</Text>
              </Pressable>
            </View>
          ))
        )}

        <Text style={styles.section}>Everyone</Text>
        <View style={styles.card}>
          {members.map((member, index) => {
            const balance = balances[member.id] ?? 0;
            return (
              <View key={member.id} style={[styles.row, index > 0 && styles.rowDivider]}>
                <Avatar member={member} />
                <Text style={styles.name} numberOfLines={1}>
                  {member.name}
                </Text>
                <View style={styles.rowRight}>
                  <Text style={styles.rowLabel}>{balance > 0 ? 'to receive' : balance < 0 ? 'to pay' : 'settled'}</Text>
                  {balance !== 0 && (
                    <Text style={[styles.rowAmount, balance > 0 ? styles.positive : styles.negative]}>{formatMoney(Math.abs(balance))}</Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: 110,
  },
  group: {
    ...typography.caption,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '600',
  },
  title: {
    ...typography.title,
    marginTop: 4,
  },
  hero: {
    marginTop: spacing.md,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  heroLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '600',
  },
  heroAmount: {
    color: '#FFFFFF',
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: -1,
    marginTop: 2,
  },
  heroFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.md,
  },
  heroMeta: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
  },
  section: {
    ...typography.heading,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  settled: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  settledEmoji: {
    fontSize: 22,
  },
  settledText: {
    ...typography.body,
    fontWeight: '600',
  },
  payment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 12,
    marginBottom: spacing.sm,
  },
  pair: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  paymentBody: {
    flex: 1,
    marginLeft: 4,
  },
  paymentTitle: {
    ...typography.caption,
    fontWeight: '600',
  },
  paymentAmount: {
    ...typography.heading,
    marginTop: 1,
  },
  payButton: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  payText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 13,
  },
  pressed: {
    opacity: 0.7,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  name: {
    ...typography.body,
    fontWeight: '600',
    flex: 1,
  },
  rowRight: {
    alignItems: 'flex-end',
  },
  rowLabel: {
    ...typography.caption,
    fontSize: 12,
  },
  rowAmount: {
    fontSize: 15,
    fontWeight: '700',
  },
  positive: {
    color: colors.positive,
  },
  negative: {
    color: colors.negative,
  },
});
