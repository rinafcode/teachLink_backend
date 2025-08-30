import { Injectable, BadRequestException } from '@nestjs/common';
import { MLModel } from '../entities/ml-model.entity';
import { ModelType, ModelFramework } from '../enums';
import { ModelVersion } from '../entities/model-version.entity';
import { TrainModelDto } from '../dto/train-model.dto';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

@Injectable()
export class TrainingPipelineService {
  async trainModel(
    model: MLModel,
    version: ModelVersion,
    trainModelDto: TrainModelDto,
  ): Promise<any> {
    try {
      // Validate training data
      await this.validateTrainingData(trainModelDto);

      // Prepare training configuration
      const trainingConfig = this.prepareTrainingConfig(model, version, trainModelDto);

      // Perform hyperparameter optimization if needed
      const optimizedHyperparameters = await this.optimizeHyperparameters(
        model,
        trainingConfig,
      );

      // Train the model
      const trainingResult = await this.executeTraining(
        model,
        version,
        trainingConfig,
        optimizedHyperparameters,
      );

      // Evaluate the model
      const evaluationResult = await this.evaluateModel(
        model,
        trainingResult,
        trainingConfig,
      );

      // Save model artifacts
      const artifactPath = await this.saveModelArtifacts(
        model,
        version,
        trainingResult,
        evaluationResult,
      );

      // Generate model hash
      const modelHash = this.generateModelHash(trainingResult.modelData);

      return {
        ...trainingResult,
        ...evaluationResult,
        artifactPath,
        modelHash,
      };
    } catch (error) {
      throw new BadRequestException(`Training failed: ${error.message}`);
    }
  }

  async hyperparameterTuning(
    model: MLModel,
    trainingConfig: any,
    maxTrials: number = 10,
  ): Promise<any> {
    const searchSpace = this.defineSearchSpace(model.framework, model.type);
    const bestParams = await this.performHyperparameterSearch(
      model,
      trainingConfig,
      searchSpace,
      maxTrials,
    );

    return bestParams;
  }

  async crossValidation(
    model: MLModel,
    trainingConfig: any,
    hyperparameters: any,
    folds: number = 5,
  ): Promise<any> {
    const cvResults = await this.performCrossValidation(
      model,
      trainingConfig,
      hyperparameters,
      folds,
    );

    return {
      meanAccuracy: cvResults.meanAccuracy,
      stdAccuracy: cvResults.stdAccuracy,
      foldResults: cvResults.foldResults,
    };
  }

  async featureSelection(
    model: MLModel,
    trainingConfig: any,
  ): Promise<string[]> {
    const featureImportance = await this.calculateFeatureImportance(
      model,
      trainingConfig,
    );

    const selectedFeatures = this.selectOptimalFeatures(
      featureImportance,
      trainingConfig.featureSelectionThreshold || 0.01,
    );

    return selectedFeatures;
  }

  async dataPreprocessing(
    model: MLModel,
    trainingConfig: any,
  ): Promise<any> {
    const preprocessingPipeline = this.createPreprocessingPipeline(
      model,
      trainingConfig,
    );

    const processedData = await this.applyPreprocessing(
      preprocessingPipeline,
      trainingConfig.trainingData,
    );

    return {
      preprocessingPipeline,
      processedData,
    };
  }

  private async validateTrainingData(trainModelDto: TrainModelDto): Promise<void> {
    if (!trainModelDto.dataConfig?.trainingDataPath) {
      throw new BadRequestException('Training data path is required');
    }

    // Check if training data file exists
    const trainingDataPath = path.join(process.cwd(), trainModelDto.dataConfig.trainingDataPath);
    try {
      await fs.access(trainingDataPath);
    } catch {
      throw new BadRequestException('Training data file not found');
    }

    // Validate data format and size
    const stats = await fs.stat(trainingDataPath);
    if (stats.size === 0) {
      throw new BadRequestException('Training data file is empty');
    }
  }

  private prepareTrainingConfig(
    model: MLModel,
    version: ModelVersion,
    trainModelDto: TrainModelDto,
  ): any {
    const baseConfig = {
      modelType: model.type,
      framework: model.framework,
      features: model.features || [],
      targetVariable: model.targetVariable,
      hyperparameters: trainModelDto.hyperparameters || model.hyperparameters || {},
      trainingConfig: {
        epochs: trainModelDto.trainingConfig?.epochs || 100,
        batchSize: trainModelDto.trainingConfig?.batchSize || 32,
        learningRate: trainModelDto.trainingConfig?.learningRate || 0.001,
        validationSplit: trainModelDto.trainingConfig?.validationSplit || 0.2,
        earlyStopping: trainModelDto.trainingConfig?.earlyStopping || true,
        patience: trainModelDto.trainingConfig?.patience || 10,
      },
      dataConfig: trainModelDto.dataConfig || {},
    };

    // Add framework-specific configurations
    switch (model.framework) {
      case ModelFramework.TENSORFLOW:
        baseConfig.frameworkConfig = {
          optimizer: 'adam',
          loss: this.getLossFunction(model.type),
          metrics: this.getMetrics(model.type),
        };
        break;
      case ModelFramework.PYTORCH:
        baseConfig.frameworkConfig = {
          optimizer: 'adam',
          loss: this.getLossFunction(model.type),
          scheduler: 'step',
        };
        break;
      case ModelFramework.SCIKIT_LEARN:
        baseConfig.frameworkConfig = {
          randomState: 42,
          nJobs: -1,
        };
        break;
    }

    return baseConfig;
  }

