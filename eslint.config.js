import prettierPlugin from 'eslint-plugin-prettier';

export default [
  {
    files: ['**/*.js'],
    ignores: [
      'node_modules/**',
      '.debug/**',
      'playwright-report/**',
      'test-results/**',
      'scripts/scan-secrets.js',
      '.cursor/**',
      '.vscode/**',
    ],
    languageOptions: {
      sourceType: 'module',
      ecmaVersion: 2021,
      globals: {
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        navigator: 'readonly',
        frameCount: 'readonly',
        sin: 'readonly',
        cos: 'readonly',
        random: 'readonly',
        sqrt: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        fetch: 'readonly',
        require: 'readonly',
        module: 'readonly',
        __dirname: 'readonly',
        process: 'readonly',
        drawGlow: 'readonly',
        visualEffectsManager: 'readonly',
        SpeechSynthesisUtterance: 'readonly',
        localStorage: 'readonly',
        CustomEvent: 'readonly',
        constrain: 'readonly',
        dist: 'readonly',
        CLOSE: 'readonly',
        global: 'readonly',
        beforeAll: 'readonly',
        MouseEvent: 'readonly',
        URL: 'readonly',
        Response: 'readonly',
        performance: 'readonly',
        Bun: 'readonly',
      },
    },
    plugins: {
      prettier: prettierPlugin,
    },
    rules: {
      'prefer-const': 'error',
      'no-var': 'error',
      'no-undef': 'error',
      'prettier/prettier': 'error',
      // Disallow any new references to removed legacy audio code.
      'no-restricted-imports': [
        'error',
        {
          patterns: ['**/legacy/audio/*', '**/legacy/Audio.js'],
          message: 'Legacy audio modules are removed – use ToneAudioFacade instead.'
        },
      ],
    },
  },
];
