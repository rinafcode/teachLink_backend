import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Experiment } from '../entities/experiment.entity';
import { ExperimentVariant } from '../entities/experiment-variant.entity';
import { StatisticalAnalysisService } from '../analysis/statistical-analysis.service';
import { AutomatedDecisionService } from '../automation/automated-decision.service';
import { ExperimentStatus, ExperimentType } from '../entities/experiment.entity';

export interface ReportFilters {
  status?: ExperimentStatus;
  type?: ExperimentType;
  startDate?: Date;
  endDate?: Date;
  includeArchived?: boolean;
}

@Injectable()
export class ABTestingReportsService {
  private readonly logger = new Logger(ABTestingReportsService.name);

  constructor(
    @InjectRepository(Experiment)
    private experimentRepository: Repository<Experiment>,
    @InjectRepository(ExperimentVariant)
    private variantRepository: Repository<ExperimentVariant>,
    private statisticalAnalysisService: StatisticalAnalysisService,
    private automatedDecisionService: AutomatedDecisionService,
  ) {}

  /**
   * Generates comprehensive experiment report
   */
  async generateExperimentReport(experimentId: string): Promise<any> {
    this.logger.log(`Generating report for experiment: ${experimentId}`);

    const experiment = await this.experimentRepository.findOne({
      where: { id: experimentId },
      relations: ['variants', 'metrics', 'variants.metrics'],
    });

    if (!experiment) {
      throw new Error(`Experiment with ID ${experimentId} not found`);
    }

    const statisticalAnalysis = await this.statisticalAnalysisService.calculateStatisticalSignificance(experimentId);
    const decisionRecommendations = await this.automatedDecisionService.getDecisionRecommendations(experimentId);

    const report = {
      experiment: {
        id: experiment.id,
        name: experiment.name,
        description: experiment.description,
        type: experiment.type,
        status: experiment.status,
        startDate: experiment.startDate,
        endDate: experiment.endDate,
        duration: this.calculateExperimentDuration(experiment),
        hypothesis: experiment.hypothesis,
        confidenceLevel: experiment.confidenceLevel,
        minimumSampleSize: experiment.minimumSampleSize,
        trafficAllocation: experiment.trafficAllocation,
      },
      variants: experiment.variants.map(variant => ({
        id: variant.id,
        name: variant.name,
        description: variant.description,
        isControl: variant.isControl,
        isWinner: variant.isWinner,
        trafficAllocation: variant.trafficAllocation,
        configuration: variant.configuration,
        metrics: variant.metrics.map(metric => ({
          id: metric.id,
          value: metric.value,
          sampleSize: metric.sampleSize,
          conversionRate: metric.conversionRate,
          standardDeviation: metric.standardDeviation,
          confidenceInterval: [
            metric.confidenceIntervalLower,
            metric.confidenceIntervalUpper
          ],
          pValue: metric.pValue,
          isStatisticallySignificant: metric.isStatisticallySignificant,
        })),
      })),
      statisticalAnalysis: statisticalAnalysis,
      decisionRecommendations: decisionRecommendations,
      summary: this.generateSummary(experiment, statisticalAnalysis),
    };

    return report;
  }

  /**
   * Generates summary statistics for the experiment
   */
  private generateSummary(experiment: Experiment, statisticalAnalysis: any): any {
    const controlVariant = experiment.variants.find(v => v.isControl);
    const winnerVariant = experiment.variants.find(v => v.isWinner);

    return {
      totalVariants: experiment.variants.length,
      controlVariant: controlVariant ? controlVariant.name : null,
      winner: winnerVariant ? winnerVariant.name : null,
      isStatisticallySignificant: statisticalAnalysis.statisticallySignificant,
      duration: this.calculateExperimentDuration(experiment),
      status: experiment.status,
      recommendations: statisticalAnalysis.statisticallySignificant 
        ? 'Statistically significant results found' 
        : 'Continue running experiment for more data',
    };
  }

  /**
   * Gets dashboard summary of all experiments
   */
  async getDashboardSummary(filters?: ReportFilters): Promise<any> {
    this.logger.log('Generating dashboard summary');

    const experiments = await this.getFilteredExperiments(filters);

    const summary = {
      totalExperiments: experiments.length,
      experimentsByStatus: this.groupExperimentsByStatus(experiments),
      experimentsByType: this.groupExperimentsByType(experiments),
      runningExperiments: experiments.filter(e => e.status === ExperimentStatus.RUNNING).length,
      completedExperiments: experiments.filter(e => e.status === ExperimentStatus.COMPLETED).length,
      recentExperiments: experiments.slice(0, 5), // Last 5 experiments
      upcomingExperiments: experiments.filter(e => 
        e.status === ExperimentStatus.DRAFT && e.startDate > new Date()
      ).slice(0, 5),
    };

    return summary;
  }

