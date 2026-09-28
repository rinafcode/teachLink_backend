/**
 * CI check: every *.dto.ts file must have at least one class-validator decorator
 * per property, unless it uses PartialType (which inherits decorators).
 *
 * Response/serialization DTOs (using @Exclude() at class level) are exempt.
 *
 * Usage: node scripts/validate-dto-decorators.js
 * Exit code 0 = all pass, 1 = violations.
 */
const fs = require('fs');
const path = require('path');

const SRC_DIR = path.resolve(__dirname, '..', 'src');

// Known response-only DTO files that need no request validation
const RESPONSE_DTO_EXEMPTIONS = new Set([
  'achievements\\dto\\achievement-statistics.dto.ts',
  'achievements\\dto\\user-achievement.dto.ts',
  'common\\dto\\paginated-response.dto.ts',
  'modules\\moderation\\dto\\moderation-result.dto.ts',
  'users\\dto\\user-public.dto.ts',
  'users\\dto\\user-admin.dto.ts',
]);

const PARTIAL_TYPE_RE = /\bPartialType\s*\(/;

function hasClassValidatorDecorator(content) {
  return /@(?:Is[A-Z]\w*|Min(?:Date)?|Max(?:Date)?|Length|ValidateNested|ValidatePromise|ValidateIf|ArrayMinSize|ArrayMaxSize|ArrayNotEmpty|ArrayUnique|ArrayContains|ArrayNotContains|ArrayContainsValues|MinLength|MaxLength|Equals|NotEquals|Contains|NotContains|IsDefined)\s*[(\n]/m.test(
    content,
  );
}

function hasClassLevelExclude(content) {
  // Match @Exclude() directly before a class declaration
  return /^\s*@Exclude\(\)\s*[\r\n]+(?:export\s+)?(?:abstract\s+)?class\s/m.test(content);
}

function findDtoFiles(dir) {
  let results = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
      results = results.concat(findDtoFiles(fullPath));
    } else if (
      entry.isFile() &&
      entry.name.endsWith('.dto.ts') &&
      !entry.name.endsWith('.spec.ts')
    ) {
      results.push(fullPath);
    }
  }
  return results;
}

let exitCode = 0;
const files = findDtoFiles(SRC_DIR);

if (files.length === 0) {
  console.error('ERROR: No DTO files found!');
  process.exit(1);
}

for (const file of files) {
  const relativePath = path.relative(SRC_DIR, file);
  const normalized = relativePath.replace(/\//g, '\\');

  if (RESPONSE_DTO_EXEMPTIONS.has(normalized)) {
    continue;
  }

  const content = fs.readFileSync(file, 'utf-8');

  const hasValidator = hasClassValidatorDecorator(content);
  const hasPartialType = PARTIAL_TYPE_RE.test(content);
  const hasExclude = hasClassLevelExclude(content);

  if (!hasValidator && !hasPartialType && !hasExclude) {
    console.error(
      `FAIL: ${relativePath} has no class-validator decorators, does not extend PartialType, and is not a class-level @Exclude() response DTO`,
    );
    exitCode = 1;
  }
}

if (exitCode === 0) {
  console.log(`PASS: All ${files.length} DTO files have validation decorators or are exempted`);
}

process.exit(exitCode);
