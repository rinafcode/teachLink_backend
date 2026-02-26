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

export interface UserContext {
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

export interface TargetingCondition {
  attribute: string;
  operator: ConditionOperator;
  value?: FlagValueType | FlagValueType[];
}

export interface TargetingRule {
  id: string;
  name?: string;
  conditions: TargetingCondition[];
  conditionsOperator: 'AND' | 'OR';
  serveVariationKey: string;
  priority: number;
}

export interface TargetingConfig {
  rules: TargetingRule[];
  defaultServeVariationKey: string;
}

export interface RampStep {
  at: Date;
  percentage: number;
}

export interface RolloutConfig {
  percentage: number;
  bucketByAttribute?: string;
  sticky?: boolean;
  startDate?: Date;
  endDate?: Date;
  rampSchedule?: RampStep[];
}

export interface ExperimentVariant {
  key: string;
  name: string;
  weight: number;
  value: FlagValueType;
  isControl?: boolean;
  description?: string;
}

export interface ExperimentConfig {
  experimentId: string;
  name: string;
  hypothesis?: string;
  variants: ExperimentVariant[];
  trafficAllocation: number;
  bucketByAttribute?: string;
  startDate?: Date;
  endDate?: Date;
  status: ExperimentStatus;
  winnerVariantKey?: string;
  metrics?: string[];
}

export interface FlagVariation {
  key: string;
  name: string;
  value: FlagValueType;
  description?: string;
}

export interface FlagPrerequisite {
  flagKey: string;
  requiredVariationKey: string;
}

export interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description?: string;
  type: FlagType;
  enabled: boolean;
  defaultVariationKey: string;
  offVariationKey: string;
  variations: FlagVariation[];
  targeting?: TargetingConfig;
  rollout?: RolloutConfig;
  experiment?: ExperimentConfig;
  prerequisites?: FlagPrerequisite[];
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

export interface FlagEvaluationResult {
  flagKey: string;
  value: FlagValueType;
  variationKey: string;
  reason: EvaluationReason;
  ruleId?: string;
  experimentId?: string;
  experimentVariantKey?: string;
  timestamp: Date;
}

export interface ExperimentResult {
  experimentId: string;
  variantKey: string;
  value: FlagValueType;
  isControl: boolean;
}

export interface FlagAnalyticsEvent {
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

export interface FlagEvaluationStats {
  flagKey: string;
  totalEvaluations: number;
  evaluationsByVariation: Record<string, number>;
  evaluationsByReason: Record<string, number>;
  uniqueUsers: number;
  errorRate: number;
}

export interface ExperimentVariantStats {
  variantKey: string;
  impressions: number;
  conversions: number;
  conversionRate: number;
  isControl: boolean;
}

export interface ExperimentStats {
  experimentId: string;
  totalImpressions: number;
  variants: Record<string, ExperimentVariantStats>;
}

export interface FlagSummary {
  flagKey: string;
  totalEvaluations: number;
  lastEvaluatedAt?: Date;
}
