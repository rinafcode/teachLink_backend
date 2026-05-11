"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const metrics_collection_service_1 = require("../../src/monitoring/metrics/metrics-collection.service");
const analytics_service_1 = require("../../src/analytics/analytics.service");
describe('AnalyticsService', () => {
    let metrics;
    let svc;
    beforeEach(() => {
        metrics = new metrics_collection_service_1.MetricsCollectionService();
        svc = new analytics_service_1.AnalyticsService(metrics);
    });
    it('should record an event (no throw)', () => {
        expect(() => svc.recordEvent('feature', 'clicked')).not.toThrow();
    });
});
//# sourceMappingURL=analytics.service.spec.js.map