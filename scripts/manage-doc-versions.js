/**
 * Documentation versioning manager
 * Manages and archives API documentation versions for tracking API changes over time
 *
 * Usage:
 *   node scripts/manage-doc-versions.js                    # Show current version
 *   node scripts/manage-doc-versions.js archive <version>  # Archive current docs as version
 *   node scripts/manage-doc-versions.js list               # List all archived versions
 *   node scripts/manage-doc-versions.js compare <v1> <v2>  # Compare two versions
 *   node scripts/manage-doc-versions.js diff <v1> <v2>     # Show endpoint changes between versions
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

const rootDir = path.resolve(__dirname, '..');
const versionsDir = path.join(rootDir, 'docs', 'versions');
const apiSpecFile = path.join(rootDir, 'openapi-spec.json');
const versionIndexFile = path.join(versionsDir, 'VERSIONS.md');
const changelogFile = path.join(versionsDir, 'CHANGELOG.md');

/**
 * Get current API version from package.json
 */
function getCurrentVersion() {
  const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf-8'));
  return pkg.version || '0.0.1';
}

/**
 * Get OpenAPI spec version
 */
function getOpenAPIVersion() {
  if (!fs.existsSync(apiSpecFile)) {
    return null;
  }
  const spec = JSON.parse(fs.readFileSync(apiSpecFile, 'utf-8'));
  return spec.info.version;
}

/**
 * Ensure versions directory exists
 */
function ensureVersionsDir() {
  if (!fs.existsSync(versionsDir)) {
    fs.mkdirSync(versionsDir, { recursive: true });
  }
}

/**
 * Archive current documentation as a version
 */
function archiveVersion(version) {
  ensureVersionsDir();

  const versionDir = path.join(versionsDir, `v${version}`);
  if (fs.existsSync(versionDir)) {
    console.error(`❌ Version v${version} already exists at ${versionDir}`);
    process.exit(1);
  }

  fs.mkdirSync(versionDir, { recursive: true });

  // Copy OpenAPI spec
  if (fs.existsSync(apiSpecFile)) {
    fs.copyFileSync(apiSpecFile, path.join(versionDir, 'openapi-spec.json'));
  }

  // Copy examples
  const examplesSource = path.join(rootDir, 'docs', 'api', 'examples.md');
  if (fs.existsSync(examplesSource)) {
    fs.copyFileSync(examplesSource, path.join(versionDir, 'examples.md'));
  }

  // Copy multi-language examples
  const multiLangDir = path.join(rootDir, 'docs', 'examples');
  if (fs.existsSync(multiLangDir)) {
    const destMultiLangDir = path.join(versionDir, 'examples');
    fs.mkdirSync(destMultiLangDir, { recursive: true });
    fs.readdirSync(multiLangDir).forEach((file) => {
      const src = path.join(multiLangDir, file);
      const dest = path.join(destMultiLangDir, file);
      fs.copyFileSync(src, dest);
    });
  }

  // Create version metadata
  const metadata = {
    version,
    timestamp: new Date().toISOString(),
    packageVersion: getCurrentVersion(),
    gitHash: getGitHash(),
  };

  fs.writeFileSync(path.join(versionDir, 'metadata.json'), JSON.stringify(metadata, null, 2));

  // Create README for version
  const readme = `# TeachLink API v${version}

Generated on ${metadata.timestamp}

## Files

- \`openapi-spec.json\` - OpenAPI/Swagger specification
- \`examples.md\` - cURL examples
- \`examples/\` - Multi-language code examples
- \`metadata.json\` - Version metadata

## View Documentation

To view this version's documentation:

\`\`\`bash
# View OpenAPI spec
cat openapi-spec.json

# View examples
cat examples.md

# Serve interactively with ReDoc
npx redoc-cli serve openapi-spec.json
\`\`\`

## Compare with other versions

\`\`\`bash
# Compare with current version
node scripts/manage-doc-versions.js diff ${version} latest

# Compare with another version
node scripts/manage-doc-versions.js diff ${version} <other-version>
\`\`\`
`;

  fs.writeFileSync(path.join(versionDir, 'README.md'), readme);

  console.log(`✅ Archived API documentation as v${version}`);
  console.log(`   Location: ${path.relative(rootDir, versionDir)}`);
  console.log(`   Files: openapi-spec.json, examples.md, examples/, metadata.json, README.md`);

  updateVersionIndex(version);
  updateChangelog(version);
}

/**
 * Get git commit hash
 */
function getGitHash() {
  try {
    const hash = require('child_process').execSync('git rev-parse --short HEAD', {
      encoding: 'utf-8',
      cwd: rootDir,
    });
    return hash.trim();
  } catch {
    return 'unknown';
  }
}

/**
 * List all archived versions
 */
