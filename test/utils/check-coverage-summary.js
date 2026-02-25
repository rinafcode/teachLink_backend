const fs = require('fs');
const path = require('path');

const summaryPath = path.resolve(process.cwd(), 'coverage/coverage-summary.json');

if (!fs.existsSync(summaryPath)) {
  console.error(`Coverage summary not found at ${summaryPath}`);
  process.exit(1);
}

const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));
const globalCoverage = summary.total;

const thresholds = {
  lines: Number(process.env.COVERAGE_THRESHOLD_LINES || 70),
  statements: Number(process.env.COVERAGE_THRESHOLD_STATEMENTS || 70),
  functions: Number(process.env.COVERAGE_THRESHOLD_FUNCTIONS || 70),
  branches: Number(process.env.COVERAGE_THRESHOLD_BRANCHES || 70),
};

const metrics = ['lines', 'statements', 'functions', 'branches'];
const failed = [];

for (const metric of metrics) {
  const actual = globalCoverage[metric]?.pct ?? 0;
  const expected = thresholds[metric];
  if (actual < expected) {
    failed.push({ metric, actual, expected });
  }
}

if (failed.length > 0) {
  console.error('Coverage threshold check failed:');
  for (const { metric, actual, expected } of failed) {
    console.error(
      ` - ${metric}: ${actual.toFixed(2)}% is below required ${expected}%`,
    );
  }
  process.exit(1);
}

console.log('Coverage threshold check passed.');
