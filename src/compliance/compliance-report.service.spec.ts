import { ComplianceReportService } from './compliance-report.service';

describe('ComplianceReportService', () => {
  let service: ComplianceReportService;

  beforeEach(() => {
    service = new ComplianceReportService();
  });

  it('generates a compliance report with a computed rate', () => {
    const from = new Date('2026-01-01T00:00:00.000Z');
    const to = new Date('2026-01-31T23:59:59.000Z');

    const result = service.generate(from, to, 200, 50);

    expect(result.period).toEqual({
      from: from.toISOString(),
      to: to.toISOString(),
    });
    expect(result.complianceRate).toBe(75);
  });

  it('defaults to 100 percent when there are no transactions', () => {
    const result = service.generate(
      new Date('2026-01-01T00:00:00.000Z'),
      new Date('2026-01-02T00:00:00.000Z'),
      0,
      0,
    );

    expect(result.complianceRate).toBe(100);
  });
});