  private async optimizeHyperparameters(
    model: MLModel,
    trainingConfig: any,
  ): Promise<any> {
    // Check if hyperparameter optimization is needed
    if (!trainingConfig.hyperparameters || Object.keys(trainingConfig.hyperparameters).length === 0) {
      return await this.hyperparameterTuning(model, trainingConfig);
    }

    return trainingConfig.hyperparameters;
  }

  private async executeTraining(
    model: MLModel,
    version: ModelVersion,
    trainingConfig: any,
    hyperparameters: any,
  ): Promise<any> {
    // Load and preprocess training data
    const processedData = await this.dataPreprocessing(model, trainingConfig);

    // Initialize model based on framework
    const modelInstance = await this.initializeModel(model, hyperparameters);

    // Train the model
    const trainingHistory = await this.trainModelInstance(
      modelInstance,
      processedData,
      trainingConfig,
    );

    // Generate model data for saving
    const modelData = await this.serializeModel(modelInstance, model.framework);

    return {
      modelInstance,
      modelData,
      trainingHistory,
      hyperparameters,
    };
  }

  private async evaluateModel(
    model: MLModel,
    trainingResult: any,
    trainingConfig: any,
  ): Promise<any> {
    // Load test data
    const testData = await this.loadTestData(trainingConfig);

    // Make predictions
    const predictions = await this.makePredictions(
      trainingResult.modelInstance,
      testData,
    );

    // Calculate metrics
    const metrics = this.calculateMetrics(
      testData.targets,
      predictions,
      model.type,
    );

    // Generate evaluation plots
    const plots = await this.generateEvaluationPlots(
      testData.targets,
      predictions,
      model.type,
    );

    return {
      predictions,
      metrics,
      plots,
    };
  }

  private async saveModelArtifacts(
    model: MLModel,
    version: ModelVersion,
    trainingResult: any,
    evaluationResult: any,
  ): Promise<string> {
    const artifactDir = path.join(
      process.cwd(),
      'artifacts',
      'models',
      model.id,
      version.version,
    );

    await fs.mkdir(artifactDir, { recursive: true });

    // Save model file
    const modelPath = path.join(artifactDir, 'model.pkl');
    await fs.writeFile(modelPath, trainingResult.modelData);

    // Save training history
    const historyPath = path.join(artifactDir, 'training_history.json');
    await fs.writeFile(historyPath, JSON.stringify(trainingResult.trainingHistory, null, 2));

    // Save evaluation results
    const evaluationPath = path.join(artifactDir, 'evaluation.json');
    await fs.writeFile(evaluationPath, JSON.stringify(evaluationResult, null, 2));

    // Save metadata
    const metadataPath = path.join(artifactDir, 'metadata.json');
    const metadata = {
      modelId: model.id,
      versionId: version.id,
      framework: model.framework,
      type: model.type,
      features: model.features,
      targetVariable: model.targetVariable,
      hyperparameters: trainingResult.hyperparameters,
      trainingConfig: trainingResult.trainingConfig,
      createdAt: new Date().toISOString(),
    };
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

    return path.relative(process.cwd(), modelPath);
  }

  private generateModelHash(modelData: Buffer): string {
    return crypto.createHash('sha256').update(modelData).digest('hex');
  }

  private defineSearchSpace(framework: ModelFramework, type: ModelType): any {
    const searchSpace: Record<string, any> = {};

    switch (framework) {
      case ModelFramework.SCIKIT_LEARN:
        if (type === ModelType.CLASSIFICATION) {
          searchSpace.max_depth = { type: 'int', min: 3, max: 20 };
          searchSpace.n_estimators = { type: 'int', min: 50, max: 500 };
          searchSpace.learning_rate = { type: 'float', min: 0.01, max: 0.3 };
        } else if (type === ModelType.REGRESSION) {
          searchSpace.alpha = { type: 'float', min: 0.001, max: 1.0 };
          searchSpace.max_iter = { type: 'int', min: 100, max: 2000 };
        }
        break;
      case ModelFramework.TENSORFLOW:
        searchSpace.learning_rate = { type: 'float', min: 0.0001, max: 0.01 };
        searchSpace.batch_size = { type: 'int', min: 16, max: 128 };
        searchSpace.epochs = { type: 'int', min: 50, max: 200 };
        break;
    }

    return searchSpace;
  }

