import { Injectable, Logger } from '@nestjs/common';
import { CollaborationEvent } from '../collaboration.service';
import { DocumentOperation } from '../documents/shared-document.service';
import { WhiteboardOperation } from '../whiteboard/whiteboard.service';

/**
 * Interface for version
 */
export interface Version {
  id: string;
  resourceId: string;
  resourceType: 'document' | 'whiteboard' | 'other';
  versionNumber: number;
  timestamp: number;
  userId: string;
  description: string;
  snapshot: any;
  changes: any;
  parentVersionId: string | null;
}

/**
 * Interface for version branch
 */
export interface VersionBranch {
  id: string;
  name: string;
  resourceId: string;
  resourceType: 'document' | 'whiteboard' | 'other';
  createdAt: number;
  createdBy: string;
  headVersionId: string;
  isDefault: boolean;
}

/**
 * Service for version control of collaborative resources
 */
@Injectable()
export class VersionControlService {
  private readonly logger = new Logger(VersionControlService.name);
  private readonly versions = new Map<string, Version[]>();
  private readonly branches = new Map<string, VersionBranch[]>();
  
  /**
   * Create a new version for a resource
   * @param resourceId The resource ID
   * @param resourceType The resource type
   * @param userId The user ID
   * @param description The version description
   * @param snapshot The resource snapshot
   * @param changes The changes made in this version
   * @param parentVersionId The parent version ID (optional)
   */
  createVersion(resourceId: string, resourceType: 'document' | 'whiteboard' | 'other',
               userId: string, description: string, snapshot: any, changes: any,
               parentVersionId?: string): Version {
    // Get existing versions for this resource
    const resourceVersions = this.versions.get(`${resourceType}-${resourceId}`) || [];
    
    // Calculate the next version number
    const versionNumber = resourceVersions.length > 0 
      ? Math.max(...resourceVersions.map(v => v.versionNumber)) + 1 
      : 1;
    
    // Create the new version
    const version: Version = {
      id: `v-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      resourceId,
      resourceType,
      versionNumber,
      timestamp: Date.now(),
      userId,
      description,
      snapshot,
      changes,
      parentVersionId: parentVersionId || null,
    };
    
    // Add to versions collection
    resourceVersions.push(version);
    this.versions.set(`${resourceType}-${resourceId}`, resourceVersions);
    
    // Update the default branch head
    this.updateDefaultBranchHead(resourceId, resourceType, version.id);
    
    this.logger.log(`Created version ${version.versionNumber} for ${resourceType} ${resourceId} by user ${userId}`);
    
    return version;
  }

  /**
   * Get all versions for a resource
   * @param resourceId The resource ID
   * @param resourceType The resource type
   */
  getVersions(resourceId: string, resourceType: 'document' | 'whiteboard' | 'other'): Version[] {
    return this.versions.get(`${resourceType}-${resourceId}`) || [];
  }

  /**
   * Get a specific version
   * @param versionId The version ID
   */
  getVersion(versionId: string): Version | null {
    for (const versions of this.versions.values()) {
      const version = versions.find(v => v.id === versionId);
      if (version) return version;
    }
    return null;
  }

  /**
   * Create a version from a document operation
   * @param operation The document operation
   * @param snapshot The current document snapshot
   * @param description Optional description
   */
  createVersionFromDocumentOperation(operation: DocumentOperation, snapshot: any, description?: string): Version {
    return this.createVersion(
      operation.documentId,
      'document',
      operation.userId,
      description || `Document edit at ${new Date(operation.timestamp).toLocaleString()}`,
      snapshot,
      operation,
    );
  }

  /**
   * Create a version from a whiteboard operation
   * @param operation The whiteboard operation
   * @param snapshot The current whiteboard snapshot
   * @param description Optional description
   */
  createVersionFromWhiteboardOperation(operation: WhiteboardOperation, snapshot: any, description?: string): Version {
    return this.createVersion(
      operation.whiteboardId,
      'whiteboard',
      operation.userId,
      description || `Whiteboard edit at ${new Date(operation.timestamp).toLocaleString()}`,
      snapshot,
      operation,
    );
  }

  /**
   * Create a new branch for a resource
   * @param resourceId The resource ID
   * @param resourceType The resource type
   * @param name The branch name
   * @param userId The user ID
   * @param baseVersionId The base version ID
   */
  createBranch(resourceId: string, resourceType: 'document' | 'whiteboard' | 'other',
              name: string, userId: string, baseVersionId: string): VersionBranch {
    // Get existing branches for this resource
    const resourceBranches = this.branches.get(`${resourceType}-${resourceId}`) || [];
    
    // Check if branch name already exists
    if (resourceBranches.some(b => b.name === name)) {
      throw new Error(`Branch with name ${name} already exists for ${resourceType} ${resourceId}`);
    }
    
    // Verify the base version exists
    const baseVersion = this.getVersion(baseVersionId);
    if (!baseVersion) {
      throw new Error(`Base version ${baseVersionId} not found`);
    }
    
    // Create the new branch
    const branch: VersionBranch = {
      id: `branch-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      name,
      resourceId,
      resourceType,
      createdAt: Date.now(),
      createdBy: userId,
      headVersionId: baseVersionId,
      isDefault: false,
    };
    
    // Add to branches collection
    resourceBranches.push(branch);
    this.branches.set(`${resourceType}-${resourceId}`, resourceBranches);
    
    this.logger.log(`Created branch ${name} for ${resourceType} ${resourceId} by user ${userId}`);
    
    return branch;
  }

