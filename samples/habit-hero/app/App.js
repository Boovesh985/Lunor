import { useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useHabits } from './src/hooks/useHabits';
import TodayScreen from './src/screens/TodayScreen';
import StatsScreen from './src/screens/StatsScreen';
import AddHabitScreen from './src/screens/AddHabitScreen';
import TabBar from './src/components/TabBar';
import { colors } from './src/theme';

const TABS = [
  { key: 'today', label: 'Today', icon: 'sunny-outline', activeIcon: 'sunny' },
  { key: 'progress', label: 'Progress', icon: 'stats-chart-outline', activeIcon: 'stats-chart' },
];

export default function App() {
  // All habit data lives in one custom hook, so both screens share the same state.
  const { habits, isLoading, addHabit, toggleHabit, deleteHabit } = useHabits();

  // Navigation is just state: which tab is active, and whether the "add" sheet is open.
  const [activeTab, setActiveTab] = useState('today');
  const [isAdding, setIsAdding] = useState(false);

  function handleSave(habit) {
    addHabit(habit);
    setIsAdding(false);
    setActiveTab('today');
  }

  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        <StatusBar style="dark" />
        {activeTab === 'today' ? (
          <TodayScreen
            habits={habits}
            isLoading={isLoading}
            onToggle={toggleHabit}
            onDelete={deleteHabit}
            onAddPress={() => setIsAdding(true)}
          />
        ) : (
          <StatsScreen habits={habits} />
        )}
        <TabBar tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />

        <Modal
          visible={isAdding}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setIsAdding(false)}
        >
          <AddHabitScreen onCancel={() => setIsAdding(false)} onSave={handleSave} />
        </Modal>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
