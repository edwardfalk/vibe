import prettierPlugin from 'eslint-plugin-prettier';

// Every global the code uses, the browser's and Node's alike, so no-undef
// fails a misspelled name (windw.audio) in a branch no test reaches
const GLOBALS = Object.fromEntries(
  [
    'AbortController',
    'AudioBufferSourceNode',
    'AudioContext',
    'AudioDestinationNode',
    'AudioNode',
    'AudioScheduledSourceNode',
    'BiquadFilterNode',
    'Buffer',
    'Event',
    'GainNode',
    'KeyboardEvent',
    'OfflineAudioContext',
    'Option',
    'PerformanceObserver',
    'URL',
    'URLSearchParams',
    'Worker',
    'WorkerGlobalScope',
    'clearInterval',
    'clearTimeout',
    'console',
    'document',
    'fetch',
    'localStorage',
    'location',
    'navigator',
    'performance',
    'process',
    'self',
    'setImmediate',
    'setInterval',
    'setTimeout',
    'structuredClone',
    'window',
  ].map((name) => [name, 'readonly'])
);

export default [
  {
    // Global ignores (an object with only `ignores` applies to every config)
    ignores: [
      'node_modules/**',
      '.worktrees/**',
      '.superpowers/**',
      'docs/superpowers/**',
      'js/vendor/**',
    ],
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      sourceType: 'module',
      ecmaVersion: 2022,
      globals: GLOBALS,
    },
    plugins: {
      prettier: prettierPlugin,
    },
    rules: {
      'prefer-const': 'error',
      'no-undef': 'error',
      'no-var': 'error',
      // Unused parameters are often part of an interface (overridden enemy
      // methods, p5 callbacks) and `catch (_)` is deliberate; flag the rest
      'no-unused-vars': [
        'error',
        { args: 'none', caughtErrors: 'none', ignoreRestSiblings: true },
      ],
      'prettier/prettier': 'error',
    },
  },
  {
    // Game code logs nothing routine; the test tools under tests/ report
    // through console.log on purpose
    files: ['js/**/*.js'],
    rules: { 'no-console': ['error', { allow: ['warn', 'error'] }] },
  },
];
