'use strict';

/**
 * lint-staged configuration for TeachLink Backend
 *
 * Runs on every `git commit`. Only staged files are processed —
 * the full codebase is never re-linted, keeping the pre-commit
 * hook fast even in a large repo.
 *
 * Order of operations per staged TypeScript file:
 *   1. Prettier  — rewrites formatting in-place and re-stages the file.
 *   2. ESLint    — checks for rule violations; --fix applies safe auto-fixes.
 *                  If unfixable errors remain, the commit is blocked.
 *
 * JSON / Markdown / YAML files get Prettier only — no linting needed.
 */

module.exports = {
  // ── TypeScript source and test files ───────────────────────────────────────
  '{src,test,apps,libs}/**/*.ts': [
    // 1. Format first so ESLint sees already-formatted code.
    //    `--write` rewrites the file; lint-staged re-stages it automatically.
    'prettier --write',

    // 2. Lint with auto-fix for fixable violations.
    //    `--max-warnings 0` makes any warning fail the commit.
    //    Pass filenames explicitly so ESLint only checks staged files.
    'eslint --fix --max-warnings 0',
  ],

  // ── JSON files ─────────────────────────────────────────────────────────────
  '*.json': ['prettier --write'],

  // ── Markdown ───────────────────────────────────────────────────────────────
  '*.md': ['prettier --write'],

  // ── YAML (GitHub Actions, configs) ─────────────────────────────────────────
  '*.{yml,yaml}': ['prettier --write'],
};
