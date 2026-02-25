import { Injectable, Logger } from '@nestjs/common';

export enum PermissionLevel {
  READ = 'read',
  WRITE = 'write',
  ADMIN = 'admin',
  OWNER = 'owner',
}

export interface ResourcePermission {
  resourceId: string;
  userId: string;
  permission: PermissionLevel;
  grantedAt: Date;
  grantedBy: string;
}

export interface CollaborativeResource {
  id: string;
  type: 'document' | 'whiteboard' | 'project';
  ownerId: string;
  permissions: ResourcePermission[];
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class CollaborationPermissionsService {
  private readonly logger = Logger;
  private resources: Map<string, CollaborativeResource> = new Map();
  private defaultPermission: PermissionLevel = PermissionLevel.READ;

  /**
   * Grant permission to a user for a resource
   */
  async grantAccess(
    resourceId: string,
    userId: string,
    permission: PermissionLevel = PermissionLevel.WRITE,
    grantedBy: string = 'system'
  ): Promise<ResourcePermission> {
    let resource = this.resources.get(resourceId);
    
    if (!resource) {
      resource = {
        id: resourceId,
        type: this.getResourceType(resourceId),
        ownerId: userId,
        permissions: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.resources.set(resourceId, resource);
    }

    // Check if user already has permission
    const existingPermission = resource.permissions.find(p => p.userId === userId);
    
    if (existingPermission) {
      // Update existing permission
      existingPermission.permission = permission;
      existingPermission.grantedAt = new Date();
      existingPermission.grantedBy = grantedBy;
    } else {
      // Add new permission
      const newPermission: ResourcePermission = {
        resourceId,
        userId,
        permission,
        grantedAt: new Date(),
        grantedBy,
      };
      resource.permissions.push(newPermission);
    }

    resource.updatedAt = new Date();

    this.logger.log(`Granted ${permission} permission to user ${userId} for resource ${resourceId}`);

    return this.getUserPermission(resourceId, userId)!;
  }

  /**
   * Revoke permission from a user for a resource
   */
  async revokeAccess(resourceId: string, userId: string): Promise<boolean> {
    const resource = this.resources.get(resourceId);
    if (!resource) {
      return false;
    }

    const initialLength = resource.permissions.length;
    resource.permissions = resource.permissions.filter(p => p.userId !== userId);
    
    if (resource.permissions.length !== initialLength) {
      resource.updatedAt = new Date();
      this.logger.log(`Revoked permission for user ${userId} from resource ${resourceId}`);
      return true;
    }

    return false;
  }

  /**
   * Check if a user has access to a resource
   */
  async hasAccess(resourceId: string, userId: string, requiredPermission: PermissionLevel = PermissionLevel.READ): Promise<boolean> {
    const userPermission = this.getUserPermission(resourceId, userId);
    
    if (!userPermission) {
      return false;
    }

    return this.checkPermissionLevel(userPermission.permission, requiredPermission);
  }

  /**
   * Get user's permission for a resource
   */
  getUserPermission(resourceId: string, userId: string): ResourcePermission | undefined {
    const resource = this.resources.get(resourceId);
    if (!resource) {
      return undefined;
    }

    return resource.permissions.find(p => p.userId === userId);
  }

  /**
   * Get all users with access to a resource
   */
  async getUsersForResource(resourceId: string): Promise<ResourcePermission[]> {
    const resource = this.resources.get(resourceId);
    if (!resource) {
      return [];
    }

    return [...resource.permissions];
  }

  /**
   * Get all resources a user has access to
   */
  async getResourcesForUser(userId: string, minPermission: PermissionLevel = PermissionLevel.READ): Promise<CollaborativeResource[]> {
    const userResources: CollaborativeResource[] = [];

    for (const resource of this.resources.values()) {
      const userPermission = resource.permissions.find(p => p.userId === userId);
      
      if (userPermission && this.checkPermissionLevel(userPermission.permission, minPermission)) {
        userResources.push({ ...resource });
      }
    }

    return userResources;
  }

  /**
   * Update user's permission level
   */
  async updatePermission(
    resourceId: string,
    userId: string,
    newPermission: PermissionLevel,
    updatedBy: string
  ): Promise<ResourcePermission | null> {
    const resource = this.resources.get(resourceId);
    if (!resource) {
      return null;
    }

    const userPermission = resource.permissions.find(p => p.userId === userId);
    if (!userPermission) {
      return null;
    }

    userPermission.permission = newPermission;
    userPermission.grantedAt = new Date();
    userPermission.grantedBy = updatedBy;
    
    resource.updatedAt = new Date();

    this.logger.log(`Updated permission to ${newPermission} for user ${userId} on resource ${resourceId}`);

    return { ...userPermission };
  }

  /**
   * Invite a user to collaborate on a resource
   */
  async inviteUser(
    resourceId: string,
    inviterId: string,
    inviteeId: string,
    permission: PermissionLevel = PermissionLevel.WRITE
  ): Promise<ResourcePermission> {
    // Check if inviter has admin or owner permissions
    const inviterPermission = this.getUserPermission(resourceId, inviterId);
    
    if (!inviterPermission || 
        !this.checkPermissionLevel(inviterPermission.permission, PermissionLevel.ADMIN)) {
      throw new Error(`User ${inviterId} does not have permission to invite users to resource ${resourceId}`);
    }

    return await this.grantAccess(resourceId, inviteeId, permission, inviterId);
  }

  /**
   * Remove a user from a collaboration session
   */
  async removeUser(resourceId: string, removerId: string, userIdToRemove: string): Promise<boolean> {
    // Check if remover has admin or owner permissions
    const removerPermission = this.getUserPermission(resourceId, removerId);
    
    if (!removerPermission || 
        !this.checkPermissionLevel(removerPermission.permission, PermissionLevel.ADMIN)) {
      throw new Error(`User ${removerId} does not have permission to remove users from resource ${resourceId}`);
    }

    // Can't remove the owner
    const resource = this.resources.get(resourceId);
    if (resource && resource.ownerId === userIdToRemove) {
      throw new Error(`Cannot remove owner from resource ${resourceId}`);
    }

    return await this.revokeAccess(resourceId, userIdToRemove);
  }

  /**
   * Check if one permission level meets or exceeds another
   */
  private checkPermissionLevel(userPermission: PermissionLevel, requiredPermission: PermissionLevel): boolean {
    const permissionLevels: PermissionLevel[] = [
      PermissionLevel.READ,
      PermissionLevel.WRITE,
      PermissionLevel.ADMIN,
      PermissionLevel.OWNER
    ];

    const userIndex = permissionLevels.indexOf(userPermission);
    const requiredIndex = permissionLevels.indexOf(requiredPermission);

    return userIndex >= requiredIndex;
  }

  /**
   * Determine resource type based on ID pattern
   */
  private getResourceType(resourceId: string): 'document' | 'whiteboard' | 'project' {
    if (resourceId.startsWith('doc_')) {
      return 'document';
    } else if (resourceId.startsWith('wb_')) {
      return 'whiteboard';
    } else {
      return 'project';
    }
  }

  /**
   * Set default permission level for new resources
   */
  setDefaultPermission(permission: PermissionLevel): void {
    this.defaultPermission = permission;
  }

  /**
   * Get default permission level
   */
  getDefaultPermission(): PermissionLevel {
    return this.defaultPermission;
  }
}