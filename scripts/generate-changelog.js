#!/usr/bin/env node

/**
 * Generate changelog from conventional commits
 *
 * Generates a changelog entry for a new version based on commits
 * since the last tag, following Keep a Changelog format
 *
 * Usage:
 *   node scripts/generate-changelog.js <version>
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const newVersion = process.argv[2];

if (!newVersion) {
  console.error('Usage: node scripts/generate-changelog.js <version>');
  process.exit(1);
}

// Get commits since last tag
let commits = [];
try {
  const lastTag = execSync('git describe --tags --abbrev=0', { encoding: 'utf8' }).trim();
  const output = execSync(`git log ${lastTag}..HEAD --pretty=format:"%H|%s|%b"`, {
    encoding: 'utf8'
  });
  commits = output.trim().split('\n').filter(line => line);
} catch (e) {
  // No tags yet - get all commits
  try {
    const output = execSync('git log --pretty=format:"%H|%s|%b"', { encoding: 'utf8' });
    commits = output.trim().split('\n').filter(line => line);
  } catch (e2) {
    console.warn('Warning: Could not get commits from git');
    commits = [];
  }
}

// Parse commits into categories
const categories = {
  breaking: [],
  features: [],
  fixes: [],
  docs: [],
  style: [],
  refactor: [],
  perf: [],
  test: [],
  chore: [],
  other: []
};

commits.forEach(commitLine => {
  const [hash, subject, body] = commitLine.split('|');
  
  let category = 'other';
  let message = subject;

  // Determine category from subject
  if (subject.includes('BREAKING CHANGE') || subject.startsWith('!')) {
    category = 'breaking';
    message = subject.replace(/^!:\s*/, '').replace(/\s*\(.*\)/, '');
  } else if (subject.startsWith('feat')) {
    category = 'features';
    message = message.replace(/^feat(\(.+\))?:\s*/, '');
  } else if (subject.startsWith('fix')) {
    category = 'fixes';
    message = message.replace(/^fix(\(.+\))?:\s*/, '');
  } else if (subject.startsWith('docs')) {
    category = 'docs';
    message = message.replace(/^docs(\(.+\))?:\s*/, '');
  } else if (subject.startsWith('style')) {
    category = 'style';
    message = message.replace(/^style(\(.+\))?:\s*/, '');
  } else if (subject.startsWith('refactor')) {
    category = 'refactor';
    message = message.replace(/^refactor(\(.+\))?:\s*/, '');
  } else if (subject.startsWith('perf')) {
    category = 'perf';
    message = message.replace(/^perf(\(.+\))?:\s*/, '');
  } else if (subject.startsWith('test')) {
    category = 'test';
    message = message.replace(/^test(\(.+\))?:\s*/, '');
  } else if (subject.startsWith('chore')) {
    category = 'chore';
    message = message.replace(/^chore(\(.+\))?:\s*/, '');
  }

  // Extract issue references
  const issueMatch = body?.match(/#(\d+)/) || subject.match(/#(\d+)/);
  const issueRef = issueMatch ? ` (#${issueMatch[1]})` : '';

  if (message && message !== subject) {
    categories[category].push({
      message: message.trim(),
      hash: hash.substring(0, 7),
      issue: issueRef
    });
  }
});

// Generate changelog entry
let changelogEntry = `## [${newVersion}] - ${new Date().toISOString().split('T')[0]}\n\n`;

let hasContent = false;

if (categories.breaking.length > 0) {
  hasContent = true;
  changelogEntry += '### ⚠️ BREAKING CHANGES\n\n';
  categories.breaking.forEach(commit => {
    changelogEntry += `- ${commit.message}${commit.issue} ([${commit.hash}](https://github.com/teachLink/teachLink_backend/commit/${commit.hash}))\n`;
  });
  changelogEntry += '\n';
}

if (categories.features.length > 0) {
  hasContent = true;
  changelogEntry += '### Added\n\n';
  categories.features.forEach(commit => {
    changelogEntry += `- ${commit.message}${commit.issue}\n`;
  });
  changelogEntry += '\n';
}

if (categories.fixes.length > 0) {
  hasContent = true;
  changelogEntry += '### Fixed\n\n';
  categories.fixes.forEach(commit => {
    changelogEntry += `- ${commit.message}${commit.issue}\n`;
  });
  changelogEntry += '\n';
}

if (categories.refactor.length > 0) {
  hasContent = true;
  changelogEntry += '### Changed\n\n';
  categories.refactor.forEach(commit => {
    changelogEntry += `- ${commit.message}${commit.issue}\n`;
  });
  changelogEntry += '\n';
}

if (categories.perf.length > 0) {
  hasContent = true;
  changelogEntry += '### Performance\n\n';
  categories.perf.forEach(commit => {
    changelogEntry += `- ${commit.message}${commit.issue}\n`;
  });
  changelogEntry += '\n';
}

if (categories.docs.length > 0) {
  hasContent = true;
  changelogEntry += '### Documentation\n\n';
  categories.docs.forEach(commit => {
    changelogEntry += `- ${commit.message}${commit.issue}\n`;
  });
  changelogEntry += '\n';
}

// Read existing changelog
const changelogPath = path.join(__dirname, '..', 'CHANGELOG.md');
let existingChangelog = '';

try {
  existingChangelog = fs.readFileSync(changelogPath, 'utf8');
} catch (e) {
  // Create new changelog file if it doesn't exist
  existingChangelog = '# Changelog\n\nAll notable changes to this project will be documented in this file.\n\n' +
    'The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),\n' +
    'and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).\n\n';
}

// Remove "## [Unreleased]" section if it exists
const unreleaseRegex = /## \[Unreleased\]\s*\n(?:### Added\n[\s\S]*?)?\n*/;
const updatedChangelog = existingChangelog.replace(unreleaseRegex, '');

// Insert new version at the top
const finalChangelog = changelogEntry + updatedChangelog;

// Write updated changelog
fs.writeFileSync(changelogPath, finalChangelog, 'utf8');

// Output for GitHub Actions
console.log('::set-output name=changelog::' + changelogEntry.replace(/\n/g, '%0A'));
console.log(`Generated changelog for version ${newVersion}`);
console.log('Changelog preview:');
console.log(changelogEntry);

process.exit(0);
