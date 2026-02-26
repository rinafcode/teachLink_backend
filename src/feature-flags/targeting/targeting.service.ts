import { Injectable } from '@nestjs/common';
import {
  ConditionOperator,
  FlagValueType,
  TargetingCondition,
  TargetingConfig,
  TargetingRule,
  UserContext,
} from '../interfaces';

@Injectable()
export class TargetingService {
  /**
   * Evaluates targeting rules against a user context.
   * Returns the matched variation key, or null if no rule matches.
   */
  evaluateTargeting(config: TargetingConfig, userContext: UserContext): string | null {
    const sortedRules = [...config.rules].sort((a, b) => a.priority - b.priority);

    for (const rule of sortedRules) {
      if (this.evaluateRule(rule, userContext)) {
        return rule.serveVariationKey;
      }
    }

    return null;
  }

  private evaluateRule(rule: TargetingRule, userContext: UserContext): boolean {
    if (!rule.conditions || rule.conditions.length === 0) return false;

    if (rule.conditionsOperator === 'OR') {
      return rule.conditions.some((c) => this.evaluateCondition(c, userContext));
    }

    return rule.conditions.every((c) => this.evaluateCondition(c, userContext));
  }

  private evaluateCondition(condition: TargetingCondition, userContext: UserContext): boolean {
    const attributeValue = this.resolveAttribute(condition.attribute, userContext);

    return this.applyOperator(condition.operator, attributeValue, condition.value);
  }

  private applyOperator(
    operator: ConditionOperator,
    attributeValue: unknown,
    conditionValue?: FlagValueType | FlagValueType[],
  ): boolean {
    switch (operator) {
      case 'exists':
        return attributeValue !== null && attributeValue !== undefined;

      case 'notExists':
        return attributeValue === null || attributeValue === undefined;

      case 'equals':
        return String(attributeValue) === String(conditionValue);

      case 'notEquals':
        return String(attributeValue) !== String(conditionValue);

      case 'contains':
        return (
          typeof attributeValue === 'string' &&
          typeof conditionValue === 'string' &&
          attributeValue.toLowerCase().includes(conditionValue.toLowerCase())
        );

      case 'notContains':
        return (
          typeof attributeValue === 'string' &&
          typeof conditionValue === 'string' &&
          !attributeValue.toLowerCase().includes(conditionValue.toLowerCase())
        );

      case 'startsWith':
        return (
          typeof attributeValue === 'string' &&
          typeof conditionValue === 'string' &&
          attributeValue.toLowerCase().startsWith(conditionValue.toLowerCase())
        );

      case 'endsWith':
        return (
          typeof attributeValue === 'string' &&
          typeof conditionValue === 'string' &&
          attributeValue.toLowerCase().endsWith(conditionValue.toLowerCase())
        );

      case 'greaterThan':
        return Number(attributeValue) > Number(conditionValue);

      case 'greaterThanOrEqual':
        return Number(attributeValue) >= Number(conditionValue);

      case 'lessThan':
        return Number(attributeValue) < Number(conditionValue);

      case 'lessThanOrEqual':
        return Number(attributeValue) <= Number(conditionValue);

      case 'in':
        if (!Array.isArray(conditionValue)) return false;
        return conditionValue.map(String).includes(String(attributeValue));

      case 'notIn':
        if (!Array.isArray(conditionValue)) return false;
        return !conditionValue.map(String).includes(String(attributeValue));

      case 'regex':
        if (typeof conditionValue !== 'string' || typeof attributeValue !== 'string') {
          return false;
        }
        try {
          return new RegExp(conditionValue).test(attributeValue);
        } catch {
          return false;
        }

      default:
        return false;
    }
  }

  /**
   * Resolves an attribute name from the user context.
   * Checks top-level properties first, then custom attributes map.
   */
  private resolveAttribute(attribute: string, userContext: UserContext): unknown {
    const topLevel: Record<string, unknown> = {
      userId: userContext.userId,
      email: userContext.email,
      country: userContext.country,
      plan: userContext.plan,
      sessionId: userContext.sessionId,
      ipAddress: userContext.ipAddress,
    };

    if (attribute in topLevel) {
      return topLevel[attribute];
    }

    if (attribute === 'roles') {
      return userContext.roles?.join(',') ?? null;
    }

    if (attribute === 'groups') {
      return userContext.groups?.join(',') ?? null;
    }

    if (userContext.attributes && attribute in userContext.attributes) {
      return userContext.attributes[attribute];
    }

    return null;
  }
}
