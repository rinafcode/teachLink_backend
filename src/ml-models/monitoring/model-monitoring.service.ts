import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ModelPerformance } from '../entities/model-performance.entity';
import { PerformanceMetricType, DriftSeverity } from '../enums';
import { MLModel } from '../entities/ml-model.entity';
import { ModelDeployment } from '../entities/model-deployment.entity';
import * as crypto from 'crypto';

@Injectable()
export class ModelMonitoringService {
  constructor(
    @InjectRepository(ModelPerformance)
    private readonly performanceRepository: Repository<ModelPerformance>,
    @InjectRepository(MLModel)
    private readonly modelRepository: Repository<MLModel>,
    @InjectRepository(ModelDeployment)
    private readonly deploymentRepository: Repository<ModelDeployment>,
  ) {}

  async recordPerformance(
    modelId: string,
    metricName: string,
    metricType: PerformanceMetricType,
    value: number,
    context?: Record<string, any>,
  ): Promise<ModelPerformance> {
    const model = await this.modelRepository.findOne({ where: { id: modelId } });
    if (!model) {
      throw new NotFoundException(`Model with ID ${modelId} not found`);
    }

    const performance = this.performanceRepository.create({
      modelId,
      metricName,
      metricType,
      value,
      context,
      recordedAt: new Date(),
    });

    return await this.performanceRepository.save(performance);
  }

  async monitorModelPerformance(modelId: string): Promise<any> {
    const model = await this.modelRepository.findOne({
      where: { id: modelId },
      relations: ['performances'],
    });

    if (!model) {
      throw new NotFoundException(`Model with ID ${modelId} not found`);
    }

    // Get recent performance metrics
    const recentMetrics = await this.getRecentMetrics(modelId, 24); // Last 24 hours

    // Calculate drift scores
    const driftAnalysis = await this.calculateDriftScores(model, recentMetrics);

    // Check for anomalies
    const anomalyDetection = await this.detectAnomalies(recentMetrics);

    // Generate performance summary
    const performanceSummary = this.generatePerformanceSummary(recentMetrics);

    return {
      modelId,
      timestamp: new Date(),
      driftAnalysis,
      anomalyDetection,
      performanceSummary,
      recommendations: this.generateRecommendations(driftAnalysis, anomalyDetection),
    };
  }

  async detectModelDrift(modelId: string, baselineData: any[], currentData: any[]): Promise<any> {
    const model = await this.modelRepository.findOne({ where: { id: modelId } });
    if (!model) {
      throw new NotFoundException(`Model with ID ${modelId} not found`);
    }

    // Calculate statistical drift metrics
    const driftMetrics = this.calculateStatisticalDrift(baselineData, currentData);

    // Calculate feature drift
    const featureDrift = this.calculateFeatureDrift(baselineData, currentData, model.features);

    // Calculate prediction drift
    const predictionDrift = this.calculatePredictionDrift(baselineData, currentData);

    // Determine overall drift severity
    const driftSeverity = this.determineDriftSeverity(driftMetrics, featureDrift, predictionDrift);

    // Record drift metrics
    await this.recordDriftMetrics(modelId, driftMetrics, featureDrift, predictionDrift, driftSeverity);

    return {
      modelId,
      timestamp: new Date(),
      driftSeverity,
      driftMetrics,
      featureDrift,
      predictionDrift,
      recommendations: this.generateDriftRecommendations(driftSeverity, driftMetrics),
    };
  }

  async getPerformanceHistory(
    modelId: string,
    metricType?: PerformanceMetricType,
    days: number = 30,
  ): Promise<ModelPerformance[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const query = this.performanceRepository.createQueryBuilder('performance')
      .where('performance.modelId = :modelId', { modelId })
      .andWhere('performance.recordedAt >= :startDate', { startDate })
      .orderBy('performance.recordedAt', 'ASC');

    if (metricType) {
      query.andWhere('performance.metricType = :metricType', { metricType });
    }

    return await query.getMany();
  }

  async getPerformanceMetrics(
    modelId: string,
    timeRange: string = '24h',
  ): Promise<any> {
    const endDate = new Date();
    let startDate: Date;

    switch (timeRange) {
      case '1h':
        startDate = new Date(endDate.getTime() - 60 * 60 * 1000);
        break;
      case '6h':
        startDate = new Date(endDate.getTime() - 6 * 60 * 60 * 1000);
        break;
      case '24h':
        startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);
    }

    const metrics = await this.performanceRepository.find({
      where: {
        modelId,
        recordedAt: startDate,
      },
      order: { recordedAt: 'ASC' },
    });

