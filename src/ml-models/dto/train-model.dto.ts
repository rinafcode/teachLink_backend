import {
  IsString,
  IsOptional,
  IsObject,
  IsArray,
  IsNumber,
  Min,
  Max,
  IsEnum,
  IsBoolean,
} from 'class-validator';
import { ModelFramework } from '../enums';

export class TrainModelDto {
  @IsString()
  modelId: string;

  @IsOptional()
  @IsString()
  version?: string;

  @IsOptional()
  @IsString()
  trainingDataPath?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  validationSplit?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  testSplit?: number;

  @IsOptional()
  @IsNumber()
  randomState?: number;

  @IsOptional()
  @IsBoolean()
  enableEarlyStopping?: boolean;

  @IsOptional()
  @IsBoolean()
  enableHyperparameterOptimization?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxTrials?: number;

  @IsOptional()
  @IsNumber()
  @Min(2)
  crossValidationFolds?: number;

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
  @IsObject()
  preprocessing?: Record<string, any>;

  @IsOptional()
  @IsObject()
  augmentation?: Record<string, any>;

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
