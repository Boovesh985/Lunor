import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Avatar from '../components/Avatar';
import { useGroup } from '../context/GroupContext';
import { formatMoney, parseAmount, splitEvenly } from '../utils/money';
import { categories, colors, radius, spacing, typography } from '../theme';

export default function AddExpenseScreen({ onCancel, onSave }) {
  const { members, currentUserId } = useGroup();

  // Controlled form: every input shows what's in state, and typing updates state.
  const [amountText, setAmountText] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('groceries');
  const [paidBy, setPaidBy] = useState(currentUserId);
  const [splitBetween, setSplitBetween] = useState(members.map((member) => member.id));
  const [submitted, setSubmitted] = useState(false);

  // Validation is derived from state, so errors update as the user types.
  const amount = parseAmount(amountText);
  const errors = {
    amount: amount === null ? 'Enter an amount, like 250 or 99.50' : '',
    title: title.trim().length < 2 ? 'Add a short description' : '',
    split: splitBetween.length === 0 ? 'Pick at least one person to split with' : '',
  };
  const isValid = !errors.amount && !errors.title && !errors.split;

  const shares = amount ? splitEvenly(amount, splitBetween.length) : [];
  const allSelected = splitBetween.length === members.length;

  function toggleMember(id) {
    setSplitBetween((current) =>
      // Rebuild from the member list so the order (and who gets the odd paisa) stays stable.
      members.map((member) => member.id).filter((memberId) => (memberId === id ? !current.includes(memberId) : current.includes(memberId))),
    );
  }

  function handleSave() {
    setSubmitted(true);
    if (!isValid) return;
    onSave({ title, amount, category, paidBy, splitBetween });
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <Pressable onPress={onCancel} hitSlop={12} accessibilityRole="button">
          <Text style={styles.cancel}>Cancel</Text>
        </Pressable>
        <Text style={styles.headerTitle}>New expense</Text>
        <Pressable onPress={handleSave} hitSlop={12} accessibilityRole="button">
          <Text style={[styles.save, !isValid && styles.saveDisabled]}>Save</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.amountRow}>
          <Text style={styles.currency}>₹</Text>
          <TextInput
            value={amountText}
            onChangeText={setAmountText}
            placeholder="0"
            placeholderTextColor={colors.border}
            keyboardType="decimal-pad"
            style={styles.amountInput}
            accessibilityLabel="Amount in rupees"
          />
        </View>
        {submitted && !!errors.amount && <Text style={styles.error}>{errors.amount}</Text>}

        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="What was it for? e.g. Groceries"
          placeholderTextColor={colors.textMuted}
          maxLength={40}
          style={[styles.input, submitted && !!errors.title && styles.inputError]}
          accessibilityLabel="Description"
        />
        {submitted && !!errors.title && <Text style={styles.error}>{errors.title}</Text>}

        <Text style={styles.label}>Category</Text>
        <View style={styles.wrap}>
          {categories.map((item) => {
            const isActive = item.id === category;
            return (
              <Pressable
                key={item.id}
                onPress={() => setCategory(item.id)}
                style={[styles.chip, isActive && { backgroundColor: item.color + '1F', borderColor: item.color }]}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
              >
                <Ionicons name={item.icon} size={16} color={item.color} />
                <Text style={styles.chipText}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>Paid by</Text>
        <View style={styles.wrap}>
          {members.map((member) => {
            const isActive = member.id === paidBy;
            return (
              <Pressable
                key={member.id}
                onPress={() => setPaidBy(member.id)}
                style={[styles.chip, isActive && styles.chipActive]}
                accessibilityRole="radio"
                accessibilityState={{ checked: isActive }}
              >
                <Avatar member={member} size={22} />
                <Text style={styles.chipText}>{member.name}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.labelRow}>
          <Text style={styles.label}>Split equally between</Text>
          <Pressable onPress={() => setSplitBetween(allSelected ? [] : members.map((member) => member.id))} hitSlop={8}>
            <Text style={styles.link}>{allSelected ? 'Clear' : 'Everyone'}</Text>
          </Pressable>
        </View>
        <View style={styles.wrap}>
          {members.map((member) => {
            const isActive = splitBetween.includes(member.id);
            return (
              <Pressable
                key={member.id}
                onPress={() => toggleMember(member.id)}
                style={[styles.chip, isActive && styles.chipActive]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isActive }}
              >
                <Ionicons name={isActive ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={isActive ? colors.primary : colors.textMuted} />
                <Text style={styles.chipText}>{member.name}</Text>
              </Pressable>
            );
          })}
        </View>
        {submitted && !!errors.split && <Text style={styles.error}>{errors.split}</Text>}

        {shares.length > 0 && (
          <View style={styles.preview}>
            <Ionicons name="calculator-outline" size={18} color={colors.primary} />
            <Text style={styles.previewText}>
              {formatMoney(amount)} ÷ {shares.length} = <Text style={styles.previewStrong}>{formatMoney(shares[shares.length - 1])}</Text> each
              {shares[0] !== shares[shares.length - 1] ? ' (some pay 1 paisa more so it adds up exactly)' : ''}
            </Text>
          </View>
        )}

        <Pressable
          onPress={handleSave}
          style={({ pressed }) => [styles.saveButton, !isValid && styles.saveButtonDisabled, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Text style={styles.saveButtonText}>Add expense</Text>
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
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
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
    color: colors.primary,
  },
  saveDisabled: {
    opacity: 0.4,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
  },
  currency: {
    fontSize: 40,
    fontWeight: '700',
    color: colors.textMuted,
    marginRight: 4,
  },
  amountInput: {
    fontSize: 48,
    fontWeight: '800',
    color: colors.text,
    minWidth: 80,
    maxWidth: 240,
    textAlign: 'center',
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text,
  },
  inputError: {
    borderColor: colors.negative,
  },
  error: {
    color: colors.negative,
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
  },
  label: {
    ...typography.caption,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  link: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 13,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
  },
  previewText: {
    ...typography.caption,
    color: colors.text,
    flex: 1,
  },
  previewStrong: {
    fontWeight: '800',
  },
  saveButton: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.8,
  },
});
