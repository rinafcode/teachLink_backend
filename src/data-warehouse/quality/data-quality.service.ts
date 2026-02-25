import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

export interface DataQualityProfile {
  id: string;
  name: string;
  description: string;
  rules: DataQualityRule[];
  createdAt: Date;
  updatedAt: Date;
}

export interface DataQualityRule {
  id: string;
  name: string;
  description: string;
  type: 'completeness' | 'accuracy' | 'consistency' | 'uniqueness' | 'validity' | 'timeliness';
  field: string;
  condition: string;
  threshold: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

export interface DataQualityCheck {
  id: string;
  profileId: string;
  startTime: Date;
  endTime?: Date;
  status: 'pending' | 'running' | 'completed' | 'failed';
  results: DataQualityResult[];
  summary: DataQualitySummary;
}

export interface DataQualityResult {
  ruleId: string;
  ruleName: string;
  passed: boolean;
  actualValue: number;
  expectedValue: number;
  message: string;
  sampleData?: any[];
}

export interface DataQualitySummary {
  totalRules: number;
  passedRules: number;
  failedRules: number;
  overallScore: number;
  criticalFailures: number;
  issuesBySeverity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

export interface DataQualityIssue {
  id: string;
  profileId: string;
  ruleId: string;
  severity: string;
  description: string;
  affectedRecords: number;
  sampleRecords: any[];
  createdAt: Date;
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
}

@Injectable()
export class DataQualityService {
  private readonly logger = new Logger(DataQualityService.name);
  private profiles: Map<string, DataQualityProfile> = new Map();
  private checks: Map<string, DataQualityCheck> = new Map();
  private issues: Map<string, DataQualityIssue> = new Map();

