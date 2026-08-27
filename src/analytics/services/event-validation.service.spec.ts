import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { EventValidationService } from './event-validation.service';
import { EventType } from '../entities/event.entity';

const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000';

describe('EventValidationService', () => {
  let service: EventValidationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EventValidationService],
    }).compile();

    service = module.get<EventValidationService>(EventValidationService);
  });

  describe('validateEvent', () => {
    it('fails when eventType is missing', () => {
      const result = service.validateEvent({});
      expect(result).toEqual({ valid: false, errors: ['eventType is required'] });
    });

    it('allows an event type with no registered schema', () => {
      const result = service.validateEvent({ eventType: EventType.LESSON_COMPLETE });
      expect(result).toEqual({ valid: true, errors: [] });
    });

    it('reports every missing required field', () => {
      const result = service.validateEvent({ eventType: EventType.SIGNUP });
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          'Required field missing: userId',
          'Required field missing: category',
          'Required field missing: action',
        ]),
      );
    });

    it('passes a well-formed event that satisfies its schema', () => {
      const result = service.validateEvent({
        eventType: EventType.SIGNUP,
        userId: VALID_UUID,
        category: 'auth',
        action: 'signup',
      } as any);
      expect(result).toEqual({ valid: true, errors: [] });
    });

    it('fails custom validation when userId is not a valid UUID', () => {
      const result = service.validateEvent({
        eventType: EventType.LOGIN,
        userId: 'not-a-uuid',
        category: 'auth',
        action: 'login',
      } as any);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Custom validation failed');
    });

    it('enforces minValue constraints', () => {
      const result = service.validateEvent({
        eventType: EventType.PURCHASE,
        userId: VALID_UUID,
        category: 'commerce',
        action: 'purchase',
        value: -5,
        properties: { courseId: VALID_UUID },
      } as any);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Value -5 is below minimum 0');
    });

    it('enforces maxValue constraints', () => {
      service.registerSchema({
        eventType: EventType.CUSTOM,
        requiredFields: ['category', 'action'],
        optionalFields: [],
        valueConstraints: { maxValue: 10 },
      });

      const result = service.validateEvent({
        eventType: EventType.CUSTOM,
        category: 'c',
        action: 'a',
        value: 20,
      } as any);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Value 20 exceeds maximum 10');
    });

    it('enforces allowedValues constraints', () => {
      service.registerSchema({
        eventType: EventType.CUSTOM,
        requiredFields: ['category', 'action'],
        optionalFields: [],
        valueConstraints: { allowedValues: [1, 2, 3] },
      });

      const result = service.validateEvent({
        eventType: EventType.CUSTOM,
        category: 'c',
        action: 'a',
        value: 99,
      } as any);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Value 99 is not in allowed values');
    });

    it('accumulates multiple distinct validation errors', () => {
      const result = service.validateEvent({
        eventType: EventType.PURCHASE,
        value: -1,
      } as any);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });

  describe('validateEventOrThrow', () => {
    it('does not throw for a valid event', () => {
      expect(() =>
        service.validateEventOrThrow({
          eventType: EventType.CUSTOM,
          category: 'c',
          action: 'a',
        } as any),
      ).not.toThrow();
    });

    it('throws BadRequestException with the collected errors for an invalid event', () => {
      expect(() => service.validateEventOrThrow({} as any)).toThrow(BadRequestException);
      expect(() => service.validateEventOrThrow({} as any)).toThrow(/eventType is required/);
    });
  });

  describe('registerSchema / getSchema', () => {
    it('registers a new schema and makes it retrievable', () => {
      const schema = {
        eventType: EventType.WISHLIST_ADD,
        requiredFields: ['userId'],
        optionalFields: [],
      };
      service.registerSchema(schema);

      expect(service.getSchema(EventType.WISHLIST_ADD)).toEqual(schema);
    });

    it('overwrites a previously registered schema for the same event type', () => {
      const original = service.getSchema(EventType.SIGNUP);
      expect(original).toBeDefined();

      const replacement = {
        eventType: EventType.SIGNUP,
        requiredFields: [],
        optionalFields: [],
      };
      service.registerSchema(replacement);

      expect(service.getSchema(EventType.SIGNUP)).toEqual(replacement);
    });

    it('returns undefined for an event type with no schema', () => {
      expect(service.getSchema(EventType.LESSON_COMPLETE)).toBeUndefined();
    });
  });
});
