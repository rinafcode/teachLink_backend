import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Permission } from '../entities/permission.entity';

@Injectable()
export class PermissionsService {
  constructor(
    @InjectRepository(Permission)
    private readonly permissionRepository: Repository<Permission>,
  ) {}

  async createPermission(
    resource: string,
    action: string,
    description?: string,
  ): Promise<Permission> {
    const permission = this.permissionRepository.create({
      resource,
      action,
      description,
    });
    return this.permissionRepository.save(permission);
  }

  async findAllPermissions(): Promise<Permission[]> {
    return this.permissionRepository.find();
  }

  async findPermissionById(id: string): Promise<Permission> {
    const permission = await this.permissionRepository.findOneBy({ id });
    if (!permission) {
      throw new NotFoundException(`Permission with ID ${id} not found`);
    }
    return permission;
  }

  async updatePermission(
    id: string,
    resource: string,
    action: string,
    description?: string,
  ): Promise<Permission> {
    await this.permissionRepository.update(id, { resource, action, description });
    const updated = await this.permissionRepository.findOneBy({ id });
    if (!updated) {
      throw new NotFoundException(`Permission with ID ${id} not found`);
    }
    return updated;
  }

  async deletePermission(id: string): Promise<void> {
    const result = await this.permissionRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Permission with ID ${id} not found`);
    }
  }
}
