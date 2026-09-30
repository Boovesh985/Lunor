import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, habitColors, habitEmojis, radius, spacing, typography } from '../theme';

const MAX_NAME_LENGTH = 40;

export default function AddHabitScreen({ onSave, onCancel }) {
  // Controlled inputs: the form shows whatever is in state, and every
  // keystroke or tap updates that state.
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState(habitEmojis[0]);
  const [color, setColor] = useState(habitColors[0]);
  const [error, setError] = useState('');

  function handleSave() {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError('Give your habit a name (at least 2 characters).');
      return;
    }
    onSave({ name: trimmed, emoji, color });
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <Pressable onPress={onCancel} hitSlop={12}>
          <Text style={styles.cancel}>Cancel</Text>
        </Pressable>
        <Text style={styles.headerTitle}>New habit</Text>
        <Pressable onPress={handleSave} hitSlop={12}>
          <Text style={[styles.save, { color }]}>Save</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* A live preview of the habit being created */}
        <View style={[styles.preview, { borderColor: color }]}>
          <View style={[styles.previewBadge, { backgroundColor: color + '1F' }]}>
            <Text style={styles.previewEmoji}>{emoji}</Text>
          </View>
          <Text style={styles.previewName} numberOfLines={1}>
            {name.trim() || 'Your new habit'}
          </Text>
        </View>

        <Text style={styles.label}>Name</Text>
        <TextInput
          value={name}
          onChangeText={(text) => {
            setName(text);
            if (error) setError('');
          }}
          placeholder="e.g. Meditate for 10 minutes"
          placeholderTextColor={colors.textMuted}
          maxLength={MAX_NAME_LENGTH}
          style={[styles.input, !!error && styles.inputError]}
          returnKeyType="done"
          onSubmitEditing={handleSave}
        />
        <View style={styles.inputMeta}>
          <Text style={styles.error}>{error}</Text>
          <Text style={styles.counter}>
            {name.length}/{MAX_NAME_LENGTH}
          </Text>
        </View>

        <Text style={styles.label}>Icon</Text>
        <View style={styles.grid}>
          {habitEmojis.map((item) => (
            <Pressable
              key={item}
              onPress={() => setEmoji(item)}
              style={[styles.emojiOption, item === emoji && { borderColor: color, backgroundColor: color + '14' }]}
              accessibilityLabel={`Icon ${item}`}
            >
              <Text style={styles.emojiText}>{item}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Colour</Text>
        <View style={styles.grid}>
          {habitColors.map((item) => (
            <Pressable
              key={item}
              onPress={() => setColor(item)}
              style={[styles.colorOption, { backgroundColor: item }]}
              accessibilityLabel={`Colour ${item}`}
            >
              {item === color && <Ionicons name="checkmark" size={20} color="#FFFFFF" />}
            </Pressable>
          ))}
        </View>

        <Pressable
          style={({ pressed }) => [styles.button, { backgroundColor: color }, pressed && { opacity: 0.85 }]}
          onPress={handleSave}
        >
          <Text style={styles.buttonText}>Add habit</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerTitle: {
    ...typography.heading,
  },
  cancel: {
    fontSize: 16,
    color: colors.textMuted,
  },
  save: {
    fontSize: 16,
    fontWeight: '700',
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 2,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  previewBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  previewEmoji: {
    fontSize: 22,
  },
  previewName: {
    ...typography.body,
    fontWeight: '600',
    flex: 1,
  },
  label: {
    ...typography.caption,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm + 4,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text,
  },
  inputError: {
    borderColor: colors.danger,
  },
  inputMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    marginBottom: spacing.lg,
    minHeight: 18,
  },
  error: {
    fontSize: 13,
    color: colors.danger,
    flex: 1,
  },
  counter: {
    ...typography.caption,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: spacing.lg,
  },
  emojiOption: {
    width: 52,
    height: 52,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiText: {
    fontSize: 24,
  },
  colorOption: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
