import prettierPlugin from 'eslint-plugin-prettier';

export default [
  {
    // Global ignores (an object with only `ignores` applies to every config)
    ignores: ['node_modules/**', '.worktrees/**', '.superpowers/**'],
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      sourceType: 'module',
      ecmaVersion: 2022,
    },
    plugins: {
      prettier: prettierPlugin,
    },
    rules: {
      'prefer-const': 'error',
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