  /**
   * Gets filtered experiments based on criteria
   */
  private async getFilteredExperiments(filters?: ReportFilters): Promise<Experiment[]> {
    const queryBuilder = this.experimentRepository.createQueryBuilder('experiment');
    
    if (filters?.status) {
      queryBuilder.andWhere('experiment.status = :status', { status: filters.status });
    }

    if (filters?.type) {
      queryBuilder.andWhere('experiment.type = :type', { type: filters.type });
    }

    if (filters?.startDate) {
      queryBuilder.andWhere('experiment.startDate >= :startDate', { startDate: filters.startDate });
    }

    if (filters?.endDate) {
      queryBuilder.andWhere('experiment.startDate <= :endDate', { endDate: filters.endDate });
    }

    if (!filters?.includeArchived) {
      queryBuilder.andWhere('experiment.status != :archived', { archived: ExperimentStatus.ARCHIVED });
    }

    queryBuilder.orderBy('experiment.createdAt', 'DESC');
    
    return await queryBuilder.getMany();
  }

  /**
   * Groups experiments by status
   */
  private groupExperimentsByStatus(experiments: Experiment[]): Record<string, number> {
    const statusGroups: Record<string, number> = {};
    
    for (const experiment of experiments) {
      const status = experiment.status;
      statusGroups[status] = (statusGroups[status] || 0) + 1;
    }

    return statusGroups;
  }

  /**
   * Groups experiments by type
   */
  private groupExperimentsByType(experiments: Experiment[]): Record<string, number> {
    const typeGroups: Record<string, number> = {};
    
    for (const experiment of experiments) {
      const type = experiment.type;
      typeGroups[type] = (typeGroups[type] || 0) + 1;
    }

    return typeGroups;
  }

  /**
   * Calculates experiment duration in days
   */
  private calculateExperimentDuration(experiment: Experiment): number {
    const startDate = new Date(experiment.startDate);
    const endDate = experiment.endDate ? new Date(experiment.endDate) : new Date();
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Generates performance comparison report
   */
  async generatePerformanceComparisonReport(): Promise<any> {
    this.logger.log('Generating performance comparison report');

    const experiments = await this.experimentRepository.find({
      where: { status: ExperimentStatus.COMPLETED },
      relations: ['variants'],
      order: { createdAt: 'DESC' },
      take: 20,
    });

    const performanceData = [];

    for (const experiment of experiments) {
      const winner = experiment.variants.find(v => v.isWinner);
      const control = experiment.variants.find(v => v.isControl);
      
      if (winner && control && winner.id !== control.id) {
        const improvement = await this.calculateImprovementPercentage(experiment.id, winner.id, control.id);
        
        performanceData.push({
          experimentId: experiment.id,
          experimentName: experiment.name,
          experimentType: experiment.type,
          winnerVariant: winner.name,
          controlVariant: control.name,
          improvementPercentage: improvement,
          duration: this.calculateExperimentDuration(experiment),
          confidenceLevel: experiment.confidenceLevel,
        });
      }
    }

    return {
      reportTitle: 'Performance Comparison Report',
      generatedAt: new Date(),
      totalComparisons: performanceData.length,
      averageImprovement: performanceData.length > 0 
        ? performanceData.reduce((sum, data) => sum + data.improvementPercentage, 0) / performanceData.length
        : 0,
      bestPerforming: performanceData.length > 0 
        ? [...performanceData].sort((a, b) => b.improvementPercentage - a.improvementPercentage)[0]
        : null,
      performanceData: performanceData,
    };
  }

  /**
   * Calculates improvement percentage between winner and control
   */
  private async calculateImprovementPercentage(
    experimentId: string,
    winnerId: string,
    controlId: string
  ): Promise<number> {
    // This would fetch actual metric data and calculate improvement
    // For now, returning a placeholder value
    return 15.5; // 15.5% improvement
  }

  /**
   * Exports experiment data in CSV format
   */
  async exportExperimentData(experimentId: string): Promise<string> {
    this.logger.log(`Exporting data for experiment: ${experimentId}`);

    const report = await this.generateExperimentReport(experimentId);
    
    // Convert report to CSV format
    let csv = 'Metric,Variant,Value,Sample Size,Conversion Rate,Confidence Interval,P-Value,Statistically Significant\n';
    
    for (const variant of report.variants) {
      for (const metric of variant.metrics) {
        csv += `${metric.id},${variant.name},${metric.value},${metric.sampleSize},${metric.conversionRate || ''},`;
        csv += `"${metric.confidenceInterval ? `[${metric.confidenceInterval[0]}, ${metric.confidenceInterval[1]}]` : ''}",`;
        csv += `${metric.pValue || ''},${metric.isStatisticallySignificant}\n`;
      }
    }

    return csv;
  }

  /**
   * Gets experiment timeline data
   */
  async getExperimentTimeline(): Promise<any> {
    const experiments = await this.experimentRepository.find({
      order: { startDate: 'ASC' },
    });

    const timeline = experiments.map(experiment => ({
      id: experiment.id,
      name: experiment.name,
      startDate: experiment.startDate,
      endDate: experiment.endDate || new Date(),
      status: experiment.status,
      type: experiment.type,
      duration: this.calculateExperimentDuration(experiment),
    }));

    return {
      timeline: timeline,
      totalExperiments: timeline.length,
      startDate: timeline.length > 0 ? timeline[0].startDate : null,
      endDate: timeline.length > 0 ? timeline[timeline.length - 1].endDate : null,
    };
  }
}