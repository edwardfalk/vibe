import prettierPlugin from 'eslint-plugin-prettier';
import noMathPi from './scripts/eslint-rules/no-math-pi.js';
import noP5Globals from './scripts/eslint-rules/no-p5-globals.js';
import noRawGotoIndex from './scripts/eslint-rules/no-raw-goto-index.js';

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
      ecmaVersion: 'latest',
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
      'vibe-no-math-pi': { rules: { 'no-math-pi': noMathPi } },
      'vibe-no-p5-globals': { rules: { 'no-p5-globals': noP5Globals } },
      'vibe-no-raw-goto-index': {
        rules: { 'no-raw-goto-index': noRawGotoIndex },
      },
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
        },
      ],
      // PRD-aligned guardrails
      'vibe-no-math-pi/no-math-pi': 'warn',
      'vibe-no-p5-globals/no-p5-globals': 'warn',
    },
  },
  // Targeted overrides
  {
    files: ['packages/**/src/**/*.js'],
    rules: {
      'vibe-no-math-pi/no-math-pi': 'error',
      'vibe-no-p5-globals/no-p5-globals': 'error',
    },
  },
  {
    files: ['tests/**/*.js'],
    rules: {
      'vibe-no-raw-goto-index/no-raw-goto-index': 'error',
    },
  },
];
