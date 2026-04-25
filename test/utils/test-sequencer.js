const Sequencer = require('@jest/test-sequencer').default;

class CustomTestSequencer extends Sequencer {
  sort(tests) {
    // Sort tests to run more stable tests first
    const testOrder = [
      // Health checks and basic connectivity first
      /health/i,
      /connect/i,
      /basic/i,

      // Authentication tests next
      /auth/i,
      /login/i,
      /register/i,

      // Core functionality
      /user/i,
      /profile/i,

      // Complex business logic
      /assessment/i,
      /course/i,
      /learning/i,

      // Background jobs and async operations last
      /queue/i,
      /job/i,
      /async/i,
      /background/i,
    ];

    return tests.sort((a, b) => {
      const aPath = a.path.toLowerCase();
      const bPath = b.path.toLowerCase();

      // Find order for test a
      let aOrder = testOrder.length;
      for (let i = 0; i < testOrder.length; i++) {
        if (testOrder[i].test(aPath)) {
          aOrder = i;
          break;
        }
      }

      // Find order for test b
      let bOrder = testOrder.length;
      for (let i = 0; i < testOrder.length; i++) {
        if (testOrder[i].test(bPath)) {
          bOrder = i;
          break;
        }
      }

      // Sort by order, then by path for consistent ordering
      if (aOrder !== bOrder) {
        return aOrder - bOrder;
      }

      return aPath.localeCompare(bPath);
    });
  }
}

module.exports = CustomTestSequencer;