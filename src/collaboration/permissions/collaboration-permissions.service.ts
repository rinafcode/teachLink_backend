import { Injectable, Logger } from '@nestjs/common';
export enum PermissionLevel {
    READ = 'read',
    WRITE = 'write',
    ADMIN = 'admin',
    OWNER = 'owner'
}

export interface IResourcePermission {
  resourceId: string;
  userId: string;
  permission: PermissionLevel;
  grantedAt: Date;
  grantedBy: string;
}

export interface ICollaborativeResource {
  id: string;
  type: 'document' | 'whiteboard' | 'project';
  ownerId: string;
  permissions: IResourcePermission[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Provides collaboration Permissions operations.
 */
@Injectable()
export class CollaborationPermissionsService {
  private readonly logger = Logger;
  private resources: Map<string, ICollaborativeResource> = new Map();
  private defaultPermission: PermissionLevel = PermissionLevel.READ;

  /**
   * Grant permission to a user for a resource
   */
  async grantAccess(
    resourceId: string,
    userId: string,
    permission: PermissionLevel = PermissionLevel.WRITE,
    grantedBy: string = 'system',
  ): Promise<IResourcePermission> {
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
    const existingPermission = resource.permissions.find((p) => p.userId === userId);

    if (existingPermission) {
      // Update existing permission
      existingPermission.permission = permission;
      existingPermission.grantedAt = new Date();
      existingPermission.grantedBy = grantedBy;
    } else {
      // Add new permission
      const newPermission: IResourcePermission = {
        resourceId,
        userId,
        permission,
        grantedAt: new Date(),
        grantedBy,
      };
      resource.permissions.push(newPermission);
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
        return resource.permissions.find((p) => p.userId === userId);
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

    return this.checkPermissionLevel(userPermission.permission, requiredPermission);
  }

  /**
   * Get user's permission for a resource
   */
  getUserPermission(resourceId: string, userId: string): IResourcePermission | undefined {
    const resource = this.resources.get(resourceId);
    if (!resource) {
      return undefined;
    }

    return resource.permissions.find((p) => p.userId === userId);
  }

  /**
   * Get all users with access to a resource
   */
  async getUsersForResource(resourceId: string): Promise<IResourcePermission[]> {
    const resource = this.resources.get(resourceId);
    if (!resource) {
      return [];
    }

    return [...resource.permissions];
  }

  /**
   * Get all resources a user has access to
   */
  async getResourcesForUser(
    userId: string,
    minPermission: PermissionLevel = PermissionLevel.READ,
  ): Promise<ICollaborativeResource[]> {
    const userResources: ICollaborativeResource[] = [];

    for (const resource of this.resources.values()) {
      const userPermission = resource.permissions.find((p) => p.userId === userId);

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
    updatedBy: string,
  ): Promise<IResourcePermission | null> {
    const resource = this.resources.get(resourceId);
    if (!resource) {
      return null;
    }
    /**
     * Check if one permission level meets or exceeds another
     */
    private checkPermissionLevel(userPermission: PermissionLevel, requiredPermission: PermissionLevel): boolean {
        const permissionLevels: PermissionLevel[] = [
            PermissionLevel.READ,
            PermissionLevel.WRITE,
            PermissionLevel.ADMIN,
            PermissionLevel.OWNER,
        ];
        const userIndex = permissionLevels.indexOf(userPermission);
        const requiredIndex = permissionLevels.indexOf(requiredPermission);
        return userIndex >= requiredIndex;
    }

    userPermission.permission = newPermission;
    userPermission.grantedAt = new Date();
    userPermission.grantedBy = updatedBy;

    resource.updatedAt = new Date();

    this.logger.log(
      `Updated permission to ${newPermission} for user ${userId} on resource ${resourceId}`,
    );

    return { ...userPermission };
  }

  /**
   * Invite a user to collaborate on a resource
   */
  async inviteUser(
    resourceId: string,
    inviterId: string,
    inviteeId: string,
    permission: PermissionLevel = PermissionLevel.WRITE,
  ): Promise<IResourcePermission> {
    // Check if inviter has admin or owner permissions
    const inviterPermission = this.getUserPermission(resourceId, inviterId);

    if (
      !inviterPermission ||
      !this.checkPermissionLevel(inviterPermission.permission, PermissionLevel.ADMIN)
    ) {
      throw new Error(
        `User ${inviterId} does not have permission to invite users to resource ${resourceId}`,
      );
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