  private async performHyperparameterSearch(
    model: MLModel,
    trainingConfig: any,
    searchSpace: any,
    maxTrials: number,
  ): Promise<any> {
    const trials: any[] = [];
    let bestScore = -Infinity;
    let bestParams: any = {};

    for (let trial = 0; trial < maxTrials; trial++) {
      // Generate random hyperparameters
      const params = this.generateRandomHyperparameters(searchSpace);

      // Train model with these parameters
      const score = await this.evaluateHyperparameters(model, trainingConfig, params);

      trials.push({ trial, params, score });

      if (score > bestScore) {
        bestScore = score;
        bestParams = params;
      }
    }

    return bestParams;
  }

  private generateRandomHyperparameters(searchSpace: any): any {
    const params: any = {};

    for (const [param, config] of Object.entries(searchSpace)) {
      if (config.type === 'int') {
        params[param] = Math.floor(Math.random() * (config.max - config.min + 1)) + config.min;
      } else if (config.type === 'float') {
        params[param] = Math.random() * (config.max - config.min) + config.min;
      }
    }

    return params;
  }

  private async evaluateHyperparameters(
    model: MLModel,
    trainingConfig: any,
    hyperparameters: any,
  ): Promise<number> {
    // Simplified evaluation - in practice, you would do cross-validation
    const cvResult = await this.crossValidation(model, trainingConfig, hyperparameters, 3);
    return cvResult.meanAccuracy;
  }

  private async performCrossValidation(
    model: MLModel,
    trainingConfig: any,
    hyperparameters: any,
    folds: number,
  ): Promise<any> {
    const foldResults: number[] = [];

    for (let fold = 0; fold < folds; fold++) {
      // Split data into train/validation
      const { trainData, valData } = this.splitData(trainingConfig.trainingData, fold, folds);

      // Train model
      const modelInstance = await this.initializeModel(model, hyperparameters);
      await this.trainModelInstance(modelInstance, trainData, trainingConfig);

      // Evaluate
      const predictions = await this.makePredictions(modelInstance, valData);
      const accuracy = this.calculateAccuracy(valData.targets, predictions);
      foldResults.push(accuracy);
    }

    const meanAccuracy = this.calculateMean(foldResults);
    const stdAccuracy = this.calculateStandardDeviation(foldResults, meanAccuracy);

    return {
      meanAccuracy,
      stdAccuracy,
      foldResults,
    };
  }

  private async calculateFeatureImportance(model: MLModel, trainingConfig: any): Promise<Record<string, number>> {
    // Simplified feature importance calculation
    const featureImportance: Record<string, number> = {};

    for (const feature of trainingConfig.features) {
      // In practice, you would use techniques like permutation importance or SHAP values
      featureImportance[feature] = Math.random();
    }

    return featureImportance;
  }

  private selectOptimalFeatures(
    featureImportance: Record<string, number>,
    threshold: number,
  ): string[] {
    return Object.entries(featureImportance)
      .filter(([_, importance]) => importance > threshold)
      .map(([feature, _]) => feature);
  }

  private createPreprocessingPipeline(model: MLModel, trainingConfig: any): any {
    return {
      scaling: 'standard',
      encoding: 'one_hot',
      imputation: 'mean',
      featureSelection: trainingConfig.features,
    };
  }

  private async applyPreprocessing(pipeline: any, data: any): Promise<any> {
    // Simplified preprocessing - in practice, you would use scikit-learn or similar
    return {
      features: data.features,
      targets: data.targets,
      preprocessed: true,
    };
  }

  private getLossFunction(type: ModelType): string {
    switch (type) {
      case ModelType.CLASSIFICATION:
        return 'categorical_crossentropy';
      case ModelType.REGRESSION:
        return 'mse';
      default:
        return 'mse';
    }
  }

  private getMetrics(type: ModelType): string[] {
    switch (type) {
      case ModelType.CLASSIFICATION:
        return ['accuracy', 'precision', 'recall', 'f1_score'];
      case ModelType.REGRESSION:
        return ['mae', 'mse', 'rmse'];
      default:
        return ['accuracy'];
    }
  }

  private async initializeModel(model: MLModel, hyperparameters: any): Promise<any> {
    // Simplified model initialization
    return {
      framework: model.framework,
      type: model.type,
      hyperparameters,
      initialized: true,
    };
  }

