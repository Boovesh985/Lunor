import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Avatar from '../components/Avatar';
import { useBalances, useGroup } from '../context/GroupContext';
import { formatMoney } from '../utils/money';
import { colors, radius, spacing, typography } from '../theme';

const MAX_NAME_LENGTH = 20;

export default function RoommatesScreen() {
  const { name: groupName, members, currentUserId, addMember, removeMember } = useGroup();
  const { balances } = useBalances();
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');

  function handleAdd() {
    const trimmed = newName.trim();
    if (trimmed.length < 2) {
      setError('Enter a name with at least 2 letters.');
      return;
    }
    if (members.some((member) => member.name.toLowerCase() === trimmed.toLowerCase())) {
      setError(`${trimmed} is already in ${groupName}.`);
      return;
    }
    addMember(trimmed);
    setNewName('');
    setError('');
  }

  function handleRemove(member) {
    const balance = balances[member.id] ?? 0;
    // Removing someone who still owes (or is owed) money would make it vanish.
    if (balance !== 0) {
      Alert.alert(
        `${member.name} isn't settled up`,
        `${member.name} ${balance > 0 ? 'is still owed' : 'still owes'} ${formatMoney(Math.abs(balance))}. Settle up first so nobody loses money.`,
      );
      return;
    }
    Alert.alert(`Remove ${member.name}?`, 'Their past expenses stay in the activity feed.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeMember(member.id) },
    ]);
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={styles.caption}>
          {groupName} · {members.length} {members.length === 1 ? 'person' : 'people'}
        </Text>
        <Text style={styles.title}>Roommates</Text>

        <View style={styles.addRow}>
          <TextInput
            value={newName}
            onChangeText={(text) => {
              setNewName(text);
              if (error) setError('');
            }}
            placeholder="Add a roommate"
            placeholderTextColor={colors.textMuted}
            maxLength={MAX_NAME_LENGTH}
            style={[styles.input, !!error && styles.inputError]}
            returnKeyType="done"
            onSubmitEditing={handleAdd}
            accessibilityLabel="New roommate name"
          />
          <Pressable
            onPress={handleAdd}
            style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Add roommate"
          >
            <Ionicons name="person-add-outline" size={20} color="#FFFFFF" />
          </Pressable>
        </View>
        {!!error && <Text style={styles.error}>{error}</Text>}

        <View style={styles.card}>
          {members.map((member, index) => {
            const balance = balances[member.id] ?? 0;
            const isMe = member.id === currentUserId;
            return (
              <View key={member.id} style={[styles.row, index > 0 && styles.rowDivider]}>
                <Avatar member={member} size={44} />
                <View style={styles.rowBody}>
                  <Text style={styles.name}>
                    {member.name}
                    {isMe && <Text style={styles.me}>  (that's you)</Text>}
                  </Text>
                  <Text style={[styles.status, balance > 0 && styles.positive, balance < 0 && styles.negative]}>
                    {balance === 0 ? 'Settled up' : `${balance > 0 ? 'To receive' : 'To pay'} ${formatMoney(Math.abs(balance))}`}
                  </Text>
                </View>
                {!isMe && (
                  <Pressable
                    onPress={() => handleRemove(member)}
                    hitSlop={10}
                    style={({ pressed }) => pressed && styles.pressed}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${member.name}`}
                  >
                    <Ionicons name="trash-outline" size={20} color={colors.textMuted} />
                  </Pressable>
                )}
              </View>
            );
          })}
        </View>

        <View style={styles.tip}>
          <Ionicons name="bulb-outline" size={18} color={colors.primary} />
          <Text style={styles.tipText}>
            Balances are calculated from the activity feed every time, so adding or removing a roommate never changes what the others owe.
          </Text>
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
    paddingBottom: spacing.xl,
  },
  caption: {
    ...typography.caption,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '600',
  },
  title: {
    ...typography.title,
    marginTop: 4,
  },
  addRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  input: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
  },
  inputError: {
    borderColor: colors.negative,
  },
  addButton: {
    width: 50,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  error: {
    color: colors.negative,
    fontSize: 13,
    marginTop: 6,
  },
  card: {
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
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
  rowBody: {
    flex: 1,
  },
  name: {
    ...typography.body,
    fontWeight: '600',
  },
  me: {
    ...typography.caption,
    fontWeight: '400',
  },
  status: {
    ...typography.caption,
    marginTop: 2,
  },
  positive: {
    color: colors.positive,
  },
  negative: {
    color: colors.negative,
  },
  tip: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
  },
  tipText: {
    ...typography.caption,
    color: colors.text,
    flex: 1,
    lineHeight: 19,
  },
});
