import {
  expectNotFound,
  expectSuccess,
  expectUnauthorized,
  expectValidationFailure,
} from './http-outcome-assertions';

type ScenarioCallbacks = {
  success: () => Promise<unknown>;
  validationFailure: () => Promise<unknown>;
  notFound: () => Promise<unknown>;
  unauthorized: () => Promise<unknown>;
};

export function runStandardHttpScenarios(suiteName: string, scenarios: ScenarioCallbacks) {
  describe(suiteName, () => {
    it('handles success scenarios', async () => {
      await expectSuccess(scenarios.success);
    });

    it('handles validation failures', async () => {
      await expectValidationFailure(scenarios.validationFailure);
    });

    it('handles not found cases', async () => {
      await expectNotFound(scenarios.notFound);
    });

    it('handles unauthorized access', async () => {
      await expectUnauthorized(scenarios.unauthorized);
    });
  });
}
