import { Injectable, Logger } from '@nestjs/common';

/**
 * Permission level for collaboration resources
 */
export enum PermissionLevel {
  OWNER = 'owner',
  EDITOR = 'editor',
  COMMENTER = 'commenter',
  VIEWER = 'viewer',
  NONE = 'none',
}

/**
 * Interface for resource permission
 */
export interface ResourcePermission {
  id: string;
  resourceId: string;
  resourceType: 'document' | 'whiteboard' | 'other';
  userId: string;
  permissionLevel: PermissionLevel;
  grantedBy: string;
  grantedAt: number;
  expiresAt: number | null;
}

/**
 * Interface for permission group
 */
export interface PermissionGroup {
  id: string;
  name: string;
  description: string;
  createdBy: string;
  createdAt: number;
  members: string[];
}

/**
 * Service for managing permissions for collaborative resources
 */
@Injectable()
export class CollaborationPermissionsService {
  private readonly logger = new Logger(CollaborationPermissionsService.name);
  private readonly permissions = new Map<string, ResourcePermission[]>();
  private readonly permissionGroups = new Map<string, PermissionGroup>();
  
  /**
   * Grant permission to a user for a resource
   * @param resourceId The resource ID
   * @param resourceType The resource type
   * @param userId The user ID
   * @param permissionLevel The permission level
   * @param grantedBy The user ID granting the permission
   * @param expiresAt Optional expiration timestamp
   */
  grantPermission(resourceId: string, resourceType: 'document' | 'whiteboard' | 'other',
                 userId: string, permissionLevel: PermissionLevel,
                 grantedBy: string, expiresAt?: number): ResourcePermission {
    // Get existing permissions for this resource
    const resourceKey = `${resourceType}-${resourceId}`;
    const resourcePermissions = this.permissions.get(resourceKey) || [];
    
    // Check if permission already exists for this user
    const existingPermissionIndex = resourcePermissions.findIndex(p => p.userId === userId);
    
    const permission: ResourcePermission = {
      id: `perm-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      resourceId,
      resourceType,
      userId,
      permissionLevel,
      grantedBy,
      grantedAt: Date.now(),
      expiresAt: expiresAt || null,
    };
    
    if (existingPermissionIndex !== -1) {
      // Update existing permission
      resourcePermissions[existingPermissionIndex] = permission;
    } else {
      // Add new permission
      resourcePermissions.push(permission);
    }
    
    this.permissions.set(resourceKey, resourcePermissions);
    
    this.logger.log(`Granted ${permissionLevel} permission to user ${userId} for ${resourceType} ${resourceId}`);
    
    return permission;
  }

  /**
   * Revoke permission from a user for a resource
   * @param resourceId The resource ID
   * @param resourceType The resource type
   * @param userId The user ID
   */
  revokePermission(resourceId: string, resourceType: 'document' | 'whiteboard' | 'other', userId: string): boolean {
    const resourceKey = `${resourceType}-${resourceId}`;
    const resourcePermissions = this.permissions.get(resourceKey) || [];
    
    const initialLength = resourcePermissions.length;
    const filteredPermissions = resourcePermissions.filter(p => p.userId !== userId);
    
    if (filteredPermissions.length !== initialLength) {
      this.permissions.set(resourceKey, filteredPermissions);
      this.logger.log(`Revoked permission from user ${userId} for ${resourceType} ${resourceId}`);
      return true;
    }
    
    return false;
  }

  /**
   * Get the permission level for a user on a resource
   * @param resourceId The resource ID
   * @param resourceType The resource type
   * @param userId The user ID
   */
  getPermissionLevel(resourceId: string, resourceType: 'document' | 'whiteboard' | 'other', userId: string): PermissionLevel {
    const resourceKey = `${resourceType}-${resourceId}`;
    const resourcePermissions = this.permissions.get(resourceKey) || [];
    
    // Find direct permission for the user
    const userPermission = resourcePermissions.find(p => p.userId === userId);
    
    if (userPermission) {
      // Check if permission has expired
      if (userPermission.expiresAt && userPermission.expiresAt < Date.now()) {
        return PermissionLevel.NONE;
      }
      return userPermission.permissionLevel;
    }
    
    // Check if user is in any groups with permission
    for (const group of this.permissionGroups.values()) {
      if (group.members.includes(userId)) {
        // Check if group has permission for this resource
        const groupPermission = resourcePermissions.find(p => p.userId === `group:${group.id}`);
        if (groupPermission) {
          // Check if permission has expired
          if (groupPermission.expiresAt && groupPermission.expiresAt < Date.now()) {
            continue;
          }
          return groupPermission.permissionLevel;
        }
      }
    }
    
    return PermissionLevel.NONE;
  }

  /**
   * Check if a user has a specific permission level for a resource
   * @param resourceId The resource ID
   * @param resourceType The resource type
   * @param userId The user ID
   * @param requiredLevel The required permission level
   */
  hasPermission(resourceId: string, resourceType: 'document' | 'whiteboard' | 'other',
               userId: string, requiredLevel: PermissionLevel): boolean {
    const userLevel = this.getPermissionLevel(resourceId, resourceType, userId);
    
    // Permission hierarchy: OWNER > EDITOR > COMMENTER > VIEWER > NONE
    switch (requiredLevel) {
      case PermissionLevel.OWNER:
        return userLevel === PermissionLevel.OWNER;
      case PermissionLevel.EDITOR:
        return userLevel === PermissionLevel.OWNER || userLevel === PermissionLevel.EDITOR;
      case PermissionLevel.COMMENTER:
        return userLevel === PermissionLevel.OWNER || userLevel === PermissionLevel.EDITOR || 
               userLevel === PermissionLevel.COMMENTER;
      case PermissionLevel.VIEWER:
        return userLevel === PermissionLevel.OWNER || userLevel === PermissionLevel.EDITOR || 
               userLevel === PermissionLevel.COMMENTER || userLevel === PermissionLevel.VIEWER;
      default:
        return true; // Everyone has NONE permission
    }
  }

  /**
   * Get all permissions for a resource
   * @param resourceId The resource ID
   * @param resourceType The resource type
   */
  getResourcePermissions(resourceId: string, resourceType: 'document' | 'whiteboard' | 'other'): ResourcePermission[] {
    const resourceKey = `${resourceType}-${resourceId}`;
    return this.permissions.get(resourceKey) || [];
  }

  /**
   * Get all resources a user has access to
   * @param userId The user ID
   * @param resourceType Optional resource type filter
   * @param minPermissionLevel Optional minimum permission level
   */
  getUserAccessibleResources(userId: string, resourceType?: 'document' | 'whiteboard' | 'other',
                           minPermissionLevel?: PermissionLevel): string[] {
    const accessibleResources: string[] = [];
    
    // Get user's groups
    const userGroups = Array.from(this.permissionGroups.values())
      .filter(group => group.members.includes(userId))
      .map(group => `group:${group.id}`);
    
    // Check all permissions
    for (const [key, resourcePermissions] of this.permissions.entries()) {
      // Parse the resource type and ID from the key
      const [resType, resId] = key.split('-', 2);
      
      // Skip if resource type doesn't match the filter
      if (resourceType && resType !== resourceType) {
        continue;
      }
      
      // Check if user or user's groups have permission
      for (const permission of resourcePermissions) {
        if (permission.userId === userId || userGroups.includes(permission.userId)) {
          // Check if permission has expired
          if (permission.expiresAt && permission.expiresAt < Date.now()) {
            continue;
          }
          
          // Check minimum permission level
          if (minPermissionLevel) {
            if (!this.isPermissionSufficient(permission.permissionLevel, minPermissionLevel)) {
              continue;
            }
          }
          
          accessibleResources.push(resId);
          break; // Found a valid permission for this resource
        }
      }
    }
    
    return accessibleResources;
  }

  /**
   * Check if a permission level is sufficient for a required level
   * @param actual The actual permission level
   * @param required The required permission level
   */
  private isPermissionSufficient(actual: PermissionLevel, required: PermissionLevel): boolean {
    const levels = [
      PermissionLevel.NONE,
      PermissionLevel.VIEWER,
      PermissionLevel.COMMENTER,
      PermissionLevel.EDITOR,
      PermissionLevel.OWNER,
    ];
    
    const actualIndex = levels.indexOf(actual);
    const requiredIndex = levels.indexOf(required);
    
    return actualIndex >= requiredIndex;
  }

  /**
   * Create a permission group
   * @param name The group name
   * @param description The group description
   * @param createdBy The user ID creating the group
   * @param initialMembers Optional initial group members
   */
  createPermissionGroup(name: string, description: string, createdBy: string, initialMembers: string[] = []): PermissionGroup {
    const groupId = `group-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    const group: PermissionGroup = {
      id: groupId,
      name,
      description,
      createdBy,
      createdAt: Date.now(),
      members: [...initialMembers],
    };
    
    this.permissionGroups.set(groupId, group);
    
    this.logger.log(`Created permission group ${name} (${groupId}) by user ${createdBy}`);
    
    return group;
  }

  /**
   * Add a user to a permission group
   * @param groupId The group ID
   * @param userId The user ID to add
   */
  addUserToGroup(groupId: string, userId: string): boolean {
    const group = this.permissionGroups.get(groupId);
    
    if (!group) {
      return false;
    }
    
    if (!group.members.includes(userId)) {
      group.members.push(userId);
      this.permissionGroups.set(groupId, group);
      this.logger.log(`Added user ${userId} to group ${group.name} (${groupId})`);
    }
    
    return true;
  }

  /**
   * Remove a user from a permission group
   * @param groupId The group ID
   * @param userId The user ID to remove
   */
  removeUserFromGroup(groupId: string, userId: string): boolean {
    const group = this.permissionGroups.get(groupId);
    
    if (!group) {
      return false;
    }
    
    const initialLength = group.members.length;
    group.members = group.members.filter(id => id !== userId);
    
    if (group.members.length !== initialLength) {
      this.permissionGroups.set(groupId, group);
      this.logger.log(`Removed user ${userId} from group ${group.name} (${groupId})`);
      return true;
    }
    
    return false;
  }

  /**
   * Grant permission to a group for a resource
   * @param resourceId The resource ID
   * @param resourceType The resource type
   * @param groupId The group ID
   * @param permissionLevel The permission level
   * @param grantedBy The user ID granting the permission
   * @param expiresAt Optional expiration timestamp
   */
  grantGroupPermission(resourceId: string, resourceType: 'document' | 'whiteboard' | 'other',
                      groupId: string, permissionLevel: PermissionLevel,
                      grantedBy: string, expiresAt?: number): ResourcePermission {
    // Check if group exists
    const group = this.permissionGroups.get(groupId);
    
    if (!group) {
      throw new Error(`Group ${groupId} not found`);
    }
    
    // Grant permission using the group ID as the user ID with a prefix
    return this.grantPermission(
      resourceId,
      resourceType,
      `group:${groupId}`,
      permissionLevel,
      grantedBy,
      expiresAt
    );
  }

  /**
   * Get all permission groups
   */
  getAllPermissionGroups(): PermissionGroup[] {
    return Array.from(this.permissionGroups.values());
  }

  /**
   * Get a permission group by ID
   * @param groupId The group ID
   */
  getPermissionGroup(groupId: string): PermissionGroup | null {
    return this.permissionGroups.get(groupId) || null;
  }

  /**
   * Delete a permission group
   * @param groupId The group ID
   */
  deletePermissionGroup(groupId: string): boolean {
    const deleted = this.permissionGroups.delete(groupId);
    
    if (deleted) {
      // Remove all permissions granted to this group
      for (const [key, resourcePermissions] of this.permissions.entries()) {
        const updatedPermissions = resourcePermissions.filter(p => p.userId !== `group:${groupId}`);
        
        if (updatedPermissions.length !== resourcePermissions.length) {
          this.permissions.set(key, updatedPermissions);
        }
      }
      
      this.logger.log(`Deleted permission group ${groupId}`);
    }
    
    return deleted;
  }
}