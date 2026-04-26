export type FlagValueType = boolean | string | number;

export type EvaluationReason =
  | 'FLAG_DISABLED'
  | 'PREREQUISITE_FAILED'
  | 'TARGETING_MATCH'
  | 'ROLLOUT'
  | 'EXPERIMENT'
  | 'DEFAULT'
  | 'ERROR';

export type ConditionOperator =
  | 'equals'
  | 'notEquals'
  | 'contains'
  | 'notContains'
  | 'startsWith'
  | 'endsWith'
  | 'greaterThan'
  | 'greaterThanOrEqual'
  | 'lessThan'
  | 'lessThanOrEqual'
  | 'in'
  | 'notIn'
  | 'regex'
  | 'exists'
  | 'notExists';

export type FlagType = 'boolean' | 'string' | 'number';

export type ExperimentStatus = 'draft' | 'running' | 'paused' | 'completed';

export interface IUserContext {
  userId: string;
  email?: string;
  country?: string;
  plan?: string;
  roles?: string[];
  groups?: string[];
  attributes?: Record<string, string | number | boolean>;
  sessionId?: string;
  ipAddress?: string;
}

export interface ITargetingCondition {
  attribute: string;
  operator: ConditionOperator;
  value?: FlagValueType | FlagValueType[];
}

export interface ITargetingRule {
  id: string;
  name?: string;
  conditions: ITargetingCondition[];
  conditionsOperator: 'AND' | 'OR';
  serveVariationKey: string;
  priority: number;
}

export interface ITargetingConfig {
  rules: ITargetingRule[];
  defaultServeVariationKey: string;
}

export interface IRampStep {
  at: Date;
  percentage: number;
}

export interface IRolloutConfig {
  percentage: number;
  bucketByAttribute?: string;
  sticky?: boolean;
  startDate?: Date;
  endDate?: Date;
  rampSchedule?: IRampStep[];
}

export interface IExperimentVariant {
  key: string;
  name: string;
  weight: number;
  value: FlagValueType;
  isControl?: boolean;
  description?: string;
}

export interface IExperimentConfig {
  experimentId: string;
  name: string;
  hypothesis?: string;
  variants: IExperimentVariant[];
  trafficAllocation: number;
  bucketByAttribute?: string;
  startDate?: Date;
  endDate?: Date;
  status: ExperimentStatus;
  winnerVariantKey?: string;
  metrics?: string[];
}

export interface IFlagVariation {
  key: string;
  name: string;
  value: FlagValueType;
  description?: string;
}

export interface IFlagPrerequisite {
  flagKey: string;
  requiredVariationKey: string;
}

export interface IFeatureFlag {
  id: string;
  key: string;
  name: string;
  description?: string;
  type: FlagType;
  enabled: boolean;
  defaultVariationKey: string;
  offVariationKey: string;
  variations: IFlagVariation[];
  targeting?: ITargetingConfig;
  rollout?: IRolloutConfig;
  experiment?: IExperimentConfig;
  prerequisites?: IFlagPrerequisite[];
  tags?: string[];
  projectId?: string;
  environmentId?: string;
  version: number;
  archived: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
}

export interface IFlagEvaluationResult {
  flagKey: string;
  value: FlagValueType;
  variationKey: string;
  reason: EvaluationReason;
  ruleId?: string;
  experimentId?: string;
  experimentVariantKey?: string;
  timestamp: Date;
}

export interface IExperimentResult {
  experimentId: string;
  variantKey: string;
  value: FlagValueType;
  isControl: boolean;
}

export interface IFlagAnalyticsEvent {
  eventId: string;
  eventType: 'evaluation' | 'impression' | 'conversion' | 'error';
  flagKey?: string;
  userId?: string;
  sessionId?: string;
  variationKey?: string;
  experimentId?: string;
  experimentVariantKey?: string;
  reason?: EvaluationReason;
  value?: FlagValueType;
  metadata?: Record<string, unknown>;
  timestamp: Date;
}

export interface IFlagEvaluationStats {
  flagKey: string;
  totalEvaluations: number;
  evaluationsByVariation: Record<string, number>;
  evaluationsByReason: Record<string, number>;
  uniqueUsers: number;
  errorRate: number;
}

export interface IExperimentVariantStats {
  variantKey: string;
  impressions: number;
  conversions: number;
  conversionRate: number;
  isControl: boolean;
}

export interface IExperimentStats {
  experimentId: string;
  totalImpressions: number;
  variants: Record<string, IExperimentVariantStats>;
}

export interface IFlagSummary {
  flagKey: string;
  totalEvaluations: number;
  lastEvaluatedAt?: Date;
}
