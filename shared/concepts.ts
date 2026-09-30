/**
 * Curriculum layer.
 *
 * LUNOR_ROADMAP mirrors the 30-level App Development track on lunor.online
 * (Domain → App Development → LEARN). The concept taxonomy below maps every
 * React Native concept the AI can teach onto one of those levels, with a
 * curated official-docs link. The AI must pick concept ids from this list,
 * so learning paths are grounded in a real curriculum and never contain
 * hallucinated links.
 */

export interface RoadmapLevel {
  level: number;
  title: string;
  tier: 'Beginner' | 'Easy' | 'Intermediate' | 'Advanced' | 'Expert';
  milestone?: string;
}

export const LUNOR_ROADMAP: RoadmapLevel[] = [
  { level: 1, title: 'Mobile Basics', tier: 'Beginner' },
  { level: 2, title: 'React Native Setup', tier: 'Beginner' },
  { level: 3, title: 'Core Components', tier: 'Beginner' },
  { level: 4, title: 'Styling & Layout', tier: 'Beginner' },
  { level: 5, title: 'Lists & ScrollViews', tier: 'Beginner' },
  { level: 6, title: 'Navigation', tier: 'Beginner', milestone: 'Project 1 — Personal Portfolio' },
  { level: 7, title: 'Forms & Input', tier: 'Easy' },
  { level: 8, title: 'State & Hooks', tier: 'Easy' },
  { level: 9, title: 'Async Storage', tier: 'Easy' },
  { level: 10, title: 'Networking & APIs', tier: 'Easy' },
  { level: 11, title: 'Native Modules', tier: 'Easy' },
  { level: 12, title: 'Animations', tier: 'Easy', milestone: 'Project 2 — Interactive App' },
  { level: 13, title: 'Gestures', tier: 'Intermediate' },
  { level: 14, title: 'Camera & Media', tier: 'Intermediate' },
  { level: 15, title: 'Push Notifications', tier: 'Intermediate' },
  { level: 16, title: 'Maps & Location', tier: 'Intermediate' },
  { level: 17, title: 'Auth Flows', tier: 'Intermediate' },
  { level: 18, title: 'Offline First', tier: 'Intermediate' },
  { level: 19, title: 'Deep Linking', tier: 'Advanced' },
  { level: 20, title: 'Theming', tier: 'Advanced', milestone: 'Project 3 — Dashboard / Data App' },
  { level: 21, title: 'Performance Profiling', tier: 'Advanced' },
  { level: 22, title: 'Testing', tier: 'Advanced' },
  { level: 23, title: 'Expo Build Pipeline', tier: 'Advanced' },
  { level: 24, title: 'App Store Assets', tier: 'Advanced' },
  { level: 25, title: 'Analytics', tier: 'Expert' },
  { level: 26, title: 'Crash Reporting', tier: 'Expert', milestone: 'Project 4 — Full Stack Application' },
  { level: 27, title: 'In-App Purchases', tier: 'Expert' },
  { level: 28, title: 'Accessibility', tier: 'Expert' },
  { level: 29, title: 'Release Management', tier: 'Expert' },
  { level: 30, title: 'Production App Project', tier: 'Expert', milestone: 'Final Capstone Project' },
];

export const LUNOR_TRACK_URL = 'https://lunor.online/domain/app-development';

export type ConceptCategory = 'Foundations' | 'UI & Layout' | 'State' | 'Data' | 'Navigation' | 'Quality' | 'Platform' | 'Shipping';

export interface Concept {
  id: string;
  name: string;
  category: ConceptCategory;
  lunorLevel: number;
  docsUrl: string;
  summary: string;
}

