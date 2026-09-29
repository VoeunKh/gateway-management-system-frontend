import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'dist',
      'coverage',
      'playwright-report',
      'test-results',
      'src/api/types.gen.ts',
      'src/api/proposed.gen.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    languageOptions: { globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { ignoreRestSiblings: true }],
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-restricted-syntax': [
        'error',
        { selector: 'ExportDefaultDeclaration', message: 'Use named exports only.' },
      ],
      'no-restricted-imports': [
        'error',
        { name: 'react', message: 'Import from preact or preact/hooks.' },
        { name: 'react-dom', message: 'Import from preact or preact/compat.' },
      ],
    },
  },
  {
    // Tool configs must default-export and run in Node.
    files: ['*.{js,cjs,ts}'],
    languageOptions: { globals: { ...globals.node } },
    rules: { 'no-restricted-syntax': 'off' },
  },
  prettier,
);
