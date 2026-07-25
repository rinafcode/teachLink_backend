import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { Role } from '../entities/role.entity';
import { RolesService } from './roles.service';
import { User } from '../../users/entities/user.entity';

describe('RolesService', () => {
  let service: RolesService;
  let roleRepository: Repository<Role>;
  let userRepository: Repository<User>;
  let auditLogService: AuditLogService;

  const auditLogMock = {
    log: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesService,
        {
          provide: getRepositoryToken(Role),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            softDelete: jest.fn(),
            restore: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            count: jest.fn(),
          },
        },
        {
          provide: AuditLogService,
          useValue: auditLogMock,
        },
      ],
    }).compile();

    service = module.get(RolesService);
    roleRepository = module.get(getRepositoryToken(Role));
    userRepository = module.get(getRepositoryToken(User));
    auditLogService = module.get(AuditLogService);
    jest.clearAllMocks();
  });

  it('throws a conflict when the role is in use', async () => {
    const role = {
      id: 'role-1',
      name: 'moderator',
      isSystem: false,
      permissions: ['content:write'],
      deletedAt: null,
    } as Role;

    jest.spyOn(roleRepository, 'findOne').mockResolvedValue(role);
    jest.spyOn(userRepository, 'count').mockResolvedValue(3);

    await expect(service.deleteRole('role-1')).rejects.toBeInstanceOf(ConflictException);
    expect(userRepository.count).toHaveBeenCalledWith({
      where: { role: 'moderator', deletedAt: expect.any(Object) },
    });
    expect(auditLogService.log).not.toHaveBeenCalled();
    expect(roleRepository.softDelete).not.toHaveBeenCalled();
  });

  it('blocks deletion for built-in system roles', async () => {
    const role = {
      id: 'role-2',
      name: 'admin',
      isSystem: true,
      permissions: ['*'],
      deletedAt: null,
    } as Role;

    jest.spyOn(roleRepository, 'findOne').mockResolvedValue(role);

    await expect(service.deleteRole('role-2')).rejects.toBeInstanceOf(ConflictException);
    expect(userRepository.count).not.toHaveBeenCalled();
    expect(roleRepository.softDelete).not.toHaveBeenCalled();
    expect(auditLogService.log).not.toHaveBeenCalled();
  });

  it('soft-deletes and restores a role without losing permissions', async () => {
    const deletedRole = {
      id: 'role-3',
      name: 'mentor',
      isSystem: false,
      permissions: ['session:read', 'session:write'],
      deletedAt: new Date('2026-01-01T00:00:00.000Z'),
    } as Role;

    const restoredRole = {
      ...deletedRole,
      deletedAt: null,
    } as Role;

    jest
      .spyOn(roleRepository, 'findOne')
      .mockResolvedValueOnce(deletedRole)
      .mockResolvedValueOnce(deletedRole)
      .mockResolvedValueOnce(deletedRole)
      .mockResolvedValueOnce(restoredRole);
    jest.spyOn(userRepository, 'count').mockResolvedValue(0);
    jest.spyOn(roleRepository, 'softDelete').mockResolvedValue({ affected: 1, raw: {} });
    jest.spyOn(roleRepository, 'restore').mockResolvedValue({ affected: 1, raw: {} });
    auditLogMock.log.mockResolvedValue({} as never);

    const deleted = await service.deleteRole('role-3');

    expect(roleRepository.softDelete).toHaveBeenCalledWith('role-3');
    expect(auditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'Role',
        entityId: 'role-3',
        metadata: expect.objectContaining({
          affectedAssignments: 0,
        }),
      }),
    );
    expect(deleted.permissions).toEqual(deletedRole.permissions);

    const restored = await service.restoreRole('role-3');

    expect(roleRepository.restore).toHaveBeenCalledWith('role-3');
    expect(restored.permissions).toEqual(deletedRole.permissions);
    expect(restored.deletedAt).toBeNull();
  });

  it('throws if the role does not exist', async () => {
    jest.spyOn(roleRepository, 'findOne').mockResolvedValue(null);

    await expect(service.deleteRole('missing-role')).rejects.toBeInstanceOf(NotFoundException);
  });
});
