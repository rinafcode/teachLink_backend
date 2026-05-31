import { Injectable } from '@nestjs/common';

export interface ComplianceReport {
  generatedAt: string;
  period: { from: string; to: string };
  totalTransactions: number;
  flaggedTransactions: number;
  complianceRate: number;
}

@Injectable()
export class ComplianceReportService {
  /**
   * Generates a compliance summary report for the given period.
   */
  generate(
    from: Date,
    to: Date,
    totalTransactions: number,
    flaggedTransactions: number,
  ): ComplianceReport {
    const complianceRate =
      totalTransactions > 0
        ? parseFloat((((totalTransactions - flaggedTransactions) / totalTransactions) * 100).toFixed(2))
        : 100;

    return {
      generatedAt: new Date().toISOString(),
      period: { from: from.toISOString(), to: to.toISOString() },
      totalTransactions,
      flaggedTransactions,
      complianceRate,
    };
  }
}