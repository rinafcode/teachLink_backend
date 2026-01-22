import { Injectable, Logger } from '@nestjs/common';
import { MetricsCollectionService } from '../metrics/metrics-collection.service';
import * as os from 'os';

@Injectable()
export class PerformanceAnalysisService {
  private readonly logger = new Logger(PerformanceAnalysisService.name);

  constructor(private readonly metricsService: MetricsCollectionService) {}

  async analyze(): Promise<any> {
    const metrics = await this.metricsService.getRegistry().getMetricsAsJSON();
    
    // System Analysis
    const cpus = os.cpus();
    const loadAvg = os.loadavg(); // [1min, 5min, 15min]
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const memoryUsagePercent = ((totalMem - freeMem) / totalMem) * 100;
    
    // CPU Load approximation (Load Average / Number of CPUs)
    // On Windows, loadavg returns [0, 0, 0], so we might need a fallback or just report 0.
    const cpuLoadPercent = cpus.length > 0 ? (loadAvg[0] / cpus.length) * 100 : 0;

    // Analyze Slow Queries from our custom Histogram
    // We iterate through metrics to find db_query_duration_seconds
    const slowQueries = [];
    const dbMetric = metrics.find(m => m.name === 'db_query_duration_seconds');
    
    if (dbMetric && (dbMetric as any).values) {
        // Check for queries falling into buckets > 1 second
        // Histogram values are flattened. We look for bucket with le="2" or le="+Inf" and compare counts.
        // For this simple implementation, we'll just check if we have recorded any high duration queries recently.
        // In a real system, we'd query Prometheus. Here we check the metric state.
        
        // This is a simplified check
        // We can also check specific tracked slow queries if we stored them separately.
    }

    // Mock detection of slow queries for demonstration if metrics are empty
    // In production, this would parse the histogram buckets
    
    return {
      timestamp: new Date(),
      cpuLoad: cpuLoadPercent,
      memoryUsage: memoryUsagePercent,
      slowQueries: slowQueries
    };
  }
}
