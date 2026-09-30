import { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { emptyGroup, sampleGroup } from '../data/sampleGroup';
import { computeBalances, suggestSettlements } from '../utils/balances';

const STORAGE_KEY = '@splitmate/group';

// Every change to the group is described by an action object and handled
// here. The reducer is pure: (state, action) → new state, with no side effects.
export function groupReducer(state, action) {
  switch (action.type) {
    case 'loaded':
      return { ...emptyGroup, ...action.group, isLoading: false };
    case 'addExpense':
      return { ...state, expenses: [action.expense, ...state.expenses] };
    case 'deleteExpense':
      return { ...state, expenses: state.expenses.filter((expense) => expense.id !== action.id) };
    case 'settleUp':
      return { ...state, settlements: [action.payment, ...state.settlements] };
    case 'deleteSettlement':
      return { ...state, settlements: state.settlements.filter((payment) => payment.id !== action.id) };
    case 'addMember':
      return { ...state, members: [...state.members, action.member] };
    case 'removeMember':
      return { ...state, members: state.members.filter((member) => member.id !== action.id) };
    default:
      return state;
  }
}

const GroupContext = createContext(null);

// Wrap the app in <GroupProvider> once; any screen can then read the group
// with useGroup() instead of receiving it through layers of props.
export function GroupProvider({ children }) {
  const [state, dispatch] = useReducer(groupReducer, { ...emptyGroup, isLoading: true });

  // 1) Load the saved group once, falling back to sample data.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      let group = sampleGroup;
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved) group = JSON.parse(saved);
      } catch (error) {
        console.warn('Could not load saved data, using the sample group.', error);
      }
      if (!cancelled) dispatch({ type: 'loaded', group });
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // 2) Save after every change, but never before the first load has finished.
  useEffect(() => {
    if (state.isLoading) return;
    const { isLoading, ...group } = state;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(group)).catch((error) =>
      console.warn('Could not save the group.', error),
    );
  }, [state]);

  // Action creators: screens call addExpense(...) instead of building actions.
  // useMemo keeps these functions identical between renders.
  const actions = useMemo(
    () => ({
      addExpense: ({ title, amount, category, paidBy, splitBetween }) =>
        dispatch({
          type: 'addExpense',
          expense: { id: makeId('e'), title: title.trim(), amount, category, paidBy, splitBetween, createdAt: new Date().toISOString() },
        }),
      deleteExpense: (id) => dispatch({ type: 'deleteExpense', id }),
      settleUp: ({ from, to, amount }) =>
        dispatch({ type: 'settleUp', payment: { id: makeId('s'), from, to, amount, createdAt: new Date().toISOString() } }),
      deleteSettlement: (id) => dispatch({ type: 'deleteSettlement', id }),
      addMember: (name) => dispatch({ type: 'addMember', member: { id: makeId('m'), name: name.trim() } }),
      removeMember: (id) => dispatch({ type: 'removeMember', id }),
    }),
    [],
  );

  const value = useMemo(() => ({ ...state, ...actions }), [state, actions]);
  return <GroupContext.Provider value={value}>{children}</GroupContext.Provider>;
}

export function useGroup() {
  const group = useContext(GroupContext);
  if (!group) throw new Error('useGroup() must be used inside <GroupProvider>.');
  return group;
}

// Derived data: balances are calculated from expenses and payments, never
// stored, so they can't drift out of sync with the history.
export function useBalances() {
  const { members, expenses, settlements } = useGroup();
  return useMemo(() => {
    const balances = computeBalances(members, expenses, settlements);
    return { balances, payments: suggestSettlements(balances) };
  }, [members, expenses, settlements]);
}

function makeId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}
