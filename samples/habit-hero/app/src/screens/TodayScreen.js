import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import HabitCard from '../components/HabitCard';
import DayProgress from '../components/DayProgress';
import { formatToday, toDateKey } from '../utils/dates';
import { colors, radius, spacing, typography } from '../theme';

export default function TodayScreen({ habits, isLoading, onToggle, onDelete, onAddPress }) {
  // Derived data: calculated from props on every render instead of being
  // stored in its own state (so it can never get out of sync).
  const today = toDateKey();
  const doneCount = habits.filter((habit) => habit.completedDates.includes(today)).length;

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <FlatList
        data={habits}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <HabitCard habit={item} onToggle={onToggle} onDelete={onDelete} />}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            <Text style={styles.date}>{formatToday()}</Text>
            <Text style={styles.title}>Your habits</Text>
            <DayProgress done={doneCount} total={habits.length} />
            {habits.length > 0 && <Text style={styles.hint}>Tap to check off · long-press to delete</Text>}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🌱</Text>
            <Text style={styles.emptyTitle}>No habits yet</Text>
            <Text style={styles.emptyText}>Small daily wins add up. Tap + to plant your first habit.</Text>
          </View>
        }
      />

      <Pressable
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        onPress={onAddPress}
        accessibilityRole="button"
        accessibilityLabel="Add a new habit"
      >
        <Ionicons name="add" size={30} color="#FFFFFF" />
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  list: {
    padding: spacing.lg,
    paddingBottom: 110,
  },
  date: {
    ...typography.caption,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '600',
  },
  title: {
    ...typography.title,
    marginTop: 4,
  },
  hint: {
    ...typography.caption,
    marginBottom: 12,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyEmoji: {
    fontSize: 48,
  },
  emptyTitle: {
    ...typography.heading,
    marginTop: 12,
  },
  emptyText: {
    ...typography.caption,
    textAlign: 'center',
    marginTop: 6,
    maxWidth: 240,
  },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    width: 60,
    height: 60,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  fabPressed: {
    transform: [{ scale: 0.94 }],
  },
});
