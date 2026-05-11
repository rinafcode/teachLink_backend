"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const metrics_collection_service_1 = require("../../src/monitoring/metrics/metrics-collection.service");
const cost_tracking_service_1 = require("../../src/monitoring/cost-tracking.service");
describe('CostTrackingService', () => {
    let metrics;
    let svc;
    beforeEach(() => {
        metrics = new metrics_collection_service_1.MetricsCollectionService();
        svc = new cost_tracking_service_1.CostTrackingService(metrics);
    });
    it('should maintain rolling 24h window and evaluate budget', () => {
        for (let i = 0; i < 25; i++) {
            svc.recordHourlyCost(2);
        }
        expect(svc.getLast24hCost()).toBeCloseTo(48);
        expect(svc.evaluateBudget(40)).toBe(true);
        expect(svc.evaluateBudget(100)).toBe(false);
    });
});
//# sourceMappingURL=cost-tracking.service.spec.js.map