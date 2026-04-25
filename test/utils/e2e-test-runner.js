#!/usr/bin/env node

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class E2ETestRunner {
  constructor() {
    this.testResults = [];
    this.flakinessThreshold = 0.1; // 10% failure rate
    this.minRuns = 3;
  }

  async runStabilityTest(options = {}) {
    const {
      testPattern = '**/*.e2e-spec.ts',
      runs = 5,
      parallel = false,
      timeout = 300000, // 5 minutes per run
      outputDir = './test-results',
    } = options;

    console.log(`🧪 Running E2E stability test with ${runs} iterations...`);
    console.log(`📊 Test Pattern: ${testPattern}`);
    console.log(`⚡ Parallel Execution: ${parallel ? 'Yes' : 'No'}`);
    console.log('');

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const results = [];

    for (let run = 1; run <= runs; run++) {
      console.log(`🏃 Run ${run}/${runs} starting...`);

      try {
        const result = await this.runSingleTest(testPattern, run, timeout);
        results.push(result);

        console.log(`✅ Run ${run}/${runs} completed: ${result.passed}/${result.total} tests passed`);

        if (result.failed > 0) {
          console.log(`❌ Failed tests: ${result.failures.map(f => f.title).join(', ')}`);
        }

      } catch (error) {
        console.error(`💥 Run ${run}/${runs} failed:`, error.message);
        results.push({
          run,
          passed: 0,
          failed: 0,
          total: 0,
          failures: [],
          error: error.message,
        });
      }

      // Brief pause between runs to allow system cleanup
      if (run < runs) {
        console.log('⏳ Waiting 5 seconds before next run...');
        await this.delay(5000);
      }
    }

    const analysis = this.analyzeResults(results);
    this.generateReport(analysis, outputDir);

    return analysis;
  }

  async runSingleTest(testPattern, runNumber, timeout) {
    return new Promise((resolve, reject) => {
      const jestCommand = `npm run test:e2e -- --testPathPattern="${testPattern}" --testNamePattern="${testPattern}" --verbose --forceExit`;

      const child = spawn('bash', ['-c', jestCommand], {
        stdio: ['inherit', 'pipe', 'pipe'],
        env: {
          ...process.env,
          JEST_RUN_ID: `run-${runNumber}`,
          CI: 'true', // Enable CI mode for consistent output
        },
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      const timeoutId = setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error(`Test run ${runNumber} timed out after ${timeout}ms`));
      }, timeout);

      child.on('close', (code) => {
        clearTimeout(timeoutId);

        try {
          const result = this.parseJestOutput(stdout, stderr, code);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });

      child.on('error', (error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
    });
  }

  parseJestOutput(stdout, stderr, exitCode) {
    // Parse Jest JSON output if available, otherwise parse text output
    try {
      // Look for JSON output in stdout
      const jsonMatch = stdout.match(/{[\s\S]*}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        return {
          passed: result.numPassedTests || 0,
          failed: result.numFailedTests || 0,
          total: result.numTotalTests || 0,
          failures: result.testResults?.flatMap(tr =>
            tr.assertionResults?.filter(ar => ar.status === 'failed').map(ar => ({
              title: ar.title,
              file: tr.testFilePath,
              error: ar.failureMessages?.[0],
            })) || []
          ) || [],
        };
      }
    } catch (error) {
      // Fall back to text parsing
    }

    // Simple text parsing as fallback
    const passed = (stdout.match(/✓/g) || []).length;
    const failed = (stdout.match(/✗/g) || []).length;
    const total = passed + failed;

    return {
      passed,
      failed,
      total,
      failures: [], // Would need more complex parsing for detailed failures
    };
  }

  analyzeResults(results) {
    const totalRuns = results.length;
    const successfulRuns = results.filter(r => r.failed === 0).length;
    const successRate = successfulRuns / totalRuns;

    // Analyze individual test flakiness
    const testFlakiness = new Map();

    results.forEach(run => {
      run.failures?.forEach(failure => {
        const key = `${failure.file}:${failure.title}`;
        const existing = testFlakiness.get(key) || {
          test: failure.title,
          file: failure.file,
          failures: 0,
          runs: 0,
        };
        existing.failures += 1;
        existing.runs += 1;
        testFlakiness.set(key, existing);
      });
    });

    // Calculate flakiness for each test
    const flakyTests = Array.from(testFlakiness.values())
      .map(test => ({
        ...test,
        failureRate: test.failures / totalRuns,
        isFlaky: test.runs >= this.minRuns && (test.failures / totalRuns) >= this.flakinessThreshold,
      }))
      .filter(test => test.isFlaky)
      .sort((a, b) => b.failureRate - a.failureRate);

    return {
      summary: {
        totalRuns,
        successfulRuns,
        successRate,
        flakyTestsCount: flakyTests.length,
      },
      results,
      flakyTests,
    };
  }

  generateReport(analysis, outputDir) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = path.join(outputDir, `e2e-stability-report-${timestamp}.md`);

    let report = '# E2E Test Stability Report\n\n';
    report += `Generated: ${new Date().toISOString()}\n\n`;

    report += '## Summary\n\n';
    report += `- **Total Runs:** ${analysis.summary.totalRuns}\n`;
    report += `- **Successful Runs:** ${analysis.summary.successfulRuns}\n`;
    report += `- **Success Rate:** ${(analysis.summary.successRate * 100).toFixed(1)}%\n`;
    report += `- **Flaky Tests:** ${analysis.summary.flakyTestsCount}\n\n`;

    if (analysis.flakyTests.length > 0) {
      report += '## Flaky Tests\n\n';
      report += '| Test | File | Failure Rate | Failures | Total Runs |\n';
      report += '|------|------|-------------|----------|------------|\n';

      for (const test of analysis.flakyTests) {
        report += `| ${test.test} | ${test.file} | ${(test.failureRate * 100).toFixed(1)}% | ${test.failures} | ${analysis.summary.totalRuns} |\n`;
      }

      report += '\n## Recommendations\n\n';
      report += '### For Each Flaky Test:\n';
      report += '1. **Add explicit waits** before assertions\n';
      report += '2. **Implement retry logic** for network operations\n';
      report += '3. **Check for race conditions** in async operations\n';
      report += '4. **Add database connection stability checks**\n';
      report += '5. **Review timing-dependent operations**\n';
      report += '6. **Consider using test-specific timeouts**\n\n';
    } else {
      report += '## ✅ All Tests Stable\n\n';
      report += 'No flaky tests detected! All tests are running consistently.\n\n';
    }

    report += '## Run Details\n\n';
    analysis.results.forEach((result, index) => {
      report += `### Run ${index + 1}\n`;
      report += `- Passed: ${result.passed}\n`;
      report += `- Failed: ${result.failed}\n`;
      report += `- Total: ${result.total}\n`;
      if (result.error) {
        report += `- Error: ${result.error}\n`;
      }
      if (result.failures?.length > 0) {
        report += `- Failed Tests: ${result.failures.map(f => f.title).join(', ')}\n`;
      }
      report += '\n';
    });

    fs.writeFileSync(reportPath, report);
    console.log(`📊 Stability report saved to: ${reportPath}`);

    return reportPath;
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const options = {};

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--runs':
        options.runs = parseInt(args[++i]);
        break;
      case '--pattern':
        options.testPattern = args[++i];
        break;
      case '--parallel':
        options.parallel = true;
        break;
      case '--output':
        options.outputDir = args[++i];
        break;
      case '--help':
        console.log(`
E2E Test Stability Runner

Usage: node test/utils/e2e-test-runner.js [options]

Options:
  --runs <number>      Number of test runs (default: 5)
  --pattern <pattern>  Test file pattern (default: **/*.e2e-spec.ts)
  --parallel           Run tests in parallel (default: false)
  --output <dir>       Output directory for reports (default: ./test-results)
  --help               Show this help message

Examples:
  node test/utils/e2e-test-runner.js --runs 10
  node test/utils/e2e-test-runner.js --pattern "auth.e2e-spec.ts" --runs 3
        `);
        process.exit(0);
    }
  }

  const runner = new E2ETestRunner();

  try {
    const analysis = await runner.runStabilityTest(options);

    if (analysis.summary.successRate < 0.9) {
      console.error(`❌ Test stability is poor: ${(analysis.summary.successRate * 100).toFixed(1)}% success rate`);
      process.exit(1);
    } else if (analysis.summary.flakyTestsCount > 0) {
      console.warn(`⚠️  Found ${analysis.summary.flakyTestsCount} flaky tests`);
      process.exit(1);
    } else {
      console.log(`✅ All tests are stable: ${(analysis.summary.successRate * 100).toFixed(1)}% success rate`);
    }
  } catch (error) {
    console.error('💥 Stability test failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = E2ETestRunner;