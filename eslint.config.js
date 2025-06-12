import prettierPlugin from 'eslint-plugin-prettier';

export default [
  {
    files: ['**/*.js'],
    ignores: ['node_modules/**', 'js/**'],
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
      'prettier/prettier': 'error',
    },
  },
];