  private async trainModelInstance(
    modelInstance: any,
    data: any,
    trainingConfig: any,
  ): Promise<any> {
    // Simplified training - in practice, you would use the actual framework
    const history = {
      loss: Array.from({ length: trainingConfig.trainingConfig.epochs }, () => Math.random() * 0.5),
      accuracy: Array.from({ length: trainingConfig.trainingConfig.epochs }, () => 0.8 + Math.random() * 0.2),
      val_loss: Array.from({ length: trainingConfig.trainingConfig.epochs }, () => Math.random() * 0.5),
      val_accuracy: Array.from({ length: trainingConfig.trainingConfig.epochs }, () => 0.8 + Math.random() * 0.2),
    };

    return history;
  }

  private async serializeModel(modelInstance: any, framework: ModelFramework): Promise<Buffer> {
    // Simplified model serialization
    const modelData = JSON.stringify({
      framework,
      modelInstance,
      serializedAt: new Date().toISOString(),
    });

    return Buffer.from(modelData);
  }

  private async loadTestData(trainingConfig: any): Promise<any> {
    // Simplified test data loading
    return {
      features: Array.from({ length: 100 }, () => Array.from({ length: 10 }, () => Math.random())),
      targets: Array.from({ length: 100 }, () => Math.random() > 0.5 ? 1 : 0),
    };
  }

  private async makePredictions(modelInstance: any, data: any): Promise<any[]> {
    // Simplified prediction - in practice, you would use the actual model
    return Array.from({ length: data.features.length }, () => Math.random() > 0.5 ? 1 : 0);
  }

  private calculateMetrics(targets: any[], predictions: any[], type: ModelType): any {
    const metrics: any = {};

    if (type === ModelType.CLASSIFICATION) {
      metrics.accuracy = this.calculateAccuracy(targets, predictions);
      metrics.precision = this.calculatePrecision(targets, predictions);
      metrics.recall = this.calculateRecall(targets, predictions);
      metrics.f1Score = this.calculateF1Score(targets, predictions);
    } else {
      metrics.mae = this.calculateMAE(targets, predictions);
      metrics.mse = this.calculateMSE(targets, predictions);
      metrics.rmse = Math.sqrt(metrics.mse);
    }

    return metrics;
  }

  private async generateEvaluationPlots(
    targets: any[],
    predictions: any[],
    type: ModelType,
  ): Promise<any> {
    // Simplified plot generation
    return {
      confusionMatrix: this.generateConfusionMatrix(targets, predictions),
      rocCurve: this.generateROCCurve(targets, predictions),
    };
  }

  // Helper methods for metrics calculation
  private calculateAccuracy(targets: any[], predictions: any[]): number {
    const correct = targets.filter((t, i) => t === predictions[i]).length;
    return correct / targets.length;
  }

  private calculatePrecision(targets: any[], predictions: any[]): number {
    const truePositives = targets.filter((t, i) => t === 1 && predictions[i] === 1).length;
    const predictedPositives = predictions.filter(p => p === 1).length;
    return predictedPositives > 0 ? truePositives / predictedPositives : 0;
  }

  private calculateRecall(targets: any[], predictions: any[]): number {
    const truePositives = targets.filter((t, i) => t === 1 && predictions[i] === 1).length;
    const actualPositives = targets.filter(t => t === 1).length;
    return actualPositives > 0 ? truePositives / actualPositives : 0;
  }

  private calculateF1Score(targets: any[], predictions: any[]): number {
    const precision = this.calculatePrecision(targets, predictions);
    const recall = this.calculateRecall(targets, predictions);
    return precision + recall > 0 ? 2 * (precision * recall) / (precision + recall) : 0;
  }

  private calculateMAE(targets: any[], predictions: any[]): number {
    return targets.reduce((sum, t, i) => sum + Math.abs(t - predictions[i]), 0) / targets.length;
  }

  private calculateMSE(targets: any[], predictions: any[]): number {
    return targets.reduce((sum, t, i) => sum + Math.pow(t - predictions[i], 2), 0) / targets.length;
  }

  private calculateMean(values: number[]): number {
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  private calculateStandardDeviation(values: number[], mean: number): number {
    const variance = values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  private splitData(data: any, fold: number, totalFolds: number): { trainData: any; valData: any } {
    // Simplified data splitting
    return {
      trainData: { features: data.features.slice(0, -20), targets: data.targets.slice(0, -20) },
      valData: { features: data.features.slice(-20), targets: data.targets.slice(-20) },
    };
  }

  private generateConfusionMatrix(targets: any[], predictions: any[]): number[][] {
    const matrix = [[0, 0], [0, 0]];
    for (let i = 0; i < targets.length; i++) {
      matrix[targets[i]][predictions[i]]++;
    }
    return matrix;
  }

  private generateROCCurve(targets: any[], predictions: any[]): any {
    // Simplified ROC curve generation
    return {
      fpr: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
      tpr: [0, 0.2, 0.4, 0.6, 0.7, 0.8, 0.85, 0.9, 0.95, 0.98, 1.0],
    };
  }
} 