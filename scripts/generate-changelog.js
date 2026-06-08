#!/usr/bin/env node

/**
 * Generate changelog from conventional commits.
 *
 * Generates a changelog entry for a new version based on commits
 * since the last tag, following Keep a Changelog format.
 *
 * Usage:
 *   node scripts/generate-changelog.js <version|auto>
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const versionArg = process.argv[2] || 'auto';

function runGit(command) {
  return execSync(command, { encoding: 'utf8' }).trim();
}

function getNextVersion() {
  if (versionArg !== 'auto') {
    return versionArg;
  }

  const output = runGit('node scripts/get-next-version.js auto');
  const match = output.match(/New version:\s*(\d+\.\d+\.\d+)/);
  if (!match) {
    throw new Error(`Unable to determine next version from output:\n${output}`);
  }
  return match[1];
}

function getLastTag() {
  try {
    return runGit('git describe --tags --abbrev=0');
  } catch (error) {
    return null;
  }
}

function getCommitsSinceLastTag() {
  const lastTag = getLastTag();
  const range = lastTag ? `${lastTag}..HEAD` : 'HEAD';
  const output = runGit(`git log ${range} --pretty=format:"%H%n%s%n%b%n__COMMIT_END__"`);
  return output
    .split('\n__COMMIT_END__')
    .map(block => block.trim())
    .filter(Boolean);
}

function parseCommit(commitBlock) {
  const lines = commitBlock.split('\n');
  const hash = lines.shift().trim();
  const subject = lines.shift()?.trim() || '';
  const body = lines.join('\n').trim();

  const headerRegex = /^(?<type>[a-z]+)(?<scope>\([^)]+\))?(?<breaking>!)?:\s*(?<description>.+)$/;
  const headerMatch = subject.match(headerRegex);

  let type = 'other';
  let description = subject;
  let breaking = false;

  if (headerMatch?.groups) {
    type = headerMatch.groups.type.toLowerCase();
    description = headerMatch.groups.description.trim();
    breaking = Boolean(headerMatch.groups.breaking);
  }

  if (/BREAKING CHANGE/i.test(subject) || /BREAKING CHANGE/i.test(body)) {
    breaking = true;
  }

  const issueMatches = [subject, body]
    .flatMap(text => [...text.matchAll(/#(\d+)/g)].map(match => `#${match[1]}`));
  const issueRef = issueMatches.length ? ` (${[...new Set(issueMatches)].join(', ')})` : '';

  return {
    hash: hash.substring(0, 7),
    type,
    description: description.replace(/\s*\(.*\)$/, '').trim(),
    issueRef,
    breaking,
  };
}

function categorizeCommits(commits) {
  const categories = {
    breaking: [],
    added: [],
    fixed: [],
    changed: [],
    performance: [],
    documentation: [],
    testing: [],
    chore: [],
    ci: [],
    build: [],
    reverted: [],
    other: [],
  };

  const typeToCategory = {
    feat: 'added',
    fix: 'fixed',
    docs: 'documentation',
    style: 'changed',
    refactor: 'changed',
    perf: 'performance',
    test: 'testing',
    chore: 'chore',
    ci: 'ci',
    build: 'build',
    revert: 'reverted',
  };

  commits.forEach(commitBlock => {
    const commit = parseCommit(commitBlock);
    if (commit.breaking) {
      categories.breaking.push(commit);
      return;
    }

    const category = typeToCategory[commit.type] || 'other';
    categories[category].push(commit);
  });

  return categories;
}

function formatCommitLine(commit) {
  return `- ${commit.description}${commit.issueRef} ([${commit.hash}](https://github.com/teachLink/teachLink_backend/commit/${commit.hash}))`;
}

function buildChangelogEntry(version, categories) {
  const date = new Date().toISOString().split('T')[0];
  const lines = [`## [${version}] - ${date}`, ''];

  const sectionDefinitions = [
    { key: 'breaking', title: '⚠️ BREAKING CHANGES' },
    { key: 'added', title: 'Added' },
    { key: 'fixed', title: 'Fixed' },
    { key: 'changed', title: 'Changed' },
    { key: 'performance', title: 'Performance' },
    { key: 'documentation', title: 'Documentation' },
    { key: 'testing', title: 'Testing' },
    { key: 'chore', title: 'Chores' },
    { key: 'ci', title: 'CI / Build' },
    { key: 'build', title: 'CI / Build' },
    { key: 'reverted', title: 'Reverted' },
    { key: 'other', title: 'Other Changes' },
  ];

  sectionDefinitions.forEach(section => {
    const entries = categories[section.key] || [];
    if (!entries.length) {
      return;
    }

    if (section.key === 'build' && categories.ci.length) {
      return;
    }

    if (section.key === 'ci' && categories.build.length) {
      const mergedEntries = [...categories.ci, ...categories.build];
      lines.push(`### ${section.title}`, '');
      mergedEntries.forEach(commit => lines.push(formatCommitLine(commit)));
      lines.push('');
      return;
    }

    lines.push(`### ${section.title}`, '');
    entries.forEach(commit => lines.push(formatCommitLine(commit)));
    lines.push('');
  });

  return lines.join('\n');
}

function updateChangelog(changelogEntry) {
  const changelogPath = path.join(__dirname, '..', 'CHANGELOG.md');
  let existing = '';

  try {
    existing = fs.readFileSync(changelogPath, 'utf8');
  } catch (error) {
    existing = '# Changelog\n\nAll notable changes to this project will be documented in this file.\n\n' +
      'The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),\n' +
      'and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).\n\n';
  }

  const headerRegex = /^(# Changelog[\s\S]*?)(?=\n## \[|\n##\s|$)/;
  const headerMatch = existing.match(headerRegex);

  let intro = '';
  let body = '';
  if (headerMatch) {
    intro = headerMatch[1].trimEnd() + '\n\n';
    body = existing.slice(headerMatch[1].length).trimStart();
  } else {
    intro = '# Changelog\n\nAll notable changes to this project will be documented in this file.\n\n' +
      'The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),\n' +
      'and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).\n\n';
    body = existing.trimStart();
  }

  const newChangelog = [intro.trimEnd(), '', changelogEntry.trimEnd(), '', body.trimStart()].filter(Boolean).join('\n\n') + '\n';
  fs.writeFileSync(changelogPath, newChangelog, 'utf8');
}

function validateVersion(version) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error('Version must be a semantic version like 1.2.3');
  }
}

try {
  const newVersion = getNextVersion();
  validateVersion(newVersion);

  const commits = getCommitsSinceLastTag();
  if (!commits.length) {
    console.error('No commits found since the last tag. No changelog generated.');
    process.exit(1);
  }

  const categories = categorizeCommits(commits);
  const hasEntries = Object.values(categories).some(entries => entries.length > 0);
  if (!hasEntries) {
    console.error('No conventional commits found since the last tag. No changelog generated.');
    process.exit(1);
  }

  const changelogEntry = buildChangelogEntry(newVersion, categories);
  updateChangelog(changelogEntry);

  console.log(`Generated changelog for version ${newVersion}`);
  console.log('Changelog preview:');
  console.log(changelogEntry);
  process.exit(0);
} catch (error) {
  console.error('Error generating changelog:', error.message);
  process.exit(1);
}
