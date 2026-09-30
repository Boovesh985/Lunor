import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { calculateStreak, lastNDays, shortWeekday, toDateKey } from '../utils/dates';
import { colors, radius, spacing, typography } from '../theme';

const WEEK = 7;

export default function StatsScreen({ habits }) {
  const days = lastNDays(WEEK);
  const dayKeys = days.map(toDateKey);

  // Summary numbers are derived with array methods — no extra state needed.
  const possible = habits.length * WEEK;
  const completed = habits.reduce(
    (sum, habit) => sum + habit.completedDates.filter((date) => dayKeys.includes(date)).length,
    0,
  );
  const completionRate = possible === 0 ? 0 : Math.round((completed / possible) * 100);
  const bestStreak = habits.reduce((best, habit) => Math.max(best, calculateStreak(habit.completedDates)), 0);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>Last 7 days</Text>
        <Text style={styles.title}>Your progress</Text>

        <View style={styles.statsRow}>
          <StatCard icon="🎯" label="Completion" value={`${completionRate}%`} />
          <StatCard icon="✅" label="Check-ins" value={completed} />
          <StatCard icon="🔥" label="Best streak" value={bestStreak} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>This week</Text>
          <View style={styles.row}>
            <View style={styles.nameColumn} />
            {days.map((day) => (
              <Text key={toDateKey(day)} style={styles.dayLabel}>
                {shortWeekday(day)}
              </Text>
            ))}
          </View>

          {habits.map((habit) => (
            <View key={habit.id} style={styles.row}>
              <Text style={styles.nameColumn} numberOfLines={1}>
                {habit.emoji} {habit.name}
              </Text>
              {dayKeys.map((key) => {
                const isDone = habit.completedDates.includes(key);
                return (
                  <View key={key} style={styles.dayCell}>
                    <View style={[styles.dot, isDone && { backgroundColor: habit.color, borderColor: habit.color }]} />
                  </View>
                );
              })}
            </View>
          ))}

          {habits.length === 0 && <Text style={styles.empty}>Add a habit to see your weekly grid.</Text>}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// A small component that only this screen uses can live in the same file.
function StatCard({ icon, label, value }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  subtitle: {
    ...typography.caption,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '600',
  },
  title: {
    ...typography.title,
    marginTop: 4,
    marginBottom: spacing.lg,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: spacing.lg,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  statIcon: {
    fontSize: 22,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    marginTop: 6,
  },
  statLabel: {
    ...typography.caption,
    marginTop: 2,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  cardTitle: {
    ...typography.heading,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  nameColumn: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
    marginRight: spacing.sm,
  },
  dayLabel: {
    width: 26,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
  },
  dayCell: {
    width: 26,
    alignItems: 'center',
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.border,
  },
  empty: {
    ...typography.caption,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
});
