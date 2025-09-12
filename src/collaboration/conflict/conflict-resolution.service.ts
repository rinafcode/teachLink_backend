import { Injectable, Logger } from '@nestjs/common';
import { DocumentOperation, TextOperation } from '../documents/shared-document.service';
import { WhiteboardOperation, WhiteboardElement } from '../whiteboard/whiteboard.service';

/**
 * Interface for conflict
 */
export interface Conflict {
  id: string;
  resourceId: string;
  resourceType: 'document' | 'whiteboard' | 'other';
  operations: any[];
  users: string[];
  timestamp: number;
  resolved: boolean;
  resolution?: any;
  resolvedBy?: string;
  resolvedAt?: number;
}

/**
 * Interface for conflict resolution strategy
 */
export interface ConflictResolutionStrategy {
  name: string;
  description: string;
  priority: number;
  canResolve: (conflict: Conflict) => boolean;
  resolve: (conflict: Conflict) => any;
}

/**
 * Service for handling conflict resolution in collaborative editing
 */
@Injectable()
export class ConflictResolutionService {
  private readonly logger = new Logger(ConflictResolutionService.name);
  private readonly conflicts = new Map<string, Conflict[]>();
  private readonly strategies: ConflictResolutionStrategy[] = [];
  
  constructor() {
    // Register default conflict resolution strategies
    this.registerDefaultStrategies();
  }

  /**
   * Register default conflict resolution strategies
   */
  private registerDefaultStrategies(): void {
    // Last-write-wins strategy
    this.registerStrategy({
      name: 'last-write-wins',
      description: 'The last operation chronologically wins',
      priority: 1,
      canResolve: () => true, // Can resolve any conflict
      resolve: (conflict) => {
        // Sort operations by timestamp and take the latest
        const sortedOps = [...conflict.operations].sort((a, b) => b.timestamp - a.timestamp);
        return sortedOps[0];
      },
    });
    
    // Document-specific strategies
    this.registerStrategy({
      name: 'text-merge',
      description: 'Merge text operations when possible',
      priority: 2,
      canResolve: (conflict) => {
        return conflict.resourceType === 'document' && 
               conflict.operations.every(op => op.hasOwnProperty('operations'));
      },
      resolve: (conflict) => {
        return this.mergeTextOperations(conflict);
      },
    });
    
    // Whiteboard-specific strategies
    this.registerStrategy({
      name: 'spatial-separation',
      description: 'Resolve conflicts based on spatial separation of elements',
      priority: 2,
      canResolve: (conflict) => {
        return conflict.resourceType === 'whiteboard' && 
               conflict.operations.every(op => op.hasOwnProperty('elements'));
      },
      resolve: (conflict) => {
        return this.resolveSpatialConflict(conflict);
      },
    });
  }

  /**
   * Register a conflict resolution strategy
   * @param strategy The strategy to register
   */
  registerStrategy(strategy: ConflictResolutionStrategy): void {
    this.strategies.push(strategy);
    
    // Sort strategies by priority (higher priority first)
    this.strategies.sort((a, b) => b.priority - a.priority);
    
    this.logger.log(`Registered conflict resolution strategy: ${strategy.name}`);
  }