export const CONCEPTS: Concept[] = [
  // Foundations
  { id: 'mobile-app-anatomy', name: 'Anatomy of a mobile app', category: 'Foundations', lunorLevel: 1, docsUrl: 'https://reactnative.dev/docs/intro-react-native-components', summary: 'Screens, native views and how React Native maps components to real iOS/Android UI.' },
  { id: 'expo-project', name: 'Expo project structure', category: 'Foundations', lunorLevel: 2, docsUrl: 'https://docs.expo.dev/get-started/create-a-project/', summary: 'Entry file, App component, package.json and running with Expo Go.' },
  { id: 'jsx', name: 'JSX', category: 'Foundations', lunorLevel: 3, docsUrl: 'https://react.dev/learn/writing-markup-with-jsx', summary: 'Describing UI with an HTML-like syntax inside JavaScript.' },
  { id: 'components', name: 'Function components', category: 'Foundations', lunorLevel: 3, docsUrl: 'https://reactnative.dev/docs/intro-react', summary: 'Building UIs from small reusable functions that return JSX.' },
  { id: 'core-components', name: 'Core components', category: 'Foundations', lunorLevel: 3, docsUrl: 'https://reactnative.dev/docs/components-and-apis', summary: 'View, Text, Image, Pressable and friends — the building blocks of every screen.' },
  { id: 'props', name: 'Props', category: 'Foundations', lunorLevel: 3, docsUrl: 'https://reactnative.dev/docs/props', summary: 'Passing data and callbacks from a parent component to a child.' },
  { id: 'conditional-rendering', name: 'Conditional rendering', category: 'Foundations', lunorLevel: 3, docsUrl: 'https://react.dev/learn/conditional-rendering', summary: 'Showing different UI (like empty states) based on data.' },
  { id: 'es-modules', name: 'Modules & imports', category: 'Foundations', lunorLevel: 2, docsUrl: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules', summary: 'Splitting code into files with import/export.' },

  // UI & layout
  { id: 'stylesheet', name: 'StyleSheet', category: 'UI & Layout', lunorLevel: 4, docsUrl: 'https://reactnative.dev/docs/style', summary: 'Styling components with JavaScript objects created by StyleSheet.create.' },
  { id: 'flexbox', name: 'Flexbox layout', category: 'UI & Layout', lunorLevel: 4, docsUrl: 'https://reactnative.dev/docs/flexbox', summary: 'Arranging elements with flexDirection, justifyContent and alignItems.' },
  { id: 'vector-icons', name: 'Vector icons', category: 'UI & Layout', lunorLevel: 4, docsUrl: 'https://docs.expo.dev/guides/icons/', summary: 'Crisp, scalable icons from @expo/vector-icons.' },
  { id: 'pressable', name: 'Touch handling with Pressable', category: 'UI & Layout', lunorLevel: 3, docsUrl: 'https://reactnative.dev/docs/pressable', summary: 'Responding to taps with visual feedback.' },
  { id: 'flatlist', name: 'FlatList', category: 'UI & Layout', lunorLevel: 5, docsUrl: 'https://reactnative.dev/docs/flatlist', summary: 'Rendering long lists efficiently with keys and item renderers.' },
  { id: 'scrollview', name: 'ScrollView', category: 'UI & Layout', lunorLevel: 5, docsUrl: 'https://reactnative.dev/docs/scrollview', summary: 'Scrolling containers for content that does not fit the screen.' },
  { id: 'modal-alert', name: 'Modals & alerts', category: 'UI & Layout', lunorLevel: 7, docsUrl: 'https://reactnative.dev/docs/alert', summary: 'Confirmations and overlays with Alert and Modal.' },
  { id: 'design-tokens', name: 'Design tokens & theming', category: 'UI & Layout', lunorLevel: 20, docsUrl: 'https://reactnative.dev/docs/colors', summary: 'Centralising colours, spacing and typography so the whole app stays consistent.' },
  { id: 'animations', name: 'Animated API', category: 'UI & Layout', lunorLevel: 12, docsUrl: 'https://reactnative.dev/docs/animations', summary: 'Smooth motion with Animated values, timing and springs.' },
  { id: 'accessibility', name: 'Accessibility', category: 'Quality', lunorLevel: 28, docsUrl: 'https://reactnative.dev/docs/accessibility', summary: 'Labels and roles so screen readers can use your app.' },

  // State
  { id: 'use-state', name: 'useState', category: 'State', lunorLevel: 8, docsUrl: 'https://react.dev/reference/react/useState', summary: 'Local component state that triggers a re-render when it changes.' },
  { id: 'use-effect', name: 'useEffect', category: 'State', lunorLevel: 8, docsUrl: 'https://react.dev/reference/react/useEffect', summary: 'Running side effects such as loading saved data after render.' },
  { id: 'use-memo', name: 'useMemo & derived data', category: 'State', lunorLevel: 21, docsUrl: 'https://react.dev/reference/react/useMemo', summary: 'Computing values from state without storing duplicates, and caching expensive work.' },
  { id: 'use-callback', name: 'useCallback', category: 'State', lunorLevel: 21, docsUrl: 'https://react.dev/reference/react/useCallback', summary: 'Keeping function identities stable between renders.' },
  { id: 'custom-hooks', name: 'Custom hooks', category: 'State', lunorLevel: 8, docsUrl: 'https://react.dev/learn/reusing-logic-with-custom-hooks', summary: 'Extracting reusable stateful logic into your own use… functions.' },
  { id: 'use-reducer', name: 'useReducer', category: 'State', lunorLevel: 8, docsUrl: 'https://react.dev/reference/react/useReducer', summary: 'Managing complex state transitions with actions and a reducer.' },
  { id: 'context', name: 'Context API', category: 'State', lunorLevel: 8, docsUrl: 'https://react.dev/learn/passing-data-deeply-with-context', summary: 'Sharing state across many screens without prop drilling.' },
  { id: 'lifting-state', name: 'Lifting state up', category: 'State', lunorLevel: 8, docsUrl: 'https://react.dev/learn/sharing-state-between-components', summary: 'Keeping shared state in the closest common parent.' },
  { id: 'immutability', name: 'Immutable updates', category: 'State', lunorLevel: 8, docsUrl: 'https://react.dev/learn/updating-arrays-in-state', summary: 'Creating new arrays/objects instead of mutating state.' },

  // Forms & data
  { id: 'text-input', name: 'Controlled TextInput', category: 'Data', lunorLevel: 7, docsUrl: 'https://reactnative.dev/docs/handling-text-input', summary: 'Keeping input values in state and reacting to typing.' },
  { id: 'form-validation', name: 'Form validation', category: 'Data', lunorLevel: 7, docsUrl: 'https://reactnative.dev/docs/textinput', summary: 'Checking user input and giving helpful feedback before saving.' },
  { id: 'async-storage', name: 'AsyncStorage persistence', category: 'Data', lunorLevel: 9, docsUrl: 'https://docs.expo.dev/versions/latest/sdk/async-storage/', summary: 'Saving data on the device so it survives app restarts.' },
  { id: 'json-serialization', name: 'JSON serialisation', category: 'Data', lunorLevel: 9, docsUrl: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON', summary: 'Turning objects into strings (and back) for storage.' },
  { id: 'async-await', name: 'Promises & async/await', category: 'Data', lunorLevel: 9, docsUrl: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function', summary: 'Writing asynchronous code that reads top to bottom.' },
  { id: 'array-methods', name: 'map / filter / reduce', category: 'Data', lunorLevel: 5, docsUrl: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/reduce', summary: 'Transforming and summarising lists of data.' },
  { id: 'data-modeling', name: 'Data modelling', category: 'Data', lunorLevel: 9, docsUrl: 'https://react.dev/learn/choosing-the-state-structure', summary: 'Choosing the shape of your data and ids so features stay simple.' },
  { id: 'pure-functions', name: 'Pure functions & business logic', category: 'Data', lunorLevel: 22, docsUrl: 'https://react.dev/learn/keeping-components-pure', summary: 'Keeping calculations in small testable functions outside components.' },
  { id: 'dates', name: 'Working with dates', category: 'Data', lunorLevel: 9, docsUrl: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date', summary: 'Creating, comparing and formatting dates.' },
  { id: 'networking', name: 'Fetching data from APIs', category: 'Data', lunorLevel: 10, docsUrl: 'https://reactnative.dev/docs/network', summary: 'Calling REST APIs with fetch and handling loading/error states.' },
  { id: 'offline-first', name: 'Offline-first design', category: 'Data', lunorLevel: 18, docsUrl: 'https://docs.expo.dev/guides/local-first/', summary: 'Designing apps that work without a network and sync later.' },

  // Navigation
  { id: 'navigation-state', name: 'Screen navigation', category: 'Navigation', lunorLevel: 6, docsUrl: 'https://reactnative.dev/docs/navigation', summary: 'Moving between screens with tabs, stacks and modals.' },
  { id: 'tab-bar', name: 'Bottom tab bar', category: 'Navigation', lunorLevel: 6, docsUrl: 'https://reactnavigation.org/docs/bottom-tab-navigator', summary: 'The classic mobile pattern for switching between top-level sections.' },
  { id: 'deep-linking', name: 'Deep linking', category: 'Navigation', lunorLevel: 19, docsUrl: 'https://docs.expo.dev/linking/overview/', summary: 'Opening a specific screen from a URL or notification.' },

  // Platform features (mostly "learn next")
  { id: 'safe-area', name: 'Safe areas & status bar', category: 'Platform', lunorLevel: 4, docsUrl: 'https://reactnative.dev/docs/safeareaview', summary: 'Keeping content clear of notches and system bars.' },
  { id: 'platform-specific', name: 'Platform-specific code', category: 'Platform', lunorLevel: 11, docsUrl: 'https://reactnative.dev/docs/platform-specific-code', summary: 'Adapting behaviour for iOS vs Android.' },
  { id: 'gestures', name: 'Gestures', category: 'Platform', lunorLevel: 13, docsUrl: 'https://docs.swmansion.com/react-native-gesture-handler/', summary: 'Swipes, drags and long-presses beyond simple taps.' },
  { id: 'camera-media', name: 'Camera & media', category: 'Platform', lunorLevel: 14, docsUrl: 'https://docs.expo.dev/versions/latest/sdk/camera/', summary: 'Capturing photos and picking images.' },
  { id: 'notifications', name: 'Push notifications', category: 'Platform', lunorLevel: 15, docsUrl: 'https://docs.expo.dev/push-notifications/overview/', summary: 'Reminding users at the right moment.' },
  { id: 'location', name: 'Maps & location', category: 'Platform', lunorLevel: 16, docsUrl: 'https://docs.expo.dev/versions/latest/sdk/location/', summary: 'Getting the device location and showing maps.' },
  { id: 'auth', name: 'Authentication flows', category: 'Platform', lunorLevel: 17, docsUrl: 'https://docs.expo.dev/guides/authentication/', summary: 'Sign-up, sign-in and protecting user data.' },

  // Quality & shipping
  { id: 'list-performance', name: 'List performance', category: 'Quality', lunorLevel: 21, docsUrl: 'https://reactnative.dev/docs/optimizing-flatlist-configuration', summary: 'Keys, memoised rows and tuning FlatList for smooth scrolling.' },
  { id: 'error-handling', name: 'Error handling', category: 'Quality', lunorLevel: 26, docsUrl: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/try...catch', summary: 'Catching failures (like corrupt storage) and recovering gracefully.' },
  { id: 'testing', name: 'Testing', category: 'Quality', lunorLevel: 22, docsUrl: 'https://reactnative.dev/docs/testing-overview', summary: 'Unit and component tests that keep features working.' },
  { id: 'eas-build', name: 'Building & publishing with EAS', category: 'Shipping', lunorLevel: 23, docsUrl: 'https://docs.expo.dev/build/introduction/', summary: 'Turning your project into installable iOS and Android builds.' },
  { id: 'analytics', name: 'Analytics', category: 'Shipping', lunorLevel: 25, docsUrl: 'https://docs.expo.dev/guides/using-analytics/', summary: 'Measuring how people actually use your app.' },
];

export const CONCEPTS_BY_ID: Record<string, Concept> = Object.fromEntries(CONCEPTS.map((c) => [c.id, c]));

export function getConcept(id: string): Concept | undefined {
  return CONCEPTS_BY_ID[id];
}

/** Compact taxonomy listing embedded in prompts (id — name — level). */
export function conceptCatalogForPrompt(): string {
  return CONCEPTS.map((c) => `${c.id} — ${c.name} (Lunor level ${c.lunorLevel}: ${LUNOR_ROADMAP[c.lunorLevel - 1]?.title})`).join('\n');
}

/** Roadmap levels touched by a set of concept ids, sorted. */
export function levelsForConcepts(conceptIds: Iterable<string>): number[] {
  const levels = new Set<number>();
  for (const id of conceptIds) {
    const concept = CONCEPTS_BY_ID[id];
    if (concept) levels.add(concept.lunorLevel);
  }
  return [...levels].sort((a, b) => a - b);
}
