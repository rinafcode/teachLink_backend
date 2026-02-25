import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class OptimizationService {
  private readonly logger = new Logger(OptimizationService.name);

  getOptimizationRecommendations(analysisResult: any): string[] {
    const recommendations: string[] = [];

    if (analysisResult.cpuLoad && analysisResult.cpuLoad > 80) {
      recommendations.push('High CPU usage detected. Consider horizontal scaling or optimizing CPU-intensive tasks.');
    }

    if (analysisResult.memoryUsage && analysisResult.memoryUsage > 85) {
      recommendations.push('High Memory usage detected. Check for memory leaks or increase heap size.');
    }

    if (analysisResult.slowQueries && analysisResult.slowQueries.length > 0) {
      recommendations.push(`Detected ${analysisResult.slowQueries.length} slow database queries. Consider adding indexes or optimizing query structure.`);
      analysisResult.slowQueries.forEach((query: any) => {
          recommendations.push(`- Optimize query on table '${query.table}' (Avg duration: ${query.duration}s)`);
      });
    }

    return recommendations;
  }
}
