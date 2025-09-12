import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ModelPerformance } from '../entities/model-performance.entity';
import { MLModel } from '../entities/ml-model.entity';
import { ModelDeployment } from '../entities/model-deployment.entity';
import {
  PerformanceMetricType,
  DriftSeverity,
  DeploymentStatus,
} from '../enums';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

@Injectable()
export class ModelMonitoringService {
  private readonly logger = new Logger(ModelMonitoringService.name);
  private readonly MONITORING_DATA_PATH = './monitoring_data';
  private readonly DRIFT_THRESHOLD = 0.1;
  private readonly PERFORMANCE_DECAY_THRESHOLD = 0.05;

  constructor(
    @InjectRepository(ModelPerformance)
    private readonly performanceRepository: Repository<ModelPerformance>,
    @InjectRepository(MLModel)
    private readonly modelRepository: Repository<MLModel>,
    @InjectRepository(ModelDeployment)
    private readonly deploymentRepository: Repository<ModelDeployment>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async recordPrediction(
    modelId: string,
    prediction: any,
    actualValue?: any,
    metadata?: any,
  ): Promise<void> {
    try {
      const performance = this.performanceRepository.create({
        modelId,
        metricName: 'prediction',
        metricType: PerformanceMetricType.PREDICTION,
        value: typeof prediction === 'number' ? prediction : 0,
        metadata: {
          ...metadata,
          prediction,
          actualValue,
          timestamp: new Date().toISOString(),
          predictionId: crypto.randomUUID(),
        },
        recordedAt: new Date(),
      });

      await this.performanceRepository.save(performance);

      // Emit prediction recorded event
      this.eventEmitter.emit('prediction.recorded', {
        modelId,
        prediction,
        actualValue,
        metadata,
      });

      // Check for drift after recording prediction
      await this.checkForDrift(modelId);
    } catch (error) {
      this.logger.error(
        `Failed to record prediction for model ${modelId}: ${error.message}`,
        error.stack,
      );
    }
  }

  async recordPerformanceMetrics(
    modelId: string,
    metrics: any,
    metadata?: any,
  ): Promise<void> {
    try {
      const performanceEntries = Object.entries(metrics).map(
        ([metricName, value]) => ({
          modelId,
          metricName,
          metricType: this.mapMetricType(metricName),
          value: value as number,
          metadata: {
            ...metadata,
            metricName,
            timestamp: new Date().toISOString(),
          },
          recordedAt: new Date(),
        }),
      );

      await this.performanceRepository.save(performanceEntries);

      // Emit metrics recorded event
      this.eventEmitter.emit('metrics.recorded', {
        modelId,
        metrics,
        metadata,
      });

      // Check for performance decay
      await this.checkForPerformanceDecay(modelId);
    } catch (error) {
      this.logger.error(
        `Failed to record performance metrics for model ${modelId}: ${error.message}`,
        error.stack,
      );
    }
  }

  async detectModelDrift(modelId: string): Promise<any> {
    try {
      this.logger.log(`Starting drift detection for model ${modelId}`);

      const model = await this.modelRepository.findOne({
        where: { id: modelId },
      });
      if (!model) {
        throw new Error(`Model ${modelId} not found`);
      }

      // Get recent predictions and training data
      const recentPredictions = await this.getRecentPredictions(modelId, 1000);
      const trainingData = await this.getTrainingDataReference(modelId);

      if (recentPredictions.length === 0) {
        return {
          driftDetected: false,
          message: 'No recent predictions available for drift detection',
        };
      }

      // Perform different types of drift detection
      const featureDrift = await this.detectFeatureDrift(
        recentPredictions,
        trainingData,
      );
      const labelDrift = await this.detectLabelDrift(
        recentPredictions,
        trainingData,
      );
      const conceptDrift = await this.detectConceptDrift(
        recentPredictions,
        trainingData,
      );
      const dataQualityDrift =
        await this.detectDataQualityDrift(recentPredictions);

      const driftResults = {
        modelId,
        timestamp: new Date(),
        featureDrift,
        labelDrift,
        conceptDrift,
        dataQualityDrift,
        overallDriftScore: this.calculateOverallDriftScore(
          featureDrift,
          labelDrift,
          conceptDrift,
          dataQualityDrift,
        ),
        severity: this.determineDriftSeverity(
          featureDrift,
          labelDrift,
          conceptDrift,
          dataQualityDrift,
        ),
      };

      // Save drift detection results
      await this.saveDriftDetectionResults(modelId, driftResults);

      // Emit drift detection event if drift is detected
      if (driftResults.overallDriftScore > this.DRIFT_THRESHOLD) {
        this.eventEmitter.emit('model.drift.detected', {
          modelId,
          driftResults,
        });
      }

      this.logger.log(`Drift detection completed for model ${modelId}`);
      return driftResults;
    } catch (error) {
      this.logger.error(
        `Drift detection failed for model ${modelId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async getModelPerformance(modelId: string, days: number = 30): Promise<any> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const performances = await this.performanceRepository.find({
        where: {
          modelId,
          recordedAt: MoreThanOrEqual(startDate),
        },
        order: { recordedAt: 'ASC' },
      });

      // Group metrics by type and calculate statistics
      const metricsByType = this.groupMetricsByType(performances);
      const performanceSummary =
        this.calculatePerformanceSummary(metricsByType);

      // Calculate trends
      const trends = this.calculatePerformanceTrends(performances);

      return {
        modelId,
        period: { days, startDate, endDate: new Date() },
        summary: performanceSummary,
        trends,
        rawData: performances,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get performance for model ${modelId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async detectAnomalies(
    modelId: string,
    timeWindow: number = 24,
  ): Promise<any> {
    try {
      const startTime = new Date();
      startTime.setHours(startTime.getHours() - timeWindow);

      const recentData = await this.performanceRepository.find({
        where: {
          modelId,
          recordedAt: MoreThanOrEqual(startTime),
        },
        order: { recordedAt: 'ASC' },
      });

      const anomalies = {
        modelId,
        timeWindow,
        timestamp: new Date(),
        predictionAnomalies: this.detectPredictionAnomalies(recentData),
        performanceAnomalies: this.detectPerformanceAnomalies(recentData),
        dataQualityAnomalies: this.detectDataQualityAnomalies(recentData),
      };

      // Emit anomaly detection event if anomalies are found
      const totalAnomalies = Object.values(anomalies)
        .filter(Array.isArray)
        .reduce((sum, arr) => sum + arr.length, 0);
      if (totalAnomalies > 0) {
        this.eventEmitter.emit('model.anomalies.detected', {
          modelId,
          anomalies,
        });
      }

      return anomalies;
    } catch (error) {
      this.logger.error(
        `Anomaly detection failed for model ${modelId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async generateMonitoringReport(
    modelId: string,
    reportType: 'daily' | 'weekly' | 'monthly' = 'daily',
  ): Promise<any> {
    try {
      const days =
        reportType === 'daily' ? 1 : reportType === 'weekly' ? 7 : 30;

      const [performance, driftResults, anomalies, deployments] =
        await Promise.all([
          this.getModelPerformance(modelId, days),
          this.detectModelDrift(modelId),
          this.detectAnomalies(modelId, 24),
          this.getActiveDeployments(modelId),
        ]);

      const report = {
        modelId,
        reportType,
        generatedAt: new Date(),
        period: performance.period,
        performance: performance.summary,
        drift: driftResults,
        anomalies,
        deployments,
        recommendations: this.generateRecommendations(
          performance,
          driftResults,
          anomalies,
        ),
        alerts: this.generateAlerts(performance, driftResults, anomalies),
      };

      // Save report
      await this.saveMonitoringReport(modelId, report);

      return report;
    } catch (error) {
      this.logger.error(
        `Failed to generate monitoring report for model ${modelId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async checkForDrift(modelId: string): Promise<void> {
    try {
      const driftResults = await this.detectModelDrift(modelId);

      if (driftResults.overallDriftScore > this.DRIFT_THRESHOLD) {
        this.logger.warn(
          `Drift detected for model ${modelId}: ${driftResults.overallDriftScore}`,
        );

        // Trigger automatic retraining if drift is severe
        if (driftResults.severity === DriftSeverity.HIGH) {
          this.eventEmitter.emit('model.retrain.required', {
            modelId,
            reason: 'high_drift_detected',
            driftResults,
          });
        }
      }
    } catch (error) {
      this.logger.error(
        `Drift check failed for model ${modelId}: ${error.message}`,
        error.stack,
      );
    }
  }

  async checkForPerformanceDecay(modelId: string): Promise<void> {
    try {
      const performance = await this.getModelPerformance(modelId, 7); // Last 7 days
      const baselinePerformance = await this.getBaselinePerformance(modelId);

      if (baselinePerformance) {
        const decayScore = this.calculatePerformanceDecay(
          performance.summary,
          baselinePerformance,
        );

        if (decayScore > this.PERFORMANCE_DECAY_THRESHOLD) {
          this.logger.warn(
            `Performance decay detected for model ${modelId}: ${decayScore}`,
          );

          this.eventEmitter.emit('model.performance.decay', {
            modelId,
            decayScore,
            currentPerformance: performance.summary,
            baselinePerformance,
          });
        }
      }
    } catch (error) {
      this.logger.error(
        `Performance decay check failed for model ${modelId}: ${error.message}`,
        error.stack,
      );
    }
  }

  // Private helper methods
  private async getRecentPredictions(
    modelId: string,
    limit: number,
  ): Promise<any[]> {
    return await this.performanceRepository.find({
      where: { modelId, metricType: PerformanceMetricType.PREDICTION },
      order: { recordedAt: 'DESC' },
      take: limit,
    });
  }

  private async getTrainingDataReference(modelId: string): Promise<any> {
    // In a real implementation, this would load the training data reference
    // For now, we'll simulate it
    return {
      featureDistributions: {},
      labelDistribution: {},
      dataQualityMetrics: {},
    };
  }

  private async detectFeatureDrift(
    predictions: any[],
    trainingData: any,
  ): Promise<any> {
    // Implement feature drift detection using statistical tests
    const featureDrift = {
      detected: false,
      score: 0,
      features: {},
      method: 'statistical_test',
    };

    // Simulate feature drift detection
    const driftScore = Math.random() * 0.3;
    featureDrift.score = driftScore;
    featureDrift.detected = driftScore > this.DRIFT_THRESHOLD;

    return featureDrift;
  }

  private async detectLabelDrift(
    predictions: any[],
    trainingData: any,
  ): Promise<any> {
    // Implement label drift detection
    const labelDrift = {
      detected: false,
      score: 0,
      method: 'distribution_comparison',
    };

    // Simulate label drift detection
    const driftScore = Math.random() * 0.2;
    labelDrift.score = driftScore;
    labelDrift.detected = driftScore > this.DRIFT_THRESHOLD;

    return labelDrift;
  }

  private async detectConceptDrift(
    predictions: any[],
    trainingData: any,
  ): Promise<any> {
    // Implement concept drift detection
    const conceptDrift = {
      detected: false,
      score: 0,
      method: 'performance_monitoring',
    };

    // Simulate concept drift detection
    const driftScore = Math.random() * 0.25;
    conceptDrift.score = driftScore;
    conceptDrift.detected = driftScore > this.DRIFT_THRESHOLD;

    return conceptDrift;
  }

  private async detectDataQualityDrift(predictions: any[]): Promise<any> {
    // Implement data quality drift detection
    const dataQualityDrift = {
      detected: false,
      score: 0,
      issues: [],
      method: 'quality_metrics',
    };

    // Simulate data quality issues
    const qualityScore = Math.random() * 0.15;
    dataQualityDrift.score = qualityScore;
    dataQualityDrift.detected = qualityScore > this.DRIFT_THRESHOLD;

    if (dataQualityDrift.detected) {
      dataQualityDrift.issues = [
        'Missing values detected',
        'Outlier values found',
        'Data type inconsistencies',
      ];
    }

    return dataQualityDrift;
  }

  private calculateOverallDriftScore(
    featureDrift: any,
    labelDrift: any,
    conceptDrift: any,
    dataQualityDrift: any,
  ): number {
    // Weighted average of different drift types
    const weights = {
      feature: 0.3,
      label: 0.25,
      concept: 0.3,
      quality: 0.15,
    };

    return (
      featureDrift.score * weights.feature +
      labelDrift.score * weights.label +
      conceptDrift.score * weights.concept +
      dataQualityDrift.score * weights.quality
    );
  }

  private determineDriftSeverity(
    featureDrift: any,
    labelDrift: any,
    conceptDrift: any,
    dataQualityDrift: any,
  ): DriftSeverity {
    const overallScore = this.calculateOverallDriftScore(
      featureDrift,
      labelDrift,
      conceptDrift,
      dataQualityDrift,
    );

    if (overallScore > 0.3) return DriftSeverity.HIGH;
    if (overallScore > 0.15) return DriftSeverity.MEDIUM;
    if (overallScore > 0.05) return DriftSeverity.LOW;
    return DriftSeverity.NONE;
  }

  private mapMetricType(metricName: string): PerformanceMetricType {
    const metricMap: Record<string, PerformanceMetricType> = {
      accuracy: PerformanceMetricType.ACCURACY,
      precision: PerformanceMetricType.PRECISION,
      recall: PerformanceMetricType.RECALL,
      f1_score: PerformanceMetricType.F1_SCORE,
      auc: PerformanceMetricType.AUC,
      mse: PerformanceMetricType.MSE,
      mae: PerformanceMetricType.MAE,
      rmse: PerformanceMetricType.RMSE,
    };

    return metricMap[metricName] || PerformanceMetricType.CUSTOM;
  }

  private groupMetricsByType(
    performances: ModelPerformance[],
  ): Record<string, ModelPerformance[]> {
    const grouped: Record<string, ModelPerformance[]> = {};

    performances.forEach((performance) => {
      const type = performance.metricType;
      if (!grouped[type]) {
        grouped[type] = [];
      }
      grouped[type].push(performance);
    });

    return grouped;
  }

  private calculatePerformanceSummary(
    metricsByType: Record<string, ModelPerformance[]>,
  ): any {
    const summary: any = {};

    Object.entries(metricsByType).forEach(([type, performances]) => {
      const values = performances
        .map((p) => p.value as number)
        .filter((v) => !isNaN(v));

      if (values.length > 0) {
        summary[type] = {
          mean: values.reduce((sum, val) => sum + val, 0) / values.length,
          min: Math.min(...values),
          max: Math.max(...values),
          std: this.calculateStandardDeviation(values),
          count: values.length,
        };
      }
    });

    return summary;
  }

  private calculateStandardDeviation(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map((val) => Math.pow(val - mean, 2));
    const variance =
      squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
    return Math.sqrt(variance);
  }

  private calculatePerformanceTrends(performances: ModelPerformance[]): any {
    // Calculate trends over time
    const trends: any = {};

    // Group by metric type and calculate trend
    const metricsByType = this.groupMetricsByType(performances);

    Object.entries(metricsByType).forEach(([type, typePerformances]) => {
      const sortedPerformances = typePerformances.sort(
        (a, b) =>
          new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime(),
      );

      if (sortedPerformances.length >= 2) {
        const firstValue = sortedPerformances[0].value as number;
        const lastValue = sortedPerformances[sortedPerformances.length - 1]
          .value as number;
        const change = lastValue - firstValue;
        const changePercent = (change / firstValue) * 100;

        trends[type] = {
          change,
          changePercent,
          trend: change > 0 ? 'improving' : change < 0 ? 'declining' : 'stable',
        };
      }
    });

    return trends;
  }

  private detectPredictionAnomalies(data: ModelPerformance[]): any[] {
    // Implement prediction anomaly detection
    const anomalies: any[] = [];

    // Simulate anomaly detection
    if (Math.random() > 0.8) {
      anomalies.push({
        type: 'prediction_anomaly',
        timestamp: new Date(),
        description: 'Unusual prediction pattern detected',
        severity: 'medium',
      });
    }

    return anomalies;
  }

  private detectPerformanceAnomalies(data: ModelPerformance[]): any[] {
    // Implement performance anomaly detection
    const anomalies: any[] = [];

    // Simulate performance anomalies
    if (Math.random() > 0.9) {
      anomalies.push({
        type: 'performance_anomaly',
        timestamp: new Date(),
        description: 'Performance degradation detected',
        severity: 'high',
      });
    }

    return anomalies;
  }

  private detectDataQualityAnomalies(data: ModelPerformance[]): any[] {
    // Implement data quality anomaly detection
    const anomalies: any[] = [];

    // Simulate data quality issues
    if (Math.random() > 0.85) {
      anomalies.push({
        type: 'data_quality_anomaly',
        timestamp: new Date(),
        description: 'Data quality issues detected',
        severity: 'low',
      });
    }

    return anomalies;
  }

  private async getActiveDeployments(
    modelId: string,
  ): Promise<ModelDeployment[]> {
    return await this.deploymentRepository.find({
      where: { modelId, status: DeploymentStatus.ACTIVE },
      order: { deployedAt: 'DESC' },
    });
  }

  private async getBaselinePerformance(modelId: string): Promise<any> {
    // Get baseline performance from training or initial deployment
    const baselineData = await this.performanceRepository.find({
      where: { modelId },
      order: { recordedAt: 'ASC' },
      take: 100,
    });

    if (baselineData.length > 0) {
      const metricsByType = this.groupMetricsByType(baselineData);
      return this.calculatePerformanceSummary(metricsByType);
    }

    return null;
  }

  private calculatePerformanceDecay(
    currentPerformance: any,
    baselinePerformance: any,
  ): number {
    // Calculate performance decay score
    let totalDecay = 0;
    let metricCount = 0;

    Object.keys(baselinePerformance).forEach((metric) => {
      if (currentPerformance[metric] && baselinePerformance[metric]) {
        const currentValue = currentPerformance[metric].mean;
        const baselineValue = baselinePerformance[metric].mean;
        const decay = (baselineValue - currentValue) / baselineValue;
        totalDecay += Math.max(0, decay);
        metricCount++;
      }
    });

    return metricCount > 0 ? totalDecay / metricCount : 0;
  }

  private generateRecommendations(
    performance: any,
    driftResults: any,
    anomalies: any,
  ): string[] {
    const recommendations: string[] = [];

    // Performance-based recommendations
    if (performance.trends) {
      Object.entries(performance.trends).forEach(
        ([metric, trend]: [string, any]) => {
          if (trend.trend === 'declining' && trend.changePercent < -5) {
            recommendations.push(
              `Consider retraining model due to declining ${metric} performance`,
            );
          }
        },
      );
    }

    // Drift-based recommendations
    if (driftResults.overallDriftScore > this.DRIFT_THRESHOLD) {
      recommendations.push('Retrain model to address data drift');
    }

    // Anomaly-based recommendations
    const totalAnomalies = Object.values(anomalies)
      .filter(Array.isArray)
      .reduce((sum, arr) => sum + arr.length, 0);
    if (totalAnomalies > 0) {
      recommendations.push('Investigate detected anomalies');
    }

    return recommendations;
  }

  private generateAlerts(
    performance: any,
    driftResults: any,
    anomalies: any,
  ): any[] {
    const alerts: any[] = [];

    // High drift alert
    if (driftResults.severity === DriftSeverity.HIGH) {
      alerts.push({
        type: 'high_drift',
        severity: 'high',
        message: 'High data drift detected - immediate action required',
        timestamp: new Date(),
      });
    }

    // Performance decay alert
    if (performance.trends) {
      Object.entries(performance.trends).forEach(
        ([metric, trend]: [string, any]) => {
          if (trend.changePercent < -10) {
            alerts.push({
              type: 'performance_decay',
              severity: 'medium',
              message: `Significant performance decay in ${metric}`,
              timestamp: new Date(),
            });
          }
        },
      );
    }

    return alerts;
  }

  private async saveDriftDetectionResults(
    modelId: string,
    results: any,
  ): Promise<void> {
    const driftData = {
      modelId,
      results,
      timestamp: new Date(),
    };

    const driftPath = path.join(this.MONITORING_DATA_PATH, 'drift_detection');
    await fs.mkdir(driftPath, { recursive: true });

    const filename = `${modelId}_drift_${Date.now()}.json`;
    await fs.writeFile(
      path.join(driftPath, filename),
      JSON.stringify(driftData, null, 2),
    );
  }

  private async saveMonitoringReport(
    modelId: string,
    report: any,
  ): Promise<void> {
    const reportPath = path.join(this.MONITORING_DATA_PATH, 'reports');
    await fs.mkdir(reportPath, { recursive: true });

    const filename = `${modelId}_report_${Date.now()}.json`;
    await fs.writeFile(
      path.join(reportPath, filename),
      JSON.stringify(report, null, 2),
    );
  }
}
