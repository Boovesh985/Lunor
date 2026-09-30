import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { sampleHabits } from '../data/sampleHabits';
import { toDateKey } from '../utils/dates';

const STORAGE_KEY = '@habithero/habits';

// A custom hook owns the habit list: it loads it from the device, saves every
// change, and gives screens simple actions instead of raw setState calls.
export function useHabits() {
  const [habits, setHabits] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // 1) Load saved habits once, when the app starts.
  useEffect(() => {
    async function load() {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        setHabits(saved ? JSON.parse(saved) : sampleHabits);
      } catch (error) {
        console.warn('Could not load habits, falling back to sample data.', error);
        setHabits(sampleHabits);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  // 2) Save whenever the list changes — but only after the first load,
  //    otherwise we would overwrite saved data with the empty initial list.
  useEffect(() => {
    if (isLoading) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(habits)).catch((error) =>
      console.warn('Could not save habits.', error),
    );
  }, [habits, isLoading]);

  const addHabit = useCallback(({ name, emoji, color }) => {
    const habit = {
      id: String(Date.now()),
      name: name.trim(),
      emoji,
      color,
      createdAt: toDateKey(),
      completedDates: [],
    };
    // Never mutate state: create a new array with the new habit first.
    setHabits((current) => [habit, ...current]);
  }, []);

  const toggleHabit = useCallback((id, dateKey = toDateKey()) => {
    setHabits((current) =>
      current.map((habit) => {
        if (habit.id !== id) return habit;
        const isDone = habit.completedDates.includes(dateKey);
        return {
          ...habit,
          completedDates: isDone
            ? habit.completedDates.filter((date) => date !== dateKey)
            : [...habit.completedDates, dateKey],
        };
      }),
    );
  }, []);

  const deleteHabit = useCallback((id) => {
    setHabits((current) => current.filter((habit) => habit.id !== id));
  }, []);

  return { habits, isLoading, addHabit, toggleHabit, deleteHabit };
}
