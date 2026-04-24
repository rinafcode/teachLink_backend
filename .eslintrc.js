'use strict';

/**
 * ESLint configuration for TeachLink Backend
 *
 * Philosophy:
 *  - `eslint:recommended` + `@typescript-eslint/recommended` as the base.
 *  - `plugin:prettier/recommended` is always last so formatting rules win.
 *  - Type-aware rules (`@typescript-eslint/recommended-requiring-type-checking`)
 *    are NOT enabled globally because they slow linting in CI. They can be run
 *    locally via `npm run lint:typed`.
 *  - Rules that are correct in principle but noisy are set to 'warn' for now.
 *    Once the codebase is clean, bump them to 'error'.
 */

module.exports = {
  root: true,

  env: {
    node: true,
    jest: true,
    es2021: true,
  },

  parser: '@typescript-eslint/parser',
  parserOptions: {
    sourceType: 'module',
    ecmaVersion: 2021,
    tsconfigRootDir: __dirname,
    project: undefined, // type-aware linting opt-in only
  },

  plugins: ['@typescript-eslint', 'prettier'],

  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended', // must be last
  ],

  ignorePatterns: [
    'dist/**',
    'node_modules/**',
    'coverage/**',
    '.eslintrc.js',
    'jest.config.js',
    'lint-staged.config.js',
  ],

  rules: {
    // ── Prettier formatting ──
    'prettier/prettier': 'error',

    // ── Strict TypeScript rules ──
    '@typescript-eslint/explicit-function-return-type': 'error',
    '@typescript-eslint/explicit-module-boundary-types': 'warn',
    '@typescript-eslint/no-explicit-any': 'error',

    // ── Variables ──
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': [
      'warn',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
        ignoreRestSiblings: true,
      },
    ],

    // ── Potential bugs ──
    'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
    'no-debugger': 'error',
    'no-duplicate-imports': 'error',
    '@typescript-eslint/no-shadow': 'warn',

    // ── Code quality ──
    'prefer-const': 'error',
    'no-var': 'error',
    'object-shorthand': ['warn', 'always'],
    'prefer-template': 'warn',
    'prefer-arrow-callback': 'warn',
    '@typescript-eslint/no-useless-constructor': 'warn',

    // ── Naming convention ──
    '@typescript-eslint/naming-convention': [
      'error',
      {
        selector: 'variable',
        modifiers: ['const'],
        format: ['camelCase', 'PascalCase', 'UPPER_CASE'],
      },
    ],

    // ── Formatting ──
    'semi': ['error', 'always'],
    'quotes': ['error', 'single', { avoidEscape: true }],
  },

  overrides: [
    {
      files: ['**/*.spec.ts', '**/*.e2e-spec.ts', 'test/**/*.ts'],
      rules: {
        '@typescript-eslint/no-unused-vars': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-non-null-assertion': 'off',
        'no-console': 'off',
      },
    },
    {
      files: ['src/migrations/**/*.ts'],
      rules: {
        'no-console': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
      },
    },
    {
      files: ['src/**/*.config.ts', 'src/**/*.seed.ts'],
      rules: {
        'no-console': 'off',
      },
    },
  ],
};
