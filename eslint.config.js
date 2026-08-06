import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', '.wrangler', 'public/sw.js'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // The API client is the only place raw fetch is allowed (ADR-009). The
      // pre-commit hook enforces it; this keeps the same rule visible in-editor.
      'no-restricted-globals': 'off',
    },
  },
  {
    // Screens compose from the inventory; they must not reach for the network
    // or the database directly.
    files: ['src/web/screens/**/*.tsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.name='fetch']",
          message: 'Use src/web/lib/api.ts — raw fetch is not allowed in screens.',
        },
      ],
    },
  },
);