function listVersions() {
  ensureVersionsDir();

  if (!fs.existsSync(versionsDir)) {
    console.log('No versions archived yet.');
    return;
  }

  const versions = fs
    .readdirSync(versionsDir)
    .filter((f) => f.startsWith('v') && fs.statSync(path.join(versionsDir, f)).isDirectory())
    .sort()
    .reverse();

  if (versions.length === 0) {
    console.log('No versions archived yet.');
    return;
  }

  console.log('\n📚 Archived API Versions\n');

  versions.forEach((version) => {
    const metadataFile = path.join(versionsDir, version, 'metadata.json');
    if (fs.existsSync(metadataFile)) {
      const metadata = JSON.parse(fs.readFileSync(metadataFile, 'utf-8'));
      console.log(`  ${version}`);
      console.log(`    Released: ${metadata.timestamp}`);
      console.log(`    Package: ${metadata.packageVersion}`);
      console.log(`    Commit: ${metadata.gitHash}\n`);
    }
  });

  console.log(`\n📖 View documentation:\n`);
  console.log(`  Current:  open docs/site/index.html`);
  versions.forEach((version) => {
    console.log(`  ${version}:    open docs/versions/${version}/openapi-spec.json`);
  });
}

/**
 * Compare OpenAPI specs between two versions
 */
function compareVersions(v1, v2) {
  let spec1, spec2;

  // Load first spec
  if (v1 === 'latest') {
    spec1 = JSON.parse(fs.readFileSync(apiSpecFile, 'utf-8'));
  } else {
    const specPath = path.join(versionsDir, v1, 'openapi-spec.json');
    if (!fs.existsSync(specPath)) {
      console.error(`❌ Version ${v1} not found`);
      process.exit(1);
    }
    spec1 = JSON.parse(fs.readFileSync(specPath, 'utf-8'));
  }

  // Load second spec
  if (v2 === 'latest') {
    spec2 = JSON.parse(fs.readFileSync(apiSpecFile, 'utf-8'));
  } else {
    const specPath = path.join(versionsDir, v2, 'openapi-spec.json');
    if (!fs.existsSync(specPath)) {
      console.error(`❌ Version ${v2} not found`);
      process.exit(1);
    }
    spec2 = JSON.parse(fs.readFileSync(specPath, 'utf-8'));
  }

  const changes = {
    added: [],
    removed: [],
    modified: [],
  };

  const paths1 = Object.keys(spec1.paths || {});
  const paths2 = Object.keys(spec2.paths || {});

  // Find added and removed endpoints
  paths2.forEach((path) => {
    if (!paths1.includes(path)) {
      changes.added.push(path);
    }
  });

  paths1.forEach((path) => {
    if (!paths2.includes(path)) {
      changes.removed.push(path);
    }
  });

  // Find modified endpoints
  paths1.forEach((path) => {
    if (paths2.includes(path)) {
      if (JSON.stringify(spec1.paths[path]) !== JSON.stringify(spec2.paths[path])) {
        changes.modified.push(path);
      }
    }
  });

  // Display results
  console.log(`\n📊 Changes from ${v1} to ${v2}\n`);

  if (changes.added.length > 0) {
    console.log('✅ Added Endpoints:');
    changes.added.forEach((p) => console.log(`   ${p}`));
    console.log();
  }

  if (changes.removed.length > 0) {
    console.log('❌ Removed Endpoints:');
    changes.removed.forEach((p) => console.log(`   ${p}`));
    console.log();
  }

  if (changes.modified.length > 0) {
    console.log('🔄 Modified Endpoints:');
    changes.modified.forEach((p) => console.log(`   ${p}`));
    console.log();
  }

  if (changes.added.length === 0 && changes.removed.length === 0 && changes.modified.length === 0) {
    console.log('✨ No changes between versions');
  }

  return changes;
}

/**
 * Show detailed diff between versions
 */
