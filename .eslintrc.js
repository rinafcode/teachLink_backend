'use strict';

/**
 * ESLint configuration for TeachLink Backend
 *
 * Philosophy:
 *  - `eslint:recommended` + `@typescript-eslint/recommended` as the base.
 *  - `plugin:prettier/recommended` is always last so formatting rules win.
 *  - Type-aware rules (`@typescript-eslint/recommended-requiring-type-checking`)
 *    are NOT enabled globally because they make linting ~10× slower and cause
 *    issues in CI on large monorepo setups. They are enabled in the
 *    `lint:typed` script only, which developers can run locally.
 *  - Rules that are correct in principle but too noisy to enforce right now
 *    are set to `'warn'` rather than being disabled entirely. This surfaces
 *    issues in the developer's IDE without blocking CI. Once the codebase is
 *    clean, bump them to `'error'`.
 */

module.exports = {
  root: true,

  // ── Environment ─────────────────────────────────────────────────────────────
  env: {
    node: true,
    jest: true,
    es2021: true,
  },

  // ── Parser ───────────────────────────────────────────────────────────────────
  parser: '@typescript-eslint/parser',
  parserOptions: {
    sourceType: 'module',
    ecmaVersion: 2021,
    tsconfigRootDir: __dirname,
    // `project` intentionally left undefined for the default config.
    // Type-aware linting is opt-in via `npm run lint:typed`.
    project: undefined,
  },

  // ── Plugins ──────────────────────────────────────────────────────────────────
  plugins: ['@typescript-eslint', 'prettier'],

  // ── Shared extends ───────────────────────────────────────────────────────────
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended', // must be last
  ],

  // ── Global ignore patterns ───────────────────────────────────────────────────
  ignorePatterns: [
    'dist/**',
    'node_modules/**',
    'coverage/**',
    '.eslintrc.js',
    'jest.config.js',
    'lint-staged.config.js',
  ],

  // ── Rules ────────────────────────────────────────────────────────────────────
  rules: {
    // ── Prettier (formatting) ─────────────────────────────────────────────────
    // Prettier violations are errors so they block commits via lint-staged.
    'prettier/prettier': 'error',

    // ── TypeScript — disabled (too noisy on existing codebase) ────────────────
    '@typescript-eslint/interface-name-prefix': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'off',

    // ── Variables ─────────────────────────────────────────────────────────────
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

    // ── Potential bugs ────────────────────────────────────────────────────────
    '@typescript-eslint/no-floating-promises': 'off',
    '@typescript-eslint/no-misused-promises': 'off',
    'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
    'no-debugger': 'error',
    'no-duplicate-imports': 'error',
    'no-shadow': 'off',
    '@typescript-eslint/no-shadow': 'warn',
    'no-return-await': 'off',
    '@typescript-eslint/return-await': ['warn', 'in-try-catch'],

    // ── NestJS best practices ─────────────────────────────────────────────────
    '@typescript-eslint/no-unsafe-return': 'off',
    '@typescript-eslint/no-unsafe-assignment': 'off',
    '@typescript-eslint/no-unsafe-member-access': 'off',
    '@typescript-eslint/no-dynamic-delete': 'warn',
    '@typescript-eslint/prefer-as-const': 'error',
    'no-empty': ['error', { allowEmptyCatch: false }],
    eqeqeq: ['error', 'always', { null: 'ignore' }],
    'require-await': 'off',
    '@typescript-eslint/require-await': 'off',
    '@typescript-eslint/array-type': ['warn', { default: 'array-simple' }],
    '@typescript-eslint/no-non-null-assertion': 'warn',
    '@typescript-eslint/prefer-ts-expect-error': 'warn',
    '@typescript-eslint/ban-ts-comment': [
      'warn',
      {
        'ts-ignore': 'allow-with-description',
        'ts-expect-error': 'allow-with-description',
        'ts-nocheck': true,
      },
    ],

    // ── Code quality ──────────────────────────────────────────────────────────
    'prefer-const': 'error',
    'no-var': 'error',
    'object-shorthand': ['warn', 'always'],
    'prefer-template': 'warn',
    'prefer-arrow-callback': 'warn',
    'no-useless-constructor': 'off',
    '@typescript-eslint/no-useless-constructor': 'warn',
  },

  // ── Per-glob overrides ───────────────────────────────────────────────────────
  overrides: [
    // ── Test files ─────────────────────────────────────────────────────────────
    {
      files: ['**/*.spec.ts', '**/*.e2e-spec.ts', 'test/**/*.ts'],
      rules: {
        '@typescript-eslint/no-unused-vars': [
          'warn',
          {
            argsIgnorePattern: '.*',
            varsIgnorePattern: '.*',
            caughtErrorsIgnorePattern: '.*',
          },
        ],
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-non-null-assertion': 'off',
        'no-console': 'off',
      },
    },

    // ── Migration files ────────────────────────────────────────────────────────
    {
      files: ['src/migrations/**/*.ts'],
      rules: {
        'no-console': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
      },
    },

    // ── Config / seed files ───────────────────────────────────────────────────
    {
      files: ['src/**/*.config.ts', 'src/**/*.seed.ts'],
      rules: {
        'no-console': 'off',
      },
    },
  ],
};