    return this.aggregateMetrics(metrics, timeRange);
  }

  async setPerformanceThresholds(
    modelId: string,
    thresholds: Record<string, { min: number; max: number; severity: DriftSeverity }>,
  ): Promise<void> {
    const model = await this.modelRepository.findOne({ where: { id: modelId } });
    if (!model) {
      throw new NotFoundException(`Model with ID ${modelId} not found`);
    }

    // Update model metadata with thresholds
    const metadata = model.metadata || {};
    metadata.performanceThresholds = thresholds;
    model.metadata = metadata;

    await this.modelRepository.save(model);
  }

  async checkPerformanceAlerts(modelId: string): Promise<any[]> {
    const model = await this.modelRepository.findOne({ where: { id: modelId } });
    if (!model) {
      throw new NotFoundException(`Model with ID ${modelId} not found`);
    }

    const thresholds = model.metadata?.performanceThresholds || {};
    const recentMetrics = await this.getRecentMetrics(modelId, 1); // Last hour

    const alerts: any[] = [];

    for (const metric of recentMetrics) {
      const threshold = thresholds[metric.metricName];
      if (threshold) {
        if (metric.value < threshold.min || metric.value > threshold.max) {
          alerts.push({
            modelId,
            metricName: metric.metricName,
            currentValue: metric.value,
            threshold,
            severity: threshold.severity,
            timestamp: metric.recordedAt,
          });
        }
      }
    }

    return alerts;
  }

  async generatePerformanceReport(
    modelId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<any> {
    const model = await this.modelRepository.findOne({ where: { id: modelId } });
    if (!model) {
      throw new NotFoundException(`Model with ID ${modelId} not found`);
    }

    const metrics = await this.performanceRepository.find({
      where: {
        modelId,
        recordedAt: startDate,
      },
      order: { recordedAt: 'ASC' },
    });

    const report = {
      modelId,
      modelName: model.name,
      reportPeriod: { startDate, endDate },
      summary: this.calculateReportSummary(metrics),
      trends: this.analyzeTrends(metrics),
      anomalies: this.detectAnomalies(metrics),
      recommendations: this.generateReportRecommendations(metrics),
    };

    return report;
  }

  private async getRecentMetrics(modelId: string, hours: number): Promise<ModelPerformance[]> {
    const startDate = new Date();
    startDate.setHours(startDate.getHours() - hours);

    return await this.performanceRepository.find({
      where: {
        modelId,
        recordedAt: startDate,
      },
      order: { recordedAt: 'ASC' },
    });
  }

  private async calculateDriftScores(model: MLModel, recentMetrics: ModelPerformance[]): Promise<any> {
    const driftScores: Record<string, number> = {};

    // Calculate drift for each metric type
    for (const metricType of Object.values(PerformanceMetricType)) {
      const metrics = recentMetrics.filter(m => m.metricType === metricType);
      if (metrics.length > 0) {
        const baselineValue = this.getBaselineValue(model, metricType);
        const currentValue = this.calculateAverage(metrics.map(m => m.value));
        driftScores[metricType] = this.calculateDriftScore(baselineValue, currentValue);
      }
    }

    return driftScores;
  }

  private async detectAnomalies(metrics: ModelPerformance[]): Promise<any[]> {
    const anomalies: any[] = [];

    // Group metrics by type
    const metricsByType = this.groupMetricsByType(metrics);

    for (const [metricType, typeMetrics] of Object.entries(metricsByType)) {
      const values = typeMetrics.map(m => m.value);
      const mean = this.calculateMean(values);
      const std = this.calculateStandardDeviation(values, mean);

      // Detect outliers (values beyond 2 standard deviations)
      for (const metric of typeMetrics) {
        const zScore = Math.abs((metric.value - mean) / std);
        if (zScore > 2) {
          anomalies.push({
            metricId: metric.id,
            metricName: metric.metricName,
            metricType: metric.metricType,
            value: metric.value,
            zScore,
            timestamp: metric.recordedAt,
          });
        }
      }
    }

    return anomalies;
  }

  private generatePerformanceSummary(metrics: ModelPerformance[]): any {
    const summary: Record<string, any> = {};

    // Group metrics by type
    const metricsByType = this.groupMetricsByType(metrics);

    for (const [metricType, typeMetrics] of Object.entries(metricsByType)) {
      const values = typeMetrics.map(m => m.value);
      summary[metricType] = {
        count: values.length,
        mean: this.calculateMean(values),
        min: Math.min(...values),
        max: Math.max(...values),
        std: this.calculateStandardDeviation(values, this.calculateMean(values)),
      };
    }

    return summary;
  }

  private calculateStatisticalDrift(baselineData: any[], currentData: any[]): any {
    // Calculate statistical differences between baseline and current data
    const driftMetrics: Record<string, number> = {};

    // Calculate distribution drift using KL divergence or similar
    driftMetrics.distributionDrift = this.calculateDistributionDrift(baselineData, currentData);

    // Calculate mean drift
    const baselineMean = this.calculateMean(baselineData);
    const currentMean = this.calculateMean(currentData);
    driftMetrics.meanDrift = Math.abs(currentMean - baselineMean) / baselineMean;

    // Calculate variance drift
    const baselineVar = this.calculateVariance(baselineData, baselineMean);
    const currentVar = this.calculateVariance(currentData, currentMean);
    driftMetrics.varianceDrift = Math.abs(currentVar - baselineVar) / baselineVar;

    return driftMetrics;
  }

  private calculateFeatureDrift(baselineData: any[], currentData: any[], features: string[]): any {
    const featureDrift: Record<string, number> = {};

    for (const feature of features || []) {
      const baselineValues = baselineData.map(d => d[feature]).filter(v => v !== undefined);
      const currentValues = currentData.map(d => d[feature]).filter(v => v !== undefined);

      if (baselineValues.length > 0 && currentValues.length > 0) {
        featureDrift[feature] = this.calculateFeatureDriftScore(baselineValues, currentValues);
      }
    }

    return featureDrift;
  }

  private calculatePredictionDrift(baselineData: any[], currentData: any[]): number {
    // Calculate drift in model predictions
    const baselinePredictions = baselineData.map(d => d.prediction || d.target);
    const currentPredictions = currentData.map(d => d.prediction || d.target);

    return this.calculateDistributionDrift(baselinePredictions, currentPredictions);
  }

  private determineDriftSeverity(driftMetrics: any, featureDrift: any, predictionDrift: number): DriftSeverity {
    // Determine overall drift severity based on multiple factors
    const maxDrift = Math.max(
      driftMetrics.distributionDrift || 0,
      driftMetrics.meanDrift || 0,
      predictionDrift,
      ...Object.values(featureDrift),
    );

    if (maxDrift > 0.3) return DriftSeverity.CRITICAL;
    if (maxDrift > 0.2) return DriftSeverity.HIGH;
    if (maxDrift > 0.1) return DriftSeverity.MEDIUM;
    if (maxDrift > 0.05) return DriftSeverity.LOW;
    return DriftSeverity.NONE;
  }

  private async recordDriftMetrics(
    modelId: string,
    driftMetrics: any,
    featureDrift: any,
    predictionDrift: number,
    driftSeverity: DriftSeverity,
  ): Promise<void> {
    // Record overall drift score
    await this.recordPerformance(
      modelId,
      'overall_drift',
      PerformanceMetricType.DRIFT_SCORE,
      Math.max(driftMetrics.distributionDrift || 0, predictionDrift),
      { driftSeverity, featureDrift },
    );

    // Record individual drift metrics
    for (const [metric, value] of Object.entries(driftMetrics)) {
      await this.recordPerformance(
        modelId,
        `drift_${metric}`,
        PerformanceMetricType.DRIFT_SCORE,
        value as number,
      );
    }
  }

  private aggregateMetrics(metrics: ModelPerformance[], timeRange: string): any {
    const aggregated: Record<string, any[]> = {};

    for (const metric of metrics) {
      if (!aggregated[metric.metricType]) {
        aggregated[metric.metricType] = [];
      }
      aggregated[metric.metricType].push({
        value: metric.value,
        timestamp: metric.recordedAt,
        metricName: metric.metricName,
      });
    }

    return aggregated;
  }

  private calculateReportSummary(metrics: ModelPerformance[]): any {
    return {
      totalMetrics: metrics.length,
      timeRange: {
        start: metrics[0]?.recordedAt,
        end: metrics[metrics.length - 1]?.recordedAt,
      },
      metricTypes: [...new Set(metrics.map(m => m.metricType))],
      averageValues: this.calculateAverageByType(metrics),
    };
  }

  private analyzeTrends(metrics: ModelPerformance[]): any {
    const trends: Record<string, any> = {};

    const metricsByType = this.groupMetricsByType(metrics);

    for (const [metricType, typeMetrics] of Object.entries(metricsByType)) {
      const values = typeMetrics.map(m => m.value);
      const timestamps = typeMetrics.map(m => m.recordedAt.getTime());

      trends[metricType] = {
        slope: this.calculateLinearRegression(timestamps, values).slope,
        trend: this.determineTrend(values),
        volatility: this.calculateVolatility(values),
      };
    }

    return trends;
  }

  private generateRecommendations(driftAnalysis: any, anomalyDetection: any[]): string[] {
    const recommendations: string[] = [];

    // Drift-based recommendations
    const maxDrift = Math.max(...Object.values(driftAnalysis));
    if (maxDrift > 0.2) {
      recommendations.push('High drift detected. Consider retraining the model.');
    } else if (maxDrift > 0.1) {
      recommendations.push('Moderate drift detected. Monitor closely and prepare for retraining.');
    }

    // Anomaly-based recommendations
    if (anomalyDetection.length > 5) {
      recommendations.push('Multiple anomalies detected. Investigate data quality issues.');
    }

    return recommendations;
  }

  private generateDriftRecommendations(driftSeverity: DriftSeverity, driftMetrics: any): string[] {
    const recommendations: string[] = [];

    switch (driftSeverity) {
      case DriftSeverity.CRITICAL:
        recommendations.push('Critical drift detected. Immediate model retraining required.');
        recommendations.push('Consider rolling back to previous model version.');
        break;
      case DriftSeverity.HIGH:
        recommendations.push('High drift detected. Schedule model retraining soon.');
        recommendations.push('Increase monitoring frequency.');
        break;
      case DriftSeverity.MEDIUM:
        recommendations.push('Medium drift detected. Monitor closely and prepare for retraining.');
        break;
      case DriftSeverity.LOW:
        recommendations.push('Low drift detected. Continue monitoring.');
        break;
    }

    return recommendations;
  }

  private generateReportRecommendations(metrics: ModelPerformance[]): string[] {
    const recommendations: string[] = [];
    const summary = this.calculateReportSummary(metrics);

    if (summary.totalMetrics < 100) {
      recommendations.push('Insufficient data for comprehensive analysis. Collect more metrics.');
    }

    return recommendations;
  }

  // Helper methods
  private getBaselineValue(model: MLModel, metricType: PerformanceMetricType): number {
    // Get baseline value from model metadata or training metrics
    const baseline = model.trainingMetrics?.[metricType] || model.validationMetrics?.[metricType];
    return baseline || 0;
  }

  private calculateAverage(values: number[]): number {
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  private calculateDriftScore(baseline: number, current: number): number {
    return Math.abs(current - baseline) / baseline;
  }

  private groupMetricsByType(metrics: ModelPerformance[]): Record<string, ModelPerformance[]> {
    return metrics.reduce((groups, metric) => {
      if (!groups[metric.metricType]) {
        groups[metric.metricType] = [];
      }
      groups[metric.metricType].push(metric);
      return groups;
    }, {} as Record<string, ModelPerformance[]>);
  }

  private calculateMean(values: number[]): number {
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  private calculateStandardDeviation(values: number[], mean: number): number {
    const variance = values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  private calculateVariance(values: number[], mean: number): number {
    return values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length;
  }

  private calculateDistributionDrift(baseline: any[], current: any[]): number {
    // Simplified distribution drift calculation
    const baselineMean = this.calculateMean(baseline);
    const currentMean = this.calculateMean(current);
    return Math.abs(currentMean - baselineMean) / baselineMean;
  }

  private calculateFeatureDriftScore(baselineValues: any[], currentValues: any[]): number {
    const baselineMean = this.calculateMean(baselineValues);
    const currentMean = this.calculateMean(currentValues);
    return Math.abs(currentMean - baselineMean) / baselineMean;
  }

  private calculateAverageByType(metrics: ModelPerformance[]): Record<string, number> {
    const averages: Record<string, number> = {};
    const metricsByType = this.groupMetricsByType(metrics);

    for (const [metricType, typeMetrics] of Object.entries(metricsByType)) {
      averages[metricType] = this.calculateAverage(typeMetrics.map(m => m.value));
    }

    return averages;
  }

  private calculateLinearRegression(x: number[], y: number[]): { slope: number; intercept: number } {
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    return { slope, intercept };
  }

  private determineTrend(values: number[]): string {
    const { slope } = this.calculateLinearRegression(
      Array.from({ length: values.length }, (_, i) => i),
      values,
    );

    if (slope > 0.01) return 'increasing';
    if (slope < -0.01) return 'decreasing';
    return 'stable';
  }

  private calculateVolatility(values: number[]): number {
    const mean = this.calculateMean(values);
    return this.calculateStandardDeviation(values, mean);
  }
} 