function diffVersions(v1, v2) {
  const changes = compareVersions(v1, v2);

  let spec1, spec2;

  if (v1 === 'latest') {
    spec1 = JSON.parse(fs.readFileSync(apiSpecFile, 'utf-8'));
  } else {
    spec1 = JSON.parse(fs.readFileSync(path.join(versionsDir, v1, 'openapi-spec.json'), 'utf-8'));
  }

  if (v2 === 'latest') {
    spec2 = JSON.parse(fs.readFileSync(apiSpecFile, 'utf-8'));
  } else {
    spec2 = JSON.parse(fs.readFileSync(path.join(versionsDir, v2, 'openapi-spec.json'), 'utf-8'));
  }

  // Print detailed changes
  if (changes.modified.length > 0) {
    console.log('\n📝 Detailed Changes to Endpoints:\n');

    changes.modified.forEach((endpoint) => {
      const oldPath = spec1.paths[endpoint];
      const newPath = spec2.paths[endpoint];

      console.log(`\n${endpoint}:`);

      const methods1 = Object.keys(oldPath);
      const methods2 = Object.keys(newPath);

      // Check for method changes
      methods1.forEach((method) => {
        if (!methods2.includes(method)) {
          console.log(`  ❌ Removed method: ${method.toUpperCase()}`);
        }
      });

      methods2.forEach((method) => {
        if (!methods1.includes(method)) {
          console.log(`  ✅ Added method: ${method.toUpperCase()}`);
        }
      });

      // Check parameter changes
      const oldParams = oldPath[Object.keys(oldPath)[0]]?.parameters || [];
      const newParams = newPath[Object.keys(newPath)[0]]?.parameters || [];

      if (JSON.stringify(oldParams) !== JSON.stringify(newParams)) {
        console.log(`  🔄 Parameters changed`);
      }
    });
  }
}

/**
 * Update version index
 */
function updateVersionIndex(version) {
  let index = `# TeachLink API Documentation Versions

This directory contains archived versions of the TeachLink API documentation.

## Current Version

\`\`\`
${getCurrentVersion()}
\`\`\`

## All Versions

| Version | Released | Package | Commit |
|---------|----------|---------|--------|
`;

  ensureVersionsDir();
  const versions = fs
    .readdirSync(versionsDir)
    .filter((f) => f.startsWith('v') && fs.statSync(path.join(versionsDir, f)).isDirectory())
    .sort()
    .reverse();

  versions.forEach((v) => {
    const metadataFile = path.join(versionsDir, v, 'metadata.json');
    if (fs.existsSync(metadataFile)) {
      const metadata = JSON.parse(fs.readFileSync(metadataFile, 'utf-8'));
      const timestamp = new Date(metadata.timestamp).toLocaleDateString();
      index += `| [${v}](./${v}/) | ${timestamp} | ${metadata.packageVersion} | ${metadata.gitHash} |\n`;
    }
  });

  index += `\n## View Documentation\n\n`;
  index += `- **Current**: [docs/site/index.html](../../site/index.html)\n`;
  versions.forEach((v) => {
    index += `- **${v}**: [${v}/openapi-spec.json](./${v}/openapi-spec.json)\n`;
  });

  fs.writeFileSync(versionIndexFile, index);
}

/**
 * Update changelog
 */
function updateChangelog(version) {
  let changelog = `# API Changelog

Tracks breaking changes and new features across API versions.

`;

  ensureVersionsDir();
  const versions = fs
    .readdirSync(versionsDir)
    .filter((f) => f.startsWith('v') && fs.statSync(path.join(versionsDir, f)).isDirectory())
    .sort()
    .reverse();

  versions.forEach((v, idx) => {
    const prevVersion = idx < versions.length - 1 ? versions[idx + 1] : 'v0.0.0';
    const changes = compareVersions(prevVersion, v);

    changelog += `## ${v}\n\n`;

    if (changes.added.length > 0) {
      changelog += `### ✅ Added\n\n`;
      changes.added.forEach((p) => (changelog += `- ${p}\n`));
      changelog += `\n`;
    }

    if (changes.removed.length > 0) {
      changelog += `### ❌ Breaking Changes\n\n`;
      changes.removed.forEach((p) => (changelog += `- Removed: ${p}\n`));
      changelog += `\n`;
    }

    if (changes.modified.length > 0) {
      changelog += `### 🔄 Modified\n\n`;
      changes.modified.forEach((p) => (changelog += `- ${p}\n`));
      changelog += `\n`;
    }
  });

  fs.writeFileSync(changelogFile, changelog);
}

// Main CLI
const command = process.argv[2];
const arg1 = process.argv[3];
const arg2 = process.argv[4];

switch (command) {
  case 'archive':
    archiveVersion(arg1 || getCurrentVersion());
    break;

  case 'list':
    listVersions();
    break;

  case 'compare':
    compareVersions(arg1 || 'latest', arg2 || 'v0.0.1');
    break;

  case 'diff':
    diffVersions(arg1 || 'latest', arg2 || 'v0.0.1');
    break;

  case 'status':
  default:
    console.log(`\n📦 Current API Version: ${getCurrentVersion()}`);
    console.log(`📄 OpenAPI Version: ${getOpenAPIVersion() || 'not found'}\n`);
    console.log('Usage:');
    console.log('  archive [version]    - Archive current docs as version');
    console.log('  list                 - List all archived versions');
    console.log('  compare <v1> <v2>    - Compare two versions');
    console.log('  diff <v1> <v2>       - Show detailed endpoint changes');
    console.log('  status               - Show current version info');
}
