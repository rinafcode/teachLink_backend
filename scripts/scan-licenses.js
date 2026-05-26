#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, '../compliance/reports');

const ALLOWED_LICENSES = [
  'MIT', 'Apache-2.0', 'Apache-2', 'BSD-2-Clause', 'BSD-3-Clause', 'BSD-4-Clause',
  'ISC', 'MPL-2.0', 'CC0-1.0', 'Unlicense', '0BSD', 'BSD'
];

const PROHIBITED_LICENSES = ['GPL-3.0', 'AGPL-3.0', 'SSPL-1.0', 'UNLICENSED', 'Proprietary'];
const REVIEW_LICENSES = ['LGPL-2.1', 'LGPL-3.0', 'LGPL-3.0-OR-LATER'];

function ensureDirectory(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function parsePackageLock() {
  const lockData = JSON.parse(fs.readFileSync(path.join(__dirname, '../package-lock.json'), 'utf-8'));
  const packages = [];
  
  Object.entries(lockData.packages).forEach(([pkgPath, info]) => {
    if (pkgPath === '' || pkgPath.startsWith('node_modules/')) {
      const name = info.name || pkgPath.replace('node_modules/', '').split('node_modules/').pop();
      if (name && !pkgPath.startsWith('node_modules/@types/')) {
        packages.push({
          name,
          version: info.version || 'unknown',
          license: info.license || 'UNKNOWN',
          type: pkgPath === '' ? 'root' : 'dep'
        });
      }
    }
  });
  
  return packages;
}

function normalizeLicense(license) {
  if (!license) return 'UNKNOWN';
  let result = license.replace(/\s+/g, ' ').trim();
  result = result.replace(/^\((.+)\)$/, '$1');
  return result.toUpperCase();
}

function extractLicenses(license) {
  if (!license) return [];
  const cleaned = license.replace(/\(|\)/g, '').toUpperCase();
  return cleaned.split(/\s+OR\s+/).map(l => l.trim()).filter(l => l);
}

function isAllowed(license) {
  const licenses = extractLicenses(license);
  return licenses.some(l => ALLOWED_LICENSES.some(a => l.includes(a.toUpperCase()) || l === a.toUpperCase()));
}

function needsReview(license) {
  const norm = license.toUpperCase();
  return REVIEW_LICENSES.some(l => norm.includes(l.toUpperCase()));
}

function analyzeLicenses(packages) {
  const results = { total: packages.length, allowed: [], prohibited: [], unknown: [], reviewRequired: [] };

  for (const pkg of packages) {
    if (pkg.type === 'root') continue;
    const license = normalizeLicense(pkg.license);
    
    if (license === 'UNKNOWN' || !license) {
      results.unknown.push(pkg);
    } else if (needsReview(license)) {
      results.reviewRequired.push(pkg);
    } else if (PROHIBITED_LICENSES.some(l => license.includes(l))) {
      results.prohibited.push(pkg);
    } else if (isAllowed(license)) {
      results.allowed.push(pkg);
    } else {
      results.reviewRequired.push(pkg);
    }
  }
  return results;
}

function generateReport(results) {
  const report = {
    timestamp: new Date().toISOString(),
    project: 'teachLink_backend',
    version: '0.0.1',
    summary: {
      total: results.total,
      allowed: results.allowed.length,
      prohibited: results.prohibited.length,
      unknown: results.unknown.length,
      reviewRequired: results.reviewRequired.length
    },
    status: results.prohibited.length > 0 ? 'FAILED' : (results.reviewRequired.length > 0 ? 'WARNING' : 'PASSED'),
    details: results
  };

  ensureDirectory(OUTPUT_DIR);
  const reportPath = path.join(OUTPUT_DIR, `license-report-${Date.now()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log('\n=== License Compliance Report ===');
  console.log(`Total packages: ${results.total}`);
  console.log(`Allowed: ${results.allowed.length}`);
  console.log(`Prohibited: ${results.prohibited.length}`);
  console.log(`Unknown: ${results.unknown.length}`);
  console.log(`Review required: ${results.reviewRequired.length}`);
  console.log(`\nStatus: ${report.status}`);
  console.log(`Report: ${reportPath}\n`);

  if (results.prohibited.length > 0) {
    console.log('PROHIBITED:');
    results.prohibited.forEach(p => console.log(`  - ${p.name}: ${p.license}`));
  }

  return report;
}

function main() {
  ensureDirectory(OUTPUT_DIR);
  console.log('Scanning license compliance...');
  
  try {
    const packages = parsePackageLock();
    const results = analyzeLicenses(packages);
    generateReport(results);
    process.exit(results.prohibited.length > 0 ? 1 : 0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();