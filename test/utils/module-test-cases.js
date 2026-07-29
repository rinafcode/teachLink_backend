'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.runStandardHttpScenarios = runStandardHttpScenarios;
const http_outcome_assertions_1 = require('./http-outcome-assertions');
function runStandardHttpScenarios(suiteName, scenarios) {
  describe(suiteName, () => {
    it('handles success scenarios', async () => {
      await (0, http_outcome_assertions_1.expectSuccess)(scenarios.success);
    });
    it('handles validation failures', async () => {
      await (0, http_outcome_assertions_1.expectValidationFailure)(scenarios.validationFailure);
    });
    it('handles not found cases', async () => {
      await (0, http_outcome_assertions_1.expectNotFound)(scenarios.notFound);
    });
    it('handles unauthorized access', async () => {
      await (0, http_outcome_assertions_1.expectUnauthorized)(scenarios.unauthorized);
    });
  });
}
//# sourceMappingURL=module-test-cases.js.map
