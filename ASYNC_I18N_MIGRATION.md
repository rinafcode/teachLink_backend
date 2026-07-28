# I18n Async Migration Summary

## Problem

The original `I18nWrapperService` loaded locale bundles synchronously in the constructor using `fs.readFileSync`, `fs.readdirSync`, and `fs.existsSync`. This had two critical issues:

1. **Missing locale files in production builds**: The build script used raw `tsc`, which does **not** copy `.json` files to `dist/`. In production, `dist/i18n/locales` was empty, causing the service to silently degrade every translation to key passthrough.

2. **Silent failure**: When the locales directory was missing or empty, the service logged an error but continued running, making it impossible to detect the broken state until translations failed in production.

## Solution

### 1. Async Lifecycle Loading

Moved locale loading from the constructor into `OnModuleInit`:

- All filesystem operations now use `fs/promises` (`readdir`, `readFile`)
- The service implements `OnModuleInit` and loads bundles in `onModuleInit()`
- Startup **fails loudly** (throws) when:
  - The locales directory cannot be read
  - The locales directory is empty
  - Locale directories exist but none produce a loadable bundle

### 2. Build Asset Configuration

Updated `nest-cli.json` to include locale files as assets:

```json
{
  "compilerOptions": {
    "assets": [{ "include": "i18n/locales/**/*", "watchAssets": true }],
    "watchAssets": true
  }
}
```

Changed the build script from `tsc -p tsconfig.build.json` to `nest build`, which:
- Uses the same `tsc` builder and `tsconfig.build.json`
- **Additionally** copies assets defined in `nest-cli.json` to `dist/`

### 3. Smoke Test

Added `src/i18n/i18n.build.spec.ts` to verify:
- `dist/i18n/locales` exists
- Locale directories are present
- The built service loads and translates a known key

Run after every build:

```bash
npm run build
npm run test:build
```

### 4. Updated Unit Tests

All unit tests now:
- Use `await makeService(root)` instead of synchronous construction
- Test the new fail-fast behavior (throws when locales are missing or empty)
- Verify that broken bundles are logged but don't cause startup to fail (only if at least one locale loads successfully)

## Files Changed

- **[src/i18n/i18n.service.ts](src/i18n/i18n.service.ts)**: Async lifecycle loading with fail-fast behavior
- **[nest-cli.json](nest-cli.json)**: Added `assets` array to copy locale files
- **[package.json](package.json)**: Changed build script to `nest build`, added `test:build` script
- **[src/i18n/i18n.service.spec.ts](src/i18n/i18n.service.spec.ts)**: Updated all tests to async
- **[src/i18n/i18n.build.spec.ts](src/i18n/i18n.build.spec.ts)**: New smoke test for built artifact

## Verification Steps

### 1. Run unit tests

```bash
npm test -- src/i18n/i18n.service.spec.ts
```

All tests should pass, including the new fail-fast scenarios.

### 2. Build and verify locale files are copied

```bash
npm run build
ls dist/i18n/locales
```

You should see `en/` and `ar/` directories with `.json` files inside.

### 3. Run the smoke test

```bash
npm run test:build
```

This verifies:
- Locale files exist in `dist/`
- The built service loads successfully
- Translations work against the built artifact

### 4. Test missing locales failure

```bash
# Temporarily rename the locales directory
mv src/i18n/locales src/i18n/locales.bak

# Rebuild
npm run build

# Try to start the app — should fail immediately with a clear error
npm run start:prod

# Restore
mv src/i18n/locales.bak src/i18n/locales
```

Expected error:

```
i18n: unable to read locales directory at "<path>/dist/i18n/locales".
The production build must ship the locale bundles (see nest-cli.json "assets").
```

## Migration Notes

- **No API changes**: The public interface (`translate()`, `getSupportedLocales()`, `getDirection()`) is unchanged.
- **Backwards compatible**: Existing consumers of `I18nWrapperService` require no code changes.
- **Docker**: The Dockerfile already copies the entire source tree before `npm run build`, so locale files will be present. No Dockerfile changes needed.
- **CI**: The CI workflow already runs `npm run build`. Locale files will now be copied to `dist/` automatically.

## Acceptance Criteria ✓

- [x] No synchronous filesystem call remains in the constructor
- [x] A production build contains the locale files (`dist/i18n/locales/en`, `dist/i18n/locales/ar`)
- [x] A missing locales directory produces a clear startup error
- [x] A dist-level test verifies translation works in the built artifact (`test:build`)
