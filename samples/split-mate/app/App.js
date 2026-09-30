import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { GroupProvider, useGroup } from './src/context/GroupContext';
import BalancesScreen from './src/screens/BalancesScreen';
import ActivityScreen from './src/screens/ActivityScreen';
import RoommatesScreen from './src/screens/RoommatesScreen';
import AddExpenseScreen from './src/screens/AddExpenseScreen';
import TabBar from './src/components/TabBar';
import { colors, radius, spacing } from './src/theme';

const TABS = [
  { key: 'balances', label: 'Balances', icon: 'wallet-outline', activeIcon: 'wallet' },
  { key: 'activity', label: 'Activity', icon: 'receipt-outline', activeIcon: 'receipt' },
  { key: 'roommates', label: 'Roommates', icon: 'people-outline', activeIcon: 'people' },
];

// App only sets up the providers. Everything that reads the group lives in
// AppShell, because useGroup() only works *inside* <GroupProvider>.
export default function App() {
  return (
    <SafeAreaProvider>
      <GroupProvider>
        <StatusBar style="dark" />
        <AppShell />
      </GroupProvider>
    </SafeAreaProvider>
  );
}

function AppShell() {
  const { isLoading, addExpense } = useGroup();
  // Navigation is plain state: the active tab, and whether the add sheet is open.
  const [activeTab, setActiveTab] = useState('balances');
  const [isAdding, setIsAdding] = useState(false);

  function handleSave(expense) {
    addExpense(expense);
    setIsAdding(false);
    setActiveTab('balances');
  }

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.screen}>
        {activeTab === 'balances' && <BalancesScreen />}
        {activeTab === 'activity' && <ActivityScreen />}
        {activeTab === 'roommates' && <RoommatesScreen />}

        {activeTab !== 'roommates' && (
          <Pressable
            style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
            onPress={() => setIsAdding(true)}
            accessibilityRole="button"
            accessibilityLabel="Add an expense"
          >
            <Ionicons name="add" size={22} color="#FFFFFF" />
            <Text style={styles.fabText}>Add expense</Text>
          </Pressable>
        )}
      </View>
      <TabBar tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />

      <Modal visible={isAdding} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setIsAdding(false)}>
        <AddExpenseScreen onCancel={() => setIsAdding(false)} onSave={handleSave} />
      </Modal>
    </View>
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
  screen: {
    flex: 1,
  },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  fabPressed: {
    transform: [{ scale: 0.96 }],
  },
  fabText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
});
