import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../theme';

// A presentational component: it receives numbers through props and draws
// them. No state, no side effects — easy to reuse and to test.
export default function DayProgress({ done, total }) {
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);

  let message = `${total - done} to go — you've got this!`;
  if (total === 0) message = 'Add your first habit to get started';
  else if (percent === 100) message = 'Perfect day. Every habit done! 🎉';

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.label}>Today's progress</Text>
        <Text style={styles.percent}>{percent}%</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${percent}%` }]} />
      </View>
      <Text style={styles.message}>
        {done} of {total} done · {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: 20,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  label: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 15,
    fontWeight: '600',
  },
  percent: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '800',
  },
  track: {
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.25)',
    marginTop: 12,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: '#FFFFFF',
  },
  message: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    marginTop: 12,
  },
});