  /**
   * Create a data quality profile
   */
  async createProfile(profileConfig: Omit<DataQualityProfile, 'id' | 'createdAt' | 'updatedAt'>): Promise<DataQualityProfile> {
    const profileId = uuidv4();
    const profile: DataQualityProfile = {
      id: profileId,
      ...profileConfig,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.profiles.set(profileId, profile);
    this.logger.log(`Created data quality profile ${profileId}: ${profile.name}`);

    return profile;
  }

  /**
   * Get a data quality profile
   */
  async getProfile(profileId: string): Promise<DataQualityProfile | null> {
    return this.profiles.get(profileId) || null;
  }

  /**
   * Get all data quality profiles
   */
  async getAllProfiles(): Promise<DataQualityProfile[]> {
    return Array.from(this.profiles.values());
  }

  /**
   * Update a data quality profile
   */
  async updateProfile(profileId: string, updates: Partial<DataQualityProfile>): Promise<DataQualityProfile | null> {
    const profile = this.profiles.get(profileId);
    if (!profile) {
      return null;
    }

    const updatedProfile = {
      ...profile,
      ...updates,
      updatedAt: new Date(),
    };

    this.profiles.set(profileId, updatedProfile);
    this.logger.log(`Updated data quality profile ${profileId}`);

    return updatedProfile;
  }

  /**
   * Delete a data quality profile
   */
  async deleteProfile(profileId: string): Promise<boolean> {
    const exists = this.profiles.has(profileId);
    if (exists) {
      this.profiles.delete(profileId);
      this.logger.log(`Deleted data quality profile ${profileId}`);
    }
    return exists;
  }

  /**
   * Run data quality checks
   */
  async runQualityChecks(profileId: string, data: any[]): Promise<DataQualityCheck> {
    const profile = this.profiles.get(profileId);
    if (!profile) {
      throw new Error(`Profile ${profileId} not found`);
    }

    const checkId = uuidv4();
    const check: DataQualityCheck = {
      id: checkId,
      profileId,
      startTime: new Date(),
      status: 'running',
      results: [],
      summary: {
        totalRules: 0,
        passedRules: 0,
        failedRules: 0,
        overallScore: 0,
        criticalFailures: 0,
        issuesBySeverity: {
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
        },
      },
    };

    this.checks.set(checkId, check);

    try {
      // Execute each rule
      const results: DataQualityResult[] = [];
      let passedRules = 0;
      let failedRules = 0;
      let criticalFailures = 0;
      const issuesBySeverity = { critical: 0, high: 0, medium: 0, low: 0 };

      for (const rule of profile.rules) {
        const result = await this.executeRule(rule, data);
        results.push(result);

        if (result.passed) {
          passedRules++;
        } else {
          failedRules++;
          
          // Count severity issues
          issuesBySeverity[rule.severity]++;
          
          if (rule.severity === 'critical') {
            criticalFailures++;
          }

          // Create quality issue record
          await this.createQualityIssue(profileId, rule, result, data);
        }
      }

      // Calculate overall score
      const overallScore = profile.rules.length > 0 ? (passedRules / profile.rules.length) * 100 : 0;

      // Update check with results
      check.results = results;
      check.status = 'completed';
      check.endTime = new Date();
      check.summary = {
        totalRules: profile.rules.length,
        passedRules,
        failedRules,
        overallScore,
        criticalFailures,
        issuesBySeverity,
      };

      this.logger.log(`Data quality check ${checkId} completed with score: ${overallScore}%`);

    } catch (error) {
      this.logger.error(`Data quality check ${checkId} failed: ${error.message}`);
      check.status = 'failed';
      check.endTime = new Date();
    }

    return check;
  }

  /**
   * Get quality check results
   */
  async getCheckResults(checkId: string): Promise<DataQualityCheck | null> {
    return this.checks.get(checkId) || null;
  }

  /**
   * Get all quality checks for a profile
   */
  async getChecksForProfile(profileId: string): Promise<DataQualityCheck[]> {
    const checks = Array.from(this.checks.values());
    return checks.filter(check => check.profileId === profileId);
  }

  /**
   * Create a quality issue
   */
  private async createQualityIssue(
    profileId: string,
    rule: DataQualityRule,
    result: DataQualityResult,
    data: any[]
  ): Promise<DataQualityIssue> {
    const issueId = uuidv4();
    const issue: DataQualityIssue = {
      id: issueId,
      profileId,
      ruleId: rule.id,
      severity: rule.severity,
      description: result.message,
      affectedRecords: result.sampleData?.length || 0,
      sampleRecords: result.sampleData || [],
      createdAt: new Date(),
      resolved: false,
    };

    this.issues.set(issueId, issue);
    this.logger.log(`Created quality issue ${issueId} for rule ${rule.name}`);

    return issue;
  }

  /**
   * Get quality issues
   */
  async getQualityIssues(
    profileId?: string,
    severity?: string,
    resolved?: boolean
  ): Promise<DataQualityIssue[]> {
    let issues = Array.from(this.issues.values());

    if (profileId) {
      issues = issues.filter(issue => issue.profileId === profileId);
    }

    if (severity) {
      issues = issues.filter(issue => issue.severity === severity);
    }

    if (resolved !== undefined) {
      issues = issues.filter(issue => issue.resolved === resolved);
    }

    return issues;
  }

  /**
   * Resolve a quality issue
   */
  async resolveIssue(issueId: string, resolvedBy: string): Promise<boolean> {
    const issue = this.issues.get(issueId);
    if (!issue || issue.resolved) {
      return false;
    }

    issue.resolved = true;
    issue.resolvedAt = new Date();
    issue.resolvedBy = resolvedBy;

    this.logger.log(`Resolved quality issue ${issueId} by ${resolvedBy}`);
    return true;
  }

  /**
   * Create standard quality profiles
   */
  async createStandardProfiles(): Promise<DataQualityProfile[]> {
    const profiles: DataQualityProfile[] = [];

    // Completeness profile
    profiles.push(await this.createProfile({
      name: 'Completeness Check',
      description: 'Check for missing or null values in critical fields',
      rules: [
        {
          id: uuidv4(),
          name: 'User Email Completeness',
          description: 'Ensure user email addresses are not null or empty',
          type: 'completeness',
          field: 'email',
          condition: 'not null',
          threshold: 99.5,
          severity: 'high',
        },
        {
          id: uuidv4(),
          name: 'Post Content Completeness',
          description: 'Ensure post content is not empty',
          type: 'completeness',
          field: 'content',
          condition: 'not empty',
          threshold: 98,
          severity: 'medium',
        },
      ],
    }));

    // Uniqueness profile
    profiles.push(await this.createProfile({
      name: 'Uniqueness Check',
      description: 'Check for duplicate or duplicate-like values',
      rules: [
        {
          id: uuidv4(),
          name: 'User ID Uniqueness',
          description: 'Ensure user IDs are unique',
          type: 'uniqueness',
          field: 'id',
          condition: 'unique',
          threshold: 100,
          severity: 'critical',
        },
        {
          id: uuidv4(),
          name: 'Email Uniqueness',
          description: 'Ensure email addresses are unique',
          type: 'uniqueness',
          field: 'email',
          condition: 'unique',
          threshold: 99.9,
          severity: 'high',
        },
      ],
    }));

    // Validity profile
    profiles.push(await this.createProfile({
      name: 'Validity Check',
      description: 'Check data against business rules and constraints',
      rules: [
        {
          id: uuidv4(),
          name: 'Email Format Validation',
          description: 'Validate email format',
          type: 'validity',
          field: 'email',
          condition: 'valid email format',
          threshold: 99,
          severity: 'high',
        },
        {
          id: uuidv4(),
          name: 'Date Range Validation',
          description: 'Validate dates are within reasonable ranges',
          type: 'validity',
          field: 'created_at',
          condition: 'within last 5 years',
          threshold: 99.5,
          severity: 'medium',
        },
      ],
    }));

    return profiles;
  }

  /**
   * Execute a single quality rule
   */
  private async executeRule(rule: DataQualityRule, data: any[]): Promise<DataQualityResult> {
    let passed = true;
    let actualValue = 0;
    let sampleData: any[] = [];
    let message = '';

    switch (rule.type) {
      case 'completeness':
        actualValue = this.calculateCompleteness(data, rule.field);
        passed = actualValue >= rule.threshold;
        message = `Completeness of ${rule.field}: ${actualValue.toFixed(2)}% (threshold: ${rule.threshold}%)`;
        if (!passed) {
          sampleData = data.filter(item => !item[rule.field] || item[rule.field] === '');
        }
        break;

      case 'uniqueness':
        actualValue = this.calculateUniqueness(data, rule.field);
        passed = actualValue >= rule.threshold;
        message = `Uniqueness of ${rule.field}: ${actualValue.toFixed(2)}% (threshold: ${rule.threshold}%)`;
        if (!passed) {
          const duplicates = this.findDuplicates(data, rule.field);
          sampleData = duplicates.slice(0, 10); // Sample first 10 duplicates
        }
        break;

      case 'validity':
        actualValue = this.calculateValidity(data, rule.field, rule.condition);
        passed = actualValue >= rule.threshold;
        message = `Validity of ${rule.field}: ${actualValue.toFixed(2)}% (threshold: ${rule.threshold}%)`;
        if (!passed) {
          sampleData = data.filter(item => !this.isValid(item[rule.field], rule.condition)).slice(0, 10);
        }
        break;

      default:
        actualValue = 100;
        message = `Rule type ${rule.type} not implemented`;
    }

    return {
      ruleId: rule.id,
      ruleName: rule.name,
      passed,
      actualValue,
      expectedValue: rule.threshold,
      message,
      sampleData,
    };
  }

  // Helper methods for quality calculations
  private calculateCompleteness(data: any[], field: string): number {
    if (data.length === 0) return 100;
    const completeCount = data.filter(item => item[field] !== null && item[field] !== undefined && item[field] !== '').length;
    return (completeCount / data.length) * 100;
  }

  private calculateUniqueness(data: any[], field: string): number {
    if (data.length === 0) return 100;
    const uniqueValues = new Set(data.map(item => item[field]));
    return (uniqueValues.size / data.length) * 100;
  }

  private calculateValidity(data: any[], field: string, condition: string): number {
    if (data.length === 0) return 100;
    const validCount = data.filter(item => this.isValid(item[field], condition)).length;
    return (validCount / data.length) * 100;
  }

  private isValid(value: any, condition: string): boolean {
    if (value === null || value === undefined) return false;

    switch (condition) {
      case 'not null':
        return value !== null && value !== undefined;
      case 'not empty':
        return value !== '' && value !== null && value !== undefined;
      case 'valid email format':
        return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      case 'within last 5 years':
        const date = new Date(value);
        const fiveYearsAgo = new Date();
        fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
        return date >= fiveYearsAgo;
      default:
        return true;
    }
  }

  private findDuplicates(data: any[], field: string): any[] {
    const seen = new Map();
    const duplicates: any[] = [];

    data.forEach(item => {
      const value = item[field];
      if (seen.has(value)) {
        if (seen.get(value) === 1) {
          duplicates.push(seen.get('items')[0]);
        }
        duplicates.push(item);
        seen.set(value, (seen.get(value) || 0) + 1);
      } else {
        seen.set(value, 1);
        seen.set('items', [item]);
      }
    });

    return duplicates;
  }
}