  /**
   * Get all branches for a resource
   * @param resourceId The resource ID
   * @param resourceType The resource type
   */
  getBranches(resourceId: string, resourceType: 'document' | 'whiteboard' | 'other'): VersionBranch[] {
    return this.branches.get(`${resourceType}-${resourceId}`) || [];
  }

  /**
   * Get the default branch for a resource
   * @param resourceId The resource ID
   * @param resourceType The resource type
   */
  getDefaultBranch(resourceId: string, resourceType: 'document' | 'whiteboard' | 'other'): VersionBranch | null {
    const branches = this.getBranches(resourceId, resourceType);
    return branches.find(b => b.isDefault) || null;
  }

  /**
   * Update the head of a branch
   * @param branchId The branch ID
   * @param versionId The new head version ID
   */
  updateBranchHead(branchId: string, versionId: string): VersionBranch | null {
    for (const [key, branches] of this.branches.entries()) {
      const branchIndex = branches.findIndex(b => b.id === branchId);
      
      if (branchIndex !== -1) {
        // Verify the version exists
        const version = this.getVersion(versionId);
        if (!version) {
          throw new Error(`Version ${versionId} not found`);
        }
        
        // Update the branch head
        branches[branchIndex].headVersionId = versionId;
        this.branches.set(key, branches);
        
        this.logger.log(`Updated branch ${branches[branchIndex].name} head to version ${versionId}`);
        
        return branches[branchIndex];
      }
    }
    
    return null;
  }

