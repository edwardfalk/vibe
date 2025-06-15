import prettierPlugin from 'eslint-plugin-prettier';

export default [
  {
    files: ['**/*.js'],
    ignores: [
      'node_modules/**',
      'js/**',
      '.debug/**',
      'playwright-report/**',
      'test-results/**',
      '.cursor/**',
      '.vscode/**',
    ],
    languageOptions: {
      sourceType: 'module',
      ecmaVersion: 2021,
    },
    plugins: {
      prettier: prettierPlugin,
    },
    rules: {
      'prefer-const': 'error',
      'no-var': 'error',
      'no-undef': 'error',
      'prettier/prettier': 'error',
    },
  },
];
