import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

export interface DrawingElement {
  id: string;
  type: 'line' | 'rectangle' | 'circle' | 'text' | 'freehand';
  x: number;
  y: number;
  width?: number;
  height?: number;
  points?: { x: number; y: number }[]; // For freehand drawings
  text?: string; // For text elements
  color: string;
  strokeWidth: number;
  userId: string;
  timestamp: number;
}

export interface WhiteboardOperation {
  id: string;
  type: 'addElement' | 'removeElement' | 'updateElement' | 'clearBoard';
  element?: DrawingElement;
  elementId?: string;
  userId: string;
  timestamp: number;
}

export interface CollaborativeWhiteboard {
  id: string;
  elements: DrawingElement[];
  operations: WhiteboardOperation[];
  collaborators: string[];
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class WhiteboardService {
  private readonly logger = Logger;
  private whiteboards: Map<string, CollaborativeWhiteboard> = new Map();

  /**
   * Initialize a new collaborative whiteboard
   */
  async initializeWhiteboard(whiteboardId: string): Promise<CollaborativeWhiteboard> {
    const whiteboard: CollaborativeWhiteboard = {
      id: whiteboardId,
      elements: [],
      operations: [],
      collaborators: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.whiteboards.set(whiteboardId, whiteboard);
    this.logger.log(`Initialized whiteboard ${whiteboardId}`);
    
    return whiteboard;
  }

  /**
   * Get a collaborative whiteboard
   */
  async getWhiteboard(whiteboardId: string): Promise<CollaborativeWhiteboard | null> {
    return this.whiteboards.get(whiteboardId) || null;
  }

  /**
   * Apply an operation to a whiteboard
   */
  async applyOperation(
    whiteboardId: string,
    userId: string,
    operation: Omit<WhiteboardOperation, 'id' | 'timestamp'>
  ): Promise<CollaborativeWhiteboard> {
    const whiteboard = this.whiteboards.get(whiteboardId);
    if (!whiteboard) {
      throw new Error(`Whiteboard ${whiteboardId} not found`);
    }

    // Add metadata to the operation
    const opWithMetadata: WhiteboardOperation = {
      ...operation,
      id: uuidv4(),
      timestamp: Date.now(),
      userId,
    };

    // Apply the operation to the whiteboard
    this.applyOperationToWhiteboard(whiteboard, opWithMetadata);

    // Add the operation to the whiteboard's operation history
    whiteboard.operations.push(opWithMetadata);
    whiteboard.updatedAt = new Date();

    // Add user to collaborators if not already present
    if (!whiteboard.collaborators.includes(userId)) {
      whiteboard.collaborators.push(userId);
    }

    this.logger.log(`Applied operation ${opWithMetadata.id} to whiteboard ${whiteboardId}`);
    
    return whiteboard;
  }

  /**
   * Apply an operation to the whiteboard state
   */
  private applyOperationToWhiteboard(whiteboard: CollaborativeWhiteboard, operation: WhiteboardOperation): void {
    switch (operation.type) {
      case 'addElement':
        if (operation.element) {
          whiteboard.elements.push({ ...operation.element });
        }
        break;
        
      case 'removeElement':
        if (operation.elementId) {
          whiteboard.elements = whiteboard.elements.filter(el => el.id !== operation.elementId);
        }
        break;
        
      case 'updateElement':
        if (operation.elementId && operation.element) {
          const index = whiteboard.elements.findIndex(el => el.id === operation.elementId);
          if (index !== -1) {
            whiteboard.elements[index] = { ...operation.element };
          }
        }
        break;
        
      case 'clearBoard':
        whiteboard.elements = [];
        break;
    }
  }

  /**
   * Transform an operation against concurrent operations
   */
  private transformOperation(
    operation: WhiteboardOperation,
    concurrentOperations: WhiteboardOperation[]
  ): WhiteboardOperation {
    // For whiteboard operations, transformation is simpler than text operations
    // We mainly need to handle cases where elements are removed while others try to update them
    let transformedOp = { ...operation };

    for (const concurrentOp of concurrentOperations) {
      // If a concurrent operation removes an element that this operation tries to update
      if (concurrentOp.type === 'removeElement' && 
          operation.type === 'updateElement' && 
          concurrentOp.elementId === operation.elementId) {
        // Convert the update to an add operation since the element was removed
        transformedOp = {
          ...transformedOp,
          type: 'addElement',
          elementId: undefined,
        };
      }
    }

    return transformedOp;
  }

  /**
   * Resolve conflicts between simultaneous whiteboard edits
   */
  async resolveConflicts(whiteboardId: string, operations: WhiteboardOperation[]): Promise<CollaborativeWhiteboard> {
    const whiteboard = this.whiteboards.get(whiteboardId);
    if (!whiteboard) {
      throw new Error(`Whiteboard ${whiteboardId} not found`);
    }

    // Sort operations by timestamp to process in chronological order
    const sortedOps = [...operations].sort((a, b) => a.timestamp - b.timestamp);

    // Clear existing operations and reapply in order to resolve conflicts
    whiteboard.operations = [];
    whiteboard.elements = [];

    // Rebuild whiteboard state from the sorted operations
    for (const operation of sortedOps) {
      this.applyOperationToWhiteboard(whiteboard, operation);
      whiteboard.operations.push(operation);
    }

    whiteboard.updatedAt = new Date();
    
    return whiteboard;
  }

  /**
   * Get whiteboard history
   */
  async getWhiteboardHistory(whiteboardId: string): Promise<WhiteboardOperation[]> {
    const whiteboard = this.whiteboards.get(whiteboardId);
    if (!whiteboard) {
      throw new Error(`Whiteboard ${whiteboardId} not found`);
    }

    return [...whiteboard.operations];
  }

  /**
   * Add a drawing element to the whiteboard
   */
  async addElement(whiteboardId: string, element: Omit<DrawingElement, 'id' | 'timestamp'>, userId: string): Promise<DrawingElement> {
    const whiteboard = this.whiteboards.get(whiteboardId);
    if (!whiteboard) {
      throw new Error(`Whiteboard ${whiteboardId} not found`);
    }

    const newElement: DrawingElement = {
      ...element,
      id: uuidv4(),
      timestamp: Date.now(),
      userId,
    };

    whiteboard.elements.push(newElement);
    whiteboard.updatedAt = new Date();

    // Record the operation
    const operation: WhiteboardOperation = {
      id: uuidv4(),
      type: 'addElement',
      element: newElement,
      userId,
      timestamp: Date.now(),
    };
    whiteboard.operations.push(operation);

    return newElement;
  }

  /**
   * Remove a drawing element from the whiteboard
   */
  async removeElement(whiteboardId: string, elementId: string, userId: string): Promise<boolean> {
    const whiteboard = this.whiteboards.get(whiteboardId);
    if (!whiteboard) {
      throw new Error(`Whiteboard ${whiteboardId} not found`);
    }

    const elementIndex = whiteboard.elements.findIndex(el => el.id === elementId);
    if (elementIndex === -1) {
      return false;
    }

    whiteboard.elements.splice(elementIndex, 1);
    whiteboard.updatedAt = new Date();

    // Record the operation
    const operation: WhiteboardOperation = {
      id: uuidv4(),
      type: 'removeElement',
      elementId,
      userId,
      timestamp: Date.now(),
    };
    whiteboard.operations.push(operation);

    return true;
  }
}