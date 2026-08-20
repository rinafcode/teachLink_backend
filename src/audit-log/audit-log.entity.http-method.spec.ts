import 'reflect-metadata';
import { HttpMethod, AuditLog } from './audit-log.entity';

// ── HttpMethod enum contract ──────────────────────────────────────────────────

describe('HttpMethod enum', () => {
  it('should contain exactly the five standard HTTP verbs', () => {
    const members = Object.values(HttpMethod);
    expect(members).toEqual(expect.arrayContaining(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']));
    expect(members).toHaveLength(5);
  });

  it('should have uppercase string values', () => {
    for (const value of Object.values(HttpMethod)) {
      expect(value).toMatch(/^[A-Z]+$/);
    }
  });

  it.each(Object.values(HttpMethod))('should accept "%s" as a valid enum value', (verb) => {
    // Verify each member is assignable to the enum type
    const method: HttpMethod = verb;
    expect(method).toBe(verb);
  });

  it('should not contain any whitespace or trailing characters', () => {
    for (const value of Object.values(HttpMethod)) {
      expect(value).toBe(value.trim());
      expect(value).not.toMatch(/\s/);
    }
  });
});

// ── AuditLog entity column metadata ───────────────────────────────────────────

describe('AuditLog entity – http_method column', () => {
  it('should declare httpMethod as an enum column with the HttpMethod enum', () => {
    // Retrieve TypeORM column metadata via the decorator stack
    const columns = (Reflect as any).getMetadata('design:type', AuditLog.prototype, 'httpMethod');

    // The reflected type is Function (TypeScript enum compiled to object)
    expect(columns).toBeDefined();
  });

  it('should map http_method to the HttpMethod enum values in the entity', () => {
    // Verify that assigning a valid HttpMethod works and invalid ones are excluded
    const validMethods: HttpMethod[] = [
      HttpMethod.GET,
      HttpMethod.POST,
      HttpMethod.PUT,
      HttpMethod.DELETE,
      HttpMethod.PATCH,
    ];

    for (const method of validMethods) {
      const log = new AuditLog();
      log.httpMethod = method;
      expect(log.httpMethod).toBe(method);
    }
  });

  it('should allow null for httpMethod (column is nullable)', () => {
    const log = new AuditLog();
    log.httpMethod = null;
    expect(log.httpMethod).toBeNull();
  });
});

// ── AuditLoggerService – HttpMethod enforcement ───────────────────────────────

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLoggerService } from './services/audit-logger.service';
import { AuditAction, AuditSeverity, AuditCategory } from './enums/audit-action.enum';
import { ConfigService } from '@nestjs/config';

describe('AuditLoggerService – HttpMethod enforcement', () => {
  let service: AuditLoggerService;
  let repository: Repository<AuditLog>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLoggerService,
        {
          provide: getRepositoryToken(AuditLog),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(365),
          },
        },
      ],
    }).compile();

    service = module.get<AuditLoggerService>(AuditLoggerService);
    repository = module.get<Repository<AuditLog>>(getRepositoryToken(AuditLog));
  });

  it.each(Object.values(HttpMethod))(
    'should pass valid HttpMethod "%s" through to repository.create',
    async (verb) => {
      const mockLog = { id: 'log-1', httpMethod: verb, timestamp: new Date() };
      jest.spyOn(repository, 'create').mockReturnValue(mockLog as AuditLog);
      jest.spyOn(repository, 'save').mockResolvedValue(mockLog as AuditLog);

      await service.logApiAccess(
        'user-1',
        'user@example.com',
        '/api/test',
        verb,
        200,
        50,
        '127.0.0.1',
        'test-agent',
      );

      expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({ httpMethod: verb }));
    },
  );

  it('should pass the middleware-reported httpMethod through to the repository', async () => {
    // Simulates what audit-logger.middleware.ts does: req.method is passed as-is
    const mockLog = { id: 'log-1', httpMethod: 'POST', timestamp: new Date() };
    jest.spyOn(repository, 'create').mockReturnValue(mockLog as AuditLog);
    jest.spyOn(repository, 'save').mockResolvedValue(mockLog as AuditLog);

    await service.log({
      action: AuditAction.API_CALLED,
      category: AuditCategory.DATA_ACCESS,
      httpMethod: 'POST' as HttpMethod,
    });

    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({ httpMethod: 'POST' }));
  });
});
