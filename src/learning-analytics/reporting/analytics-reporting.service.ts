import { Injectable } from '@nestjs/common';

@Injectable()
export class AnalyticsReportingService {
  generateReport() {
    return {
      totalLearners: 128,
      averageScore: 72,
      topContentType: 'video',
      averageEngagementRate: '88%',
    };
  }
}
