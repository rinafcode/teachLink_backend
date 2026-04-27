import { TestResult } from '@jest/types';

export interface FlakyTestResult {
  testName: string;
  filePath: string;
  failureCount: number;
  totalRuns: number;
  failureRate: number;
  lastFailure?: {
    message: string;
    stack?: string;
  };
  isCurrentlyFlaky: boolean;
}

export class FlakyTestDetector {
  private testResults: Map<string, FlakyTestResult> = new Map();
  private readonly failureThreshold = 0.1; // 10% failure rate
  private readonly minRunsThreshold = 3; // Need at least 3 runs to detect flakiness

  recordTestResult(testResult: TestResult.AssertionResult, testPath: string): void {
    const testKey = `${testPath}:${testResult.title}`;

    const existing = this.testResults.get(testKey) || {
      testName: testResult.title,
      filePath: testPath,
      failureCount: 0,
      totalRuns: 0,
      failureRate: 0,
      isCurrentlyFlaky: false,
    };

    existing.totalRuns += 1;

    if (testResult.status === 'failed') {
      existing.failureCount += 1;
      existing.lastFailure = {
        message: testResult.failureMessages?.[0] || 'Unknown failure',
        stack: testResult.failureMessages?.[1],
      };
    }

    existing.failureRate = existing.failureCount / existing.totalRuns;
    existing.isCurrentlyFlaky =
      existing.totalRuns >= this.minRunsThreshold && existing.failureRate >= this.failureThreshold;

    this.testResults.set(testKey, existing);
  }

  getFlakyTests(): FlakyTestResult[] {
    return Array.from(this.testResults.values())
      .filter((result) => result.isCurrentlyFlaky)
      .sort((a, b) => b.failureRate - a.failureRate);
  }

  getTestSummary(): { totalTests: number; flakyTests: number; failureRate: number } {
    const allResults = Array.from(this.testResults.values());
    const totalTests = allResults.length;
    const flakyTests = allResults.filter((r) => r.isCurrentlyFlaky).length;
    const totalFailures = allResults.reduce((sum, r) => sum + r.failureCount, 0);
    const totalRuns = allResults.reduce((sum, r) => sum + r.totalRuns, 0);
    const failureRate = totalRuns > 0 ? totalFailures / totalRuns : 0;

    return { totalTests, flakyTests, failureRate };
  }

  generateReport(): string {
    const flakyTests = this.getFlakyTests();
    const summary = this.getTestSummary();

    let report = '# E2E Test Flakiness Report\n\n';
    report += '## Summary\n';
    report += `- Total Tests: ${summary.totalTests}\n`;
    report += `- Flaky Tests: ${summary.flakyTests}\n`;
    report += `- Overall Failure Rate: ${(summary.failureRate * 100).toFixed(2)}%\n\n`;

    if (flakyTests.length > 0) {
      report += '## Flaky Tests\n\n';
      report += '| Test | File | Failure Rate | Failures | Total Runs |\n';
      report += '|------|------|-------------|----------|------------|\n';

      for (const test of flakyTests) {
        report += `| ${test.testName} | ${test.filePath} | ${(test.failureRate * 100).toFixed(1)}% | ${test.failureCount} | ${test.totalRuns} |\n`;
      }

      report += '\n## Recommendations\n\n';
      for (const test of flakyTests) {
        report += `### ${test.testName}\n`;
        report += `- **File:** ${test.filePath}\n`;
        report += `- **Failure Rate:** ${(test.failureRate * 100).toFixed(1)}%\n`;
        if (test.lastFailure) {
          report += `- **Last Failure:** ${test.lastFailure.message}\n`;
        }
        report += '- **Suggestions:**\n';
        report += '  - Add explicit waits before assertions\n';
        report += '  - Implement retry logic for network calls\n';
        report += '  - Check for race conditions\n';
        report += '  - Add database connection stability checks\n';
        report += '  - Review async operations timing\n\n';
      }
    } else {
      report += '## ✅ No Flaky Tests Detected\n\n';
      report += 'All tests are running consistently!\n';
    }

    return report;
  }

  reset(): void {
    this.testResults.clear();
  }
}

// Global instance for test suites
export const flakyTestDetector = new FlakyTestDetector();

// Jest reporter for flakiness detection
export class FlakinessReporter {
  onTestResult(test, testResult, aggregatedResult) {
    for (const result of testResult.testResults) {
      flakyTestDetector.recordTestResult(result, test.path);
    }
  }

  onRunComplete(test, results) {
    const report = flakyTestDetector.generateReport();
    console.log(`\n${'='.repeat(80)}`);
    console.log('E2E FLAKINESS REPORT');
    console.log('='.repeat(80));
    console.log(report);

    // Write report to file if there are flaky tests
    const flakyTests = flakyTestDetector.getFlakyTests();
    if (flakyTests.length > 0) {
      const fs = require('fs');
      const path = require('path');
      const reportPath = path.join(process.cwd(), 'test-flakiness-report.md');
      fs.writeFileSync(reportPath, report);
      console.log(`\n📊 Detailed report saved to: ${reportPath}`);
    }
  }
}
