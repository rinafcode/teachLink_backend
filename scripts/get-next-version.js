#!/usr/bin/env node

/**
 * Calculate the next semantic version based on conventional commits
 * or a specified release type (patch, minor, major)
 *
 * Usage:
 *   node scripts/get-next-version.js [patch|minor|major]
 *   node scripts/get-next-version.js tag
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const releaseType = process.argv[2] || 'auto';

// Read current version from package.json
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const currentVersion = packageJson.version;

// Parse current version
const [major, minor, patch] = currentVersion.split('.').map(Number);

let nextVersion;

if (releaseType === 'tag') {
  // Tag-based release - extract from git tag
  try {
    const tag = execSync('git describe --tags --abbrev=0', { encoding: 'utf8' }).trim();
    nextVersion = tag.replace(/^v/, '');
  } catch (e) {
    console.error('Failed to get git tag');
    process.exit(1);
  }
} else if (releaseType === 'auto') {
  // Analyze commits since last tag to determine version bump
  try {
    const commits = execSync(
      'git log $(git describe --tags --abbrev=0)..HEAD --oneline',
      { encoding: 'utf8' }
    ).trim().split('\n');

    let hasBreaking = false;
    let hasFeature = false;

    commits.forEach(commit => {
      if (commit.includes('BREAKING CHANGE:') || commit.startsWith('!')) {
        hasBreaking = true;
      }
      if (commit.startsWith('feat')) {
        hasFeature = true;
      }
    });

    if (hasBreaking) {
      nextVersion = `${major + 1}.0.0`;
    } else if (hasFeature) {
      nextVersion = `${major}.${minor + 1}.0`;
    } else {
      nextVersion = `${major}.${minor}.${patch + 1}`;
    }
  } catch (e) {
    // No tags yet - start from 0.1.0
    nextVersion = '0.1.0';
  }
} else if (['patch', 'minor', 'major'].includes(releaseType)) {
  // Manual version bump
  if (releaseType === 'major') {
    nextVersion = `${major + 1}.0.0`;
  } else if (releaseType === 'minor') {
    nextVersion = `${major}.${minor + 1}.0`;
  } else {
    nextVersion = `${major}.${minor}.${patch + 1}`;
  }
} else {
  console.error(`Invalid release type: ${releaseType}`);
  console.error('Usage: node scripts/get-next-version.js [patch|minor|major|auto|tag]');
  process.exit(1);
}

// Output for GitHub Actions
console.log(`::set-output name=new_version::${nextVersion}`);
console.log(`New version: ${nextVersion}`);

// Also write to file for use in other scripts
fs.writeFileSync(path.join(__dirname, '..', '.next_version'), nextVersion, 'utf8');

process.exit(0);
