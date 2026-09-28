import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { EventType, AnalyticsEvent } from '../entities/event.entity';

export interface EventSchema {
  eventType: EventType;
  requiredFields: string[];
  optionalFields: string[];
  valueConstraints?: {
    minValue?: number;
    maxValue?: number;
    allowedValues?: (string | number)[];
  };
  customValidation?: (event: any) => boolean;
}

/**
 * Manages event validation schemas and enforces event contracts
 */
@Injectable()
export class EventValidationService {
  private readonly logger = new Logger(EventValidationService.name);
  private schemas: Map<EventType, EventSchema> = new Map();

  constructor() {
    this.initializeSchemas();
  }

  /**
   * Initialize standard event schemas
   */
  private initializeSchemas(): void {
    this.registerSchema({
      eventType: EventType.SIGNUP,
      requiredFields: ['userId', 'category', 'action'],
      optionalFields: ['properties', 'ipAddress', 'userAgent'],
      customValidation: (event) => {
        // User ID should be a valid UUID
        return this.isValidUUID(event.userId);
      },
    });

    this.registerSchema({
      eventType: EventType.LOGIN,
      requiredFields: ['userId', 'category', 'action'],
      optionalFields: ['properties', 'ipAddress', 'userAgent'],
      customValidation: (event) => this.isValidUUID(event.userId),
    });

    this.registerSchema({
      eventType: EventType.COURSE_VIEW,
      requiredFields: ['userId', 'category', 'action', 'properties'],
      optionalFields: ['label', 'value'],
      customValidation: (event) => {
        return (
          this.isValidUUID(event.userId) &&
          event.properties &&
          event.properties.courseId &&
          this.isValidUUID(event.properties.courseId)
        );
      },
    });

    this.registerSchema({
      eventType: EventType.PURCHASE,
      requiredFields: ['userId', 'category', 'action', 'value', 'properties'],
      optionalFields: ['label'],
      valueConstraints: {
        minValue: 0,
      },
      customValidation: (event) => {
        return (
          this.isValidUUID(event.userId) &&
          event.properties &&
          event.properties.courseId &&
          event.value > 0
        );
      },
    });

    this.registerSchema({
      eventType: EventType.COURSE_ENROLL,
      requiredFields: ['userId', 'category', 'action', 'properties'],
      optionalFields: ['value'],
      customValidation: (event) => {
        return (
          this.isValidUUID(event.userId) &&
          event.properties &&
          event.properties.courseId &&
          this.isValidUUID(event.properties.courseId)
        );
      },
    });

    this.registerSchema({
      eventType: EventType.SEARCH,
      requiredFields: ['category', 'action', 'properties'],
      optionalFields: ['userId', 'value'],
      customValidation: (event) => {
        return event.properties && event.properties.query;
      },
    });

    this.registerSchema({
      eventType: EventType.CUSTOM,
      requiredFields: ['category', 'action'],
      optionalFields: ['userId', 'label', 'value', 'properties'],
    });
  }

  /**
   * Register a custom event schema
   */
  registerSchema(schema: EventSchema): void {
    this.schemas.set(schema.eventType, schema);
    this.logger.debug(`Registered schema for event type: ${schema.eventType}`);
  }

  /**
   * Validate an event against its schema
   */
  validateEvent(event: Partial<AnalyticsEvent>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!event.eventType) {
      return { valid: false, errors: ['eventType is required'] };
    }

    const schema = this.schemas.get(event.eventType);
    if (!schema) {
      // If no schema registered, allow the event but log warning
      this.logger.warn(`No schema registered for event type: ${event.eventType}`);
      return { valid: true, errors: [] };
    }

    // Check required fields
    for (const field of schema.requiredFields) {
      if (!event[field as keyof typeof event]) {
        errors.push(`Required field missing: ${field}`);
      }
    }

    // Check value constraints
    if (schema.valueConstraints && event.value !== undefined) {
      if (
        schema.valueConstraints.minValue !== undefined &&
        event.value < schema.valueConstraints.minValue
      ) {
        errors.push(`Value ${event.value} is below minimum ${schema.valueConstraints.minValue}`);
      }

      if (
        schema.valueConstraints.maxValue !== undefined &&
        event.value > schema.valueConstraints.maxValue
      ) {
        errors.push(`Value ${event.value} exceeds maximum ${schema.valueConstraints.maxValue}`);
      }

      if (
        schema.valueConstraints.allowedValues &&
        !schema.valueConstraints.allowedValues.includes(event.value)
      ) {
        errors.push(`Value ${event.value} is not in allowed values`);
      }
    }

    // Run custom validation
    if (schema.customValidation && !schema.customValidation(event)) {
      errors.push('Custom validation failed');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate and throw if invalid
   */
  validateEventOrThrow(event: Partial<AnalyticsEvent>): void {
    const validation = this.validateEvent(event);
    if (!validation.valid) {
      throw new BadRequestException(`Event validation failed: ${validation.errors.join(', ')}`);
    }
  }

  /**
   * Get schema for event type
   */
  getSchema(eventType: EventType): EventSchema | undefined {
    return this.schemas.get(eventType);
  }

  private isValidUUID(value: any): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return typeof value === 'string' && uuidRegex.test(value);
  }
}
