'use strict';
var __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (!desc || ('get' in desc ? !m.__esModule : desc.writable || desc.configurable)) {
          desc = {
            enumerable: true,
            get: function () {
              return m[k];
            },
          };
        }
        Object.defineProperty(o, k2, desc);
      }
    : function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
      });
var __setModuleDefault =
  (this && this.__setModuleDefault) ||
  (Object.create
    ? function (o, v) {
        Object.defineProperty(o, 'default', { enumerable: true, value: v });
      }
    : function (o, v) {
        o['default'] = v;
      });
var __importStar =
  (this && this.__importStar) ||
  (function () {
    var ownKeys = function (o) {
      ownKeys =
        Object.getOwnPropertyNames ||
        function (o) {
          var ar = [];
          for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
          return ar;
        };
      return ownKeys(o);
    };
    return function (mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null)
        for (var k = ownKeys(mod), i = 0; i < k.length; i++)
          if (k[i] !== 'default') __createBinding(result, mod, k[i]);
      __setModuleDefault(result, mod);
      return result;
    };
  })();
Object.defineProperty(exports, '__esModule', { value: true });
exports.FlakinessReporter = exports.flakyTestDetector = exports.FlakyTestDetector = void 0;
const fs = __importStar(require('fs'));
const path = __importStar(require('path'));
class FlakyTestDetector {
  constructor() {
    this.testResults = new Map();
    this.failureThreshold = 0.1;
    this.minRunsThreshold = 3;
  }
  recordTestResult(testResult, testPath) {
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
  getFlakyTests() {
    return Array.from(this.testResults.values())
      .filter((result) => result.isCurrentlyFlaky)
      .sort((a, b) => b.failureRate - a.failureRate);
  }
  getTestSummary() {
    const allResults = Array.from(this.testResults.values());
    const totalTests = allResults.length;
    const flakyTests = allResults.filter((r) => r.isCurrentlyFlaky).length;
    const totalFailures = allResults.reduce((sum, r) => sum + r.failureCount, 0);
    const totalRuns = allResults.reduce((sum, r) => sum + r.totalRuns, 0);
    const failureRate = totalRuns > 0 ? totalFailures / totalRuns : 0;
    return { totalTests, flakyTests, failureRate };
  }
  generateReport() {
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
  reset() {
    this.testResults.clear();
  }
}
exports.FlakyTestDetector = FlakyTestDetector;
exports.flakyTestDetector = new FlakyTestDetector();
class FlakinessReporter {
  onTestResult(test, testResult, aggregatedResult) {
    for (const result of testResult.testResults) {
      exports.flakyTestDetector.recordTestResult(result, test.path);
    }
  }
  onRunComplete(test, results) {
    const report = exports.flakyTestDetector.generateReport();
    console.log(`\n${'='.repeat(80)}`);
    console.log('E2E FLAKINESS REPORT');
    console.log('='.repeat(80));
    console.log(report);
    const flakyTests = exports.flakyTestDetector.getFlakyTests();
    if (flakyTests.length > 0) {
      const reportPath = path.join(process.cwd(), 'test-flakiness-report.md');
      fs.writeFileSync(reportPath, report);
      console.log(`\n📊 Detailed report saved to: ${reportPath}`);
    }
  }
}
exports.FlakinessReporter = FlakinessReporter;
//# sourceMappingURL=flaky-test-detector.js.map
