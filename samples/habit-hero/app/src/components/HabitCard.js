import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { calculateStreak, toDateKey } from '../utils/dates';
import { colors, radius, spacing } from '../theme';

export default function HabitCard({ habit, onToggle, onDelete }) {
  const isDone = habit.completedDates.includes(toDateKey());
  const streak = calculateStreak(habit.completedDates);

  // Destructive actions should always ask first and be easy to cancel.
  function confirmDelete() {
    Alert.alert('Delete habit?', `"${habit.name}" and its history will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDelete(habit.id) },
    ]);
  }

  return (
    <Pressable
      onPress={() => onToggle(habit.id)}
      onLongPress={confirmDelete}
      style={({ pressed }) => [styles.card, isDone && styles.cardDone, pressed && styles.pressed]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isDone }}
      accessibilityLabel={`${habit.name}, ${isDone ? 'done' : 'not done'} today`}
    >
      <View style={[styles.emojiBadge, { backgroundColor: habit.color + '1F' }]}>
        <Text style={styles.emoji}>{habit.emoji}</Text>
      </View>

      <View style={styles.info}>
        <Text style={[styles.name, isDone && styles.nameDone]} numberOfLines={1}>
          {habit.name}
        </Text>
        <Text style={styles.streak}>{streak > 0 ? `🔥 ${streak}-day streak` : 'Start your streak today'}</Text>
      </View>

      <Ionicons
        name={isDone ? 'checkmark-circle' : 'ellipse-outline'}
        size={32}
        color={isDone ? habit.color : colors.border}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardDone: {
    backgroundColor: '#FBFAFF',
    borderColor: 'transparent',
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  emojiBadge: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  emoji: {
    fontSize: 24,
  },
  info: {
    flex: 1,
    marginRight: spacing.sm,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  nameDone: {
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  streak: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 4,
  },
});