  /**
   * Update the head of the default branch for a resource
   * @param resourceId The resource ID
   * @param resourceType The resource type
   * @param versionId The new head version ID
   */
  private updateDefaultBranchHead(resourceId: string, resourceType: 'document' | 'whiteboard' | 'other', versionId: string): void {
    let defaultBranch = this.getDefaultBranch(resourceId, resourceType);
    
    if (!defaultBranch) {
      // Create default branch if it doesn't exist
      defaultBranch = {
        id: `branch-default-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        name: 'main',
        resourceId,
        resourceType,
        createdAt: Date.now(),
        createdBy: 'system',
        headVersionId: versionId,
        isDefault: true,
      };
      
      const resourceBranches = this.branches.get(`${resourceType}-${resourceId}`) || [];
      resourceBranches.push(defaultBranch);
      this.branches.set(`${resourceType}-${resourceId}`, resourceBranches);
      
      this.logger.log(`Created default branch for ${resourceType} ${resourceId}`);
    } else {
      // Update existing default branch
      this.updateBranchHead(defaultBranch.id, versionId);
    }
  }

  /**
   * Compare two versions and get the differences
   * @param versionId1 The first version ID
   * @param versionId2 The second version ID
   */
  compareVersions(versionId1: string, versionId2: string): any {
    const version1 = this.getVersion(versionId1);
    const version2 = this.getVersion(versionId2);
    
    if (!version1 || !version2) {
      throw new Error('One or both versions not found');
    }
    
    if (version1.resourceId !== version2.resourceId || version1.resourceType !== version2.resourceType) {
      throw new Error('Cannot compare versions from different resources');
    }
    
    // This is a simplified implementation
    // In a real application, you would use a diff algorithm to compare the snapshots
    return {
      version1: {
        id: version1.id,
        versionNumber: version1.versionNumber,
        timestamp: version1.timestamp,
        userId: version1.userId,
      },
      version2: {
        id: version2.id,
        versionNumber: version2.versionNumber,
        timestamp: version2.timestamp,
        userId: version2.userId,
      },
      // Simple diff implementation
      differences: {
        // This would be replaced with actual diff logic
        changedBy: version1.userId !== version2.userId,
        timeDifference: Math.abs(version2.timestamp - version1.timestamp),
      },
    };
  }

  /**
   * Get the version history as a tree
   * @param resourceId The resource ID
   * @param resourceType The resource type
   */
  getVersionTree(resourceId: string, resourceType: 'document' | 'whiteboard' | 'other'): any {
    const versions = this.getVersions(resourceId, resourceType);
    const branches = this.getBranches(resourceId, resourceType);
    
    // Build a tree structure
    const tree = {
      resourceId,
      resourceType,
      branches: branches.map(branch => ({
        id: branch.id,
        name: branch.name,
        isDefault: branch.isDefault,
        head: branch.headVersionId,
      })),
      versions: this.buildVersionTree(versions),
    };
    
    return tree;
  }

  /**
   * Build a tree structure from a flat list of versions
   * @param versions The versions to organize into a tree
   */
  private buildVersionTree(versions: Version[]): any {
    // Map to store nodes by ID for quick lookup
    const nodeMap = new Map<string, any>();
    
    // Create nodes for each version
    for (const version of versions) {
      nodeMap.set(version.id, {
        id: version.id,
        versionNumber: version.versionNumber,
        timestamp: version.timestamp,
        userId: version.userId,
        description: version.description,
        children: [],
      });
    }
    
    // Build the tree by connecting parents and children
    const roots = [];
    
    for (const version of versions) {
      const node = nodeMap.get(version.id);
      
      if (version.parentVersionId && nodeMap.has(version.parentVersionId)) {
        // Add as child to parent
        const parent = nodeMap.get(version.parentVersionId);
        parent.children.push(node);
      } else {
        // No parent or parent not in the map, treat as root
        roots.push(node);
      }
    }
    
    return roots;
  }

  /**
   * Merge two branches
   * @param sourceBranchId The source branch ID
   * @param targetBranchId The target branch ID
   * @param userId The user ID performing the merge
   * @param resolution Any conflict resolution data
   */
  mergeBranches(sourceBranchId: string, targetBranchId: string, userId: string, resolution?: any): Version | null {
    // Find the branches
    let sourceBranch: VersionBranch | null = null;
    let targetBranch: VersionBranch | null = null;
    
    for (const branches of this.branches.values()) {
      if (!sourceBranch) {
        sourceBranch = branches.find(b => b.id === sourceBranchId) || null;
      }
      
      if (!targetBranch) {
        targetBranch = branches.find(b => b.id === targetBranchId) || null;
      }
      
      if (sourceBranch && targetBranch) break;
    }
    
    if (!sourceBranch || !targetBranch) {
      throw new Error('One or both branches not found');
    }
    
    if (sourceBranch.resourceId !== targetBranch.resourceId || 
        sourceBranch.resourceType !== targetBranch.resourceType) {
      throw new Error('Cannot merge branches from different resources');
    }
    
    // Get the head versions
    const sourceVersion = this.getVersion(sourceBranch.headVersionId);
    const targetVersion = this.getVersion(targetBranch.headVersionId);
    
    if (!sourceVersion || !targetVersion) {
      throw new Error('One or both head versions not found');
    }
    
    // In a real implementation, you would merge the changes and handle conflicts
    // This is a simplified implementation that creates a new version with both parents
    
    // Create a merged snapshot (simplified)
    const mergedSnapshot = {
      ...targetVersion.snapshot,
      // Apply changes from source version (simplified)
      // In a real implementation, you would use a proper merge algorithm
    };
    
    // Create a new version for the merge
    const mergeVersion = this.createVersion(
      targetBranch.resourceId,
      targetBranch.resourceType as 'document' | 'whiteboard' | 'other',
      userId,
      `Merged ${sourceBranch.name} into ${targetBranch.name}`,
      mergedSnapshot,
      {
        type: 'merge',
        sourceBranchId,
        targetBranchId,
        resolution,
      },
      targetVersion.id, // Set the target version as parent
    );
    
    // Update the target branch head
    this.updateBranchHead(targetBranchId, mergeVersion.id);
    
    this.logger.log(`Merged branch ${sourceBranch.name} into ${targetBranch.name}`);
    
    return mergeVersion;
  }

  /**
   * Revert to a specific version
   * @param versionId The version ID to revert to
   * @param userId The user ID performing the revert
   * @param description Optional description for the revert
   */
  revertToVersion(versionId: string, userId: string, description?: string): Version | null {
    const version = this.getVersion(versionId);
    
    if (!version) {
      throw new Error(`Version ${versionId} not found`);
    }
    
    // Create a new version based on the reverted version
    const revertVersion = this.createVersion(
      version.resourceId,
      version.resourceType,
      userId,
      description || `Reverted to version ${version.versionNumber}`,
      version.snapshot,
      {
        type: 'revert',
        revertedVersionId: versionId,
      },
    );
    
    this.logger.log(`Reverted ${version.resourceType} ${version.resourceId} to version ${version.versionNumber}`);
    
    return revertVersion;
  }
}