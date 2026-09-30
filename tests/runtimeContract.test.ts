import { describe, expect, it } from 'vitest';
import { detectPackages, findImports, findMissingImports, isAllowedModule, packageName, runtimeContractForPrompt } from '../shared/runtimeContract.ts';

describe('findImports', () => {
  it('finds static, side-effect, re-export, dynamic and require imports', () => {
    const code = `
      import React, { useState } from 'react';
      import * as Haptics from 'expo-haptics';
      import './polyfill';
      export { colors } from "./theme";
      const lazy = import('./screens/Lazy');
      const legacy = require('./legacy');
    `;
    expect(findImports(code).sort()).toEqual(['./legacy', './polyfill', './screens/Lazy', './theme', 'expo-haptics', 'react']);
  });

  it('ignores commented-out imports but keeps URLs intact', () => {
    const code = `// import axios from 'axios';\n/* import x from 'lodash'; */\nconst url = 'https://example.com'; import { View } from 'react-native';`;
    expect(findImports(code)).toEqual(['react-native']);
  });
});

describe('packages', () => {
  it('packageName handles scoped packages and deep imports', () => {
    expect(packageName('@expo/vector-icons/Ionicons')).toBe('@expo/vector-icons');
    expect(packageName('react-native-safe-area-context')).toBe('react-native-safe-area-context');
    expect(packageName('lodash/debounce')).toBe('lodash');
  });

  it('isAllowedModule accepts core modules and the allow-list only', () => {
    expect(isAllowedModule('react')).toBe(true);
    expect(isAllowedModule('react-native')).toBe(true);
    expect(isAllowedModule('@react-native-async-storage/async-storage')).toBe(true);
    expect(isAllowedModule('@react-navigation/native')).toBe(false);
    expect(isAllowedModule('axios')).toBe(false);
  });

  it('detectPackages lists third-party packages only, sorted', () => {
    const files = {
      'App.js': "import { View } from 'react-native';\nimport { Ionicons } from '@expo/vector-icons';",
      'src/a.js': "import AsyncStorage from '@react-native-async-storage/async-storage';\nimport { b } from './b';",
      'README.md': "import nothing from 'markdown';",
    };
    expect(detectPackages(files)).toEqual(['@expo/vector-icons', '@react-native-async-storage/async-storage']);
  });
});

describe('findMissingImports', () => {
  it('resolves ../ paths, extensions and index files', () => {
    const files = {
      'App.js': "import Home from './src/screens/Home';\nimport theme from './src/theme.js';",
      'src/screens/Home.js': "import Card from '../components/Card';\nimport { data } from '../data';\nimport { x } from '../utils/missing';",
      'src/components/Card.js': "export default function Card() {}",
      'src/data/index.js': 'export const data = [];',
    };
    expect(findMissingImports(files)).toEqual(['src/theme.js', 'src/utils/missing.js']);
  });

  it('is empty for a complete project', () => {
    expect(findMissingImports({ 'App.js': "import { a } from './a';", 'a.js': 'export const a = 1;' })).toEqual([]);
  });
});

it('the prompt contract names every allowed package and the forbidden ones', () => {
  const contract = runtimeContractForPrompt();
  expect(contract).toContain('@expo/vector-icons');
  expect(contract).toContain('react-native-safe-area-context');
  expect(contract).toMatch(/Forbidden:.*react-navigation/);
});
