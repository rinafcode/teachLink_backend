import { IsString, IsOptional, IsObject, IsArray, IsNumber, Min, Max, IsEnum } from 'class-validator';
import { ModelFramework } from '../entities/ml-model.entity';

export class TrainModelDto {
  @IsString()
  modelId: string;

  @IsOptional()
  @IsString()
  version?: string;

  @IsOptional()
  @IsObject()
  hyperparameters?: Record<string, any>;

  @IsOptional()
  @IsObject()
  trainingConfig?: {
    epochs?: number;
    batchSize?: number;
    learningRate?: number;
    validationSplit?: number;
    earlyStopping?: boolean;
    patience?: number;
  };

  @IsOptional()
  @IsObject()
  dataConfig?: {
    trainingDataPath?: string;
    validationDataPath?: string;
    testDataPath?: string;
    dataPreprocessing?: Record<string, any>;
  };

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  parentVersionId?: string;

  @IsOptional()
  @IsString()
  trainedBy?: string;
} 