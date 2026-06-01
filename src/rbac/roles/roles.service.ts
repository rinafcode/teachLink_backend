import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '../entities/role.entity';
import { Permission } from '../entities/permission.entity';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(Permission)
    private readonly permissionRepository: Repository<Permission>,
  ) {}

  async createRole(name: string, description?: string, permissionIds?: string[]): Promise<Role> {
    const role = this.roleRepository.create({
      name,
      description,
    });

    if (permissionIds && permissionIds.length > 0) {
      const permissions = await this.permissionRepository.findByIds(permissionIds);
      role.permissions = permissions;
    }

    return this.roleRepository.save(role);
  }

  async findAllRoles(): Promise<Role[]> {
    return this.roleRepository.find({ relations: ['permissions'] });
  }

  async findRoleById(id: string): Promise<Role> {
    const role = await this.roleRepository.findOne({ where: { id }, relations: ['permissions'] });
    if (!role) {
      throw new NotFoundException(`Role with ID ${id} not found`);
    }
    return role;
  }

  async updateRole(
    id: string,
    name: string,
    description?: string,
    permissionIds?: string[],
  ): Promise<Role> {
    await this.roleRepository.update(id, { name, description });

    if (permissionIds !== undefined) {
      const permissions = await this.permissionRepository.findByIds(permissionIds);
      await this.roleRepository.createQueryBuilder()
        .relation(Role, 'permissions')
        .of(id)
        .set(permissions);
    }

    const updated = await this.roleRepository.findOne({ where: { id }, relations: ['permissions'] });
    if (!updated) {
      throw new NotFoundException(`Role with ID ${id} not found`);
    }
    return updated;
  }

  async deleteRole(id: string): Promise<void> {
    const result = await this.roleRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Role with ID ${id} not found`);
    }
  }

  async addPermissionToRole(roleId: string, permissionId: string): Promise<Role> {
    const role = await this.roleRepository.findOne({ where: { id: roleId }, relations: ['permissions'] });
    if (!role) {
      throw new NotFoundException(`Role with ID ${roleId} not found`);
    }

    const permission = await this.permissionRepository.findOneBy({ id: permissionId });
    if (!permission) {
      throw new NotFoundException(`Permission with ID ${permissionId} not found`);
    }

    if (!role.permissions.some(p => p.id === permission.id)) {
      role.permissions.push(permission);
      await this.roleRepository.save(role);
    }

    return role;
  }

  async removePermissionFromRole(roleId: string, permissionId: string): Promise<Role> {
    const role = await this.roleRepository.findOne({ where: { id: roleId }, relations: ['permissions'] });
    if (!role) {
      throw new NotFoundException(`Role with ID ${roleId} not found`);
    }

    role.permissions = role.permissions.filter(p => p.id !== permissionId);
    await this.roleRepository.save(role);

    return role;
  }
}