/* eslint-disable prettier/prettier */
import { Injectable } from '@nestjs/common';
import { EventTrackingService } from '../events/event-tracking.service';

@Injectable()
export class ReportGenerationService {
  constructor(private readonly eventTrackingService: EventTrackingService) {}

  // Generate different types of reports
  async generateReport(type: string, format: string = 'json'): Promise<any> {
    let reportData;

    switch (type) {
      case 'user-engagement':
        reportData = await this.generateUserEngagementReport();
        break;
      case 'course-performance':
        reportData = await this.generateCoursePerformanceReport();
        break;
      default:
        throw new Error(`Report type ${type} not supported`);
    }

    // Export data in requested format
    if (format === 'csv') {
      return this.convertToCSV(reportData);
    }

    return reportData;
  }

  private async generateUserEngagementReport() {
    // Example aggregation: count of events per event type
    const events = await this.eventTrackingService.getEvents();
    const counts = events.reduce((acc, event) => {
      acc[event.eventType] = (acc[event.eventType] || 0) + 1;
      return acc;
    }, {});

    return counts;
  }

  private async generateCoursePerformanceReport() {
    // Example stub: can be extended to real logic
    const events = await this.eventTrackingService.getEvents({
      eventType: 'course-completion',
    });
    // Return count of completions per courseId
    const courseCounts = events.reduce((acc, event) => {
      if (event.courseId) {
        acc[event.courseId] = (acc[event.courseId] || 0) + 1;
      }
      return acc;
    }, {});

    return courseCounts;
  }

  private convertToCSV(data: Record<string, any>): string {
    const keys = Object.keys(data);
    const values = keys.map((k) => data[k]);

    // Simple CSV with two columns: key, value
    const csv = ['Key,Value', ...keys.map((k, i) => `${k},${values[i]}`)].join(
      '\n',
    );
    return csv;
  }
}