  /**
   * Detect conflicts between operations
   * @param operations The operations to check for conflicts
   * @param resourceId The resource ID
   * @param resourceType The resource type
   */
  detectConflicts(operations: any[], resourceId: string, resourceType: 'document' | 'whiteboard' | 'other'): Conflict | null {
    if (operations.length < 2) {
      return null; // Need at least 2 operations to have a conflict
    }
    
    // For document operations
    if (resourceType === 'document') {
      return this.detectDocumentConflicts(operations as DocumentOperation[], resourceId);
    }
    
    // For whiteboard operations
    if (resourceType === 'whiteboard') {
      return this.detectWhiteboardConflicts(operations as WhiteboardOperation[], resourceId);
    }
    
    // Generic conflict detection
    const users = new Set<string>();
    operations.forEach(op => users.add(op.userId));
    
    // If operations are from different users and happen close in time, consider it a conflict
    if (users.size > 1) {
      const timestamps = operations.map(op => op.timestamp);
      const minTime = Math.min(...timestamps);
      const maxTime = Math.max(...timestamps);
      
      // If operations happened within 5 seconds of each other
      if (maxTime - minTime < 5000) {
        return {
          id: `conflict-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          resourceId,
          resourceType,
          operations,
          users: Array.from(users),
          timestamp: Date.now(),
          resolved: false,
        };
      }
    }
    
    return null;
  }

  /**
   * Detect conflicts between document operations
   * @param operations The document operations
   * @param resourceId The document ID
   */
  private detectDocumentConflicts(operations: DocumentOperation[], resourceId: string): Conflict | null {
    // Check for overlapping text operations
    const positionRanges = new Map<string, {start: number, end: number}[]>();
    
    for (const op of operations) {
      if (!positionRanges.has(op.userId)) {
        positionRanges.set(op.userId, []);
      }
      
      const userRanges = positionRanges.get(op.userId);
      
      for (const textOp of op.operations) {
        let start = textOp.position;
        let end = textOp.position;
        
        if (textOp.type === 'insert' && textOp.text) {
          end += textOp.text.length;
        } else if (textOp.type === 'delete' && textOp.length) {
          end += textOp.length;
        }
        
        userRanges.push({ start, end });
      }
    }
    
    // Check for overlapping ranges between different users
    const users = Array.from(positionRanges.keys());
    for (let i = 0; i < users.length; i++) {
      for (let j = i + 1; j < users.length; j++) {
        const userA = users[i];
        const userB = users[j];
        
        const rangesA = positionRanges.get(userA);
        const rangesB = positionRanges.get(userB);
        
        for (const rangeA of rangesA) {
          for (const rangeB of rangesB) {
            // Check if ranges overlap
            if (!(rangeA.end < rangeB.start || rangeA.start > rangeB.end)) {
              return {
                id: `conflict-doc-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                resourceId,
                resourceType: 'document',
                operations,
                users: [userA, userB],
                timestamp: Date.now(),
                resolved: false,
              };
            }
          }
        }
      }
    }
    
    return null;
  }

  /**
   * Detect conflicts between whiteboard operations
   * @param operations The whiteboard operations
   * @param resourceId The whiteboard ID
   */
  private detectWhiteboardConflicts(operations: WhiteboardOperation[], resourceId: string): Conflict | null {
    // Check for operations on the same elements
    const elementOperations = new Map<string, {op: WhiteboardOperation, user: string}[]>();
    
    for (const op of operations) {
      if (op.type === 'clear') {
        // Clear operation conflicts with any other operation
        return {
          id: `conflict-wb-clear-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          resourceId,
          resourceType: 'whiteboard',
          operations,
          users: operations.map(o => o.userId),
          timestamp: Date.now(),
          resolved: false,
        };
      }
      
      for (const element of op.elements) {
        if (!elementOperations.has(element.id)) {
          elementOperations.set(element.id, []);
        }
        
        elementOperations.get(element.id).push({
          op,
          user: op.userId,
        });
      }
    }
    
    // Check for elements with operations from multiple users
    for (const [elementId, ops] of elementOperations.entries()) {
      const users = new Set(ops.map(o => o.user));
      
      if (users.size > 1) {
        return {
          id: `conflict-wb-element-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          resourceId,
          resourceType: 'whiteboard',
          operations: ops.map(o => o.op),
          users: Array.from(users),
          timestamp: Date.now(),
          resolved: false,
        };
      }
    }
    
    return null;
  }

  /**
   * Resolve a conflict using available strategies
   * @param conflict The conflict to resolve
   * @param userId The user ID resolving the conflict (optional)
   */
  resolveConflict(conflict: Conflict, userId?: string): any {
    if (conflict.resolved) {
      return conflict.resolution;
    }
    
    // Try each strategy in order of priority
    for (const strategy of this.strategies) {
      if (strategy.canResolve(conflict)) {
        try {
          const resolution = strategy.resolve(conflict);
          
          // Update the conflict as resolved
          conflict.resolved = true;
          conflict.resolution = resolution;
          conflict.resolvedBy = userId || 'system';
          conflict.resolvedAt = Date.now();
          
          this.logger.log(`Resolved conflict ${conflict.id} using strategy ${strategy.name}`);
          
          // Store the resolved conflict
          this.storeConflict(conflict);
          
          return resolution;
        } catch (error) {
          this.logger.warn(`Strategy ${strategy.name} failed to resolve conflict: ${error.message}`);
          // Continue to the next strategy
        }
      }
    }
    
    // If no strategy could resolve the conflict, use the last-write-wins as fallback
    const sortedOps = [...conflict.operations].sort((a, b) => b.timestamp - a.timestamp);
    const resolution = sortedOps[0];
    
    // Update the conflict as resolved
    conflict.resolved = true;
    conflict.resolution = resolution;
    conflict.resolvedBy = userId || 'system';
    conflict.resolvedAt = Date.now();
    
    this.logger.log(`Resolved conflict ${conflict.id} using fallback last-write-wins`);
    
    // Store the resolved conflict
    this.storeConflict(conflict);
    
    return resolution;
  }

  /**
   * Store a conflict
   * @param conflict The conflict to store
   */
  private storeConflict(conflict: Conflict): void {
    const resourceKey = `${conflict.resourceType}-${conflict.resourceId}`;
    const resourceConflicts = this.conflicts.get(resourceKey) || [];
    
    // Check if conflict already exists
    const existingIndex = resourceConflicts.findIndex(c => c.id === conflict.id);
    
    if (existingIndex !== -1) {
      resourceConflicts[existingIndex] = conflict;
    } else {
      resourceConflicts.push(conflict);
    }
    
    this.conflicts.set(resourceKey, resourceConflicts);
  }

  /**
   * Get all conflicts for a resource
   * @param resourceId The resource ID
   * @param resourceType The resource type
   * @param includeResolved Whether to include resolved conflicts
   */
  getConflicts(resourceId: string, resourceType: 'document' | 'whiteboard' | 'other', includeResolved = false): Conflict[] {
    const resourceKey = `${resourceType}-${resourceId}`;
    const resourceConflicts = this.conflicts.get(resourceKey) || [];
    
    if (includeResolved) {
      return resourceConflicts;
    } else {
      return resourceConflicts.filter(c => !c.resolved);
    }
  }

  /**
   * Merge text operations for document conflicts
   * @param conflict The document conflict
   */
  private mergeTextOperations(conflict: Conflict): DocumentOperation {
    // This is a simplified implementation of text operation merging
    // In a real application, you would use a more sophisticated algorithm
    
    // Sort operations by timestamp
    const sortedOps = [...conflict.operations] as DocumentOperation[];
    sortedOps.sort((a, b) => a.timestamp - b.timestamp);
    
    // Start with the earliest operation
    const baseOp = sortedOps[0];
    
    // Merge subsequent operations
    const mergedTextOps: TextOperation[] = [...baseOp.operations];
    
    for (let i = 1; i < sortedOps.length; i++) {
      const currentOp = sortedOps[i];
      
      // Transform and merge each text operation
      for (const textOp of currentOp.operations) {
        // Check for conflicts with existing operations
        let conflicting = false;
        
        for (const existingOp of mergedTextOps) {
          // Simple conflict detection - operations at the same position
          if (existingOp.position === textOp.position) {
            conflicting = true;
            break;
          }
        }
        
        if (!conflicting) {
          // No conflict, add the operation
          mergedTextOps.push(textOp);
        } else {
          // For conflicting operations, prefer inserts over deletes
          if (textOp.type === 'insert') {
            // Remove conflicting operations
            const index = mergedTextOps.findIndex(op => op.position === textOp.position);
            if (index !== -1) {
              mergedTextOps.splice(index, 1);
            }
            // Add the insert operation
            mergedTextOps.push(textOp);
          }
          // For deletes, only apply if there's no insert at the same position
        }
      }
    }
    
    // Create a new merged operation
    return {
      id: `merged-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      userId: 'system-merge',
      documentId: baseOp.documentId,
      timestamp: Date.now(),
      version: Math.max(...sortedOps.map(op => op.version)),
      operations: mergedTextOps,
    };
  }

  /**
   * Resolve spatial conflicts for whiteboard elements
   * @param conflict The whiteboard conflict
   */
  private resolveSpatialConflict(conflict: Conflict): WhiteboardOperation {
    // This is a simplified implementation of spatial conflict resolution
    // In a real application, you would use a more sophisticated algorithm
    
    // Sort operations by timestamp
    const sortedOps = [...conflict.operations] as WhiteboardOperation[];
    sortedOps.sort((a, b) => a.timestamp - b.timestamp);
    
    // Group elements by ID
    const elementMap = new Map<string, WhiteboardElement>();
    
    // Process operations in chronological order
    for (const op of sortedOps) {
      switch (op.type) {
        case 'add':
          // Add all elements
          for (const element of op.elements) {
            elementMap.set(element.id, element);
          }
          break;
          
        case 'update':
          // Update existing elements
          for (const element of op.elements) {
            if (elementMap.has(element.id)) {
              elementMap.set(element.id, element);
            }
          }
          break;
          
        case 'delete':
          // Delete elements
          for (const element of op.elements) {
            elementMap.delete(element.id);
          }
          break;
          
        case 'clear':
          // Clear all elements
          elementMap.clear();
          break;
          
        case 'batch':
          // Process batch operations
          for (const element of op.elements) {
            const subType = element.properties?.subType;
            
            if (subType === 'add') {
              elementMap.set(element.id, element);
            } else if (subType === 'update' && elementMap.has(element.id)) {
              elementMap.set(element.id, element);
            } else if (subType === 'delete') {
              elementMap.delete(element.id);
            }
          }
          break;
      }
    }
    
    // Create a new operation with the resolved elements
    return {
      id: `resolved-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      type: 'batch',
      userId: 'system-resolve',
      whiteboardId: sortedOps[0].whiteboardId,
      timestamp: Date.now(),
      version: Math.max(...sortedOps.map(op => op.version)),
      elements: Array.from(elementMap.values()),
    };
  }

  /**
   * Get available conflict resolution strategies
   */
  getAvailableStrategies(): {name: string, description: string, priority: number}[] {
    return this.strategies.map(s => ({
      name: s.name,
      description: s.description,
      priority: s.priority,
    }));
  }

  /**
   * Manually resolve a conflict with a specific strategy
   * @param conflictId The conflict ID
   * @param strategyName The strategy name
   * @param userId The user ID resolving the conflict
   */
  manuallyResolveConflict(conflictId: string, strategyName: string, userId: string): any {
    // Find the conflict
    let targetConflict: Conflict = null;
    
    for (const conflicts of this.conflicts.values()) {
      const conflict = conflicts.find(c => c.id === conflictId);
      if (conflict) {
        targetConflict = conflict;
        break;
      }
    }
    
    if (!targetConflict) {
      throw new Error(`Conflict ${conflictId} not found`);
    }
    
    if (targetConflict.resolved) {
      return targetConflict.resolution;
    }
    
    // Find the strategy
    const strategy = this.strategies.find(s => s.name === strategyName);
    
    if (!strategy) {
      throw new Error(`Strategy ${strategyName} not found`);
    }
    
    if (!strategy.canResolve(targetConflict)) {
      throw new Error(`Strategy ${strategyName} cannot resolve this conflict`);
    }
    
    // Apply the strategy
    const resolution = strategy.resolve(targetConflict);
    
    // Update the conflict as resolved
    targetConflict.resolved = true;
    targetConflict.resolution = resolution;
    targetConflict.resolvedBy = userId;
    targetConflict.resolvedAt = Date.now();
    
    this.logger.log(`Manually resolved conflict ${conflictId} using strategy ${strategyName} by user ${userId}`);
    
    // Store the resolved conflict
    this.storeConflict(targetConflict);
    
    return resolution;
  }
}