import { Injectable, Logger } from '@nestjs/common';
import { CollaborationService, CollaborationEvent } from '../collaboration.service';
import { Subject } from 'rxjs';
import { filter } from 'rxjs/operators';

/**
 * Interface for whiteboard element
 */
export interface WhiteboardElement {
  id: string;
  type: 'path' | 'shape' | 'text' | 'image';
  userId: string;
  properties: any;
  position: { x: number; y: number };
  timestamp: number;
}

/**
 * Interface for whiteboard state
 */
export interface WhiteboardState {
  id: string;
  elements: WhiteboardElement[];
  version: number;
  lastModified: number;
  createdBy: string;
  lastModifiedBy: string;
  width: number;
  height: number;
}

/**
 * Interface for whiteboard operation
 */
export interface WhiteboardOperation {
  id: string;
  type: 'add' | 'update' | 'delete' | 'clear' | 'batch';
  userId: string;
  whiteboardId: string;
  timestamp: number;
  version: number;
  elements: WhiteboardElement[];
}

/**
 * Service for whiteboard collaboration with drawing capabilities
 */
@Injectable()
export class WhiteboardService {
  private readonly logger = new Logger(WhiteboardService.name);
  private readonly whiteboards = new Map<string, WhiteboardState>();
  private readonly operationHistory = new Map<string, WhiteboardOperation[]>();
  private readonly whiteboardEvents = new Subject<CollaborationEvent>();
  
  constructor(private readonly collaborationService: CollaborationService) {}

  /**
   * Create a new whiteboard
   * @param id Whiteboard ID
   * @param width Whiteboard width
   * @param height Whiteboard height
   * @param userId User ID of the creator
   */
  createWhiteboard(id: string, width: number, height: number, userId: string): WhiteboardState {
    if (this.whiteboards.has(id)) {
      throw new Error(`Whiteboard with ID ${id} already exists`);
    }
    
    const whiteboard: WhiteboardState = {
      id,
      elements: [],
      version: 0,
      lastModified: Date.now(),
      createdBy: userId,
      lastModifiedBy: userId,
      width,
      height,
    };
    
    this.whiteboards.set(id, whiteboard);
    this.operationHistory.set(id, []);
    
    this.logger.log(`Created whiteboard: ${id} by user ${userId}`);
    
    // Create a collaboration session for this whiteboard
    this.collaborationService.createSession(id, 'whiteboard', userId);
    
    return whiteboard;
  }

  /**
   * Get a whiteboard by ID
   * @param id Whiteboard ID
   */
  getWhiteboard(id: string): WhiteboardState | null {
    return this.whiteboards.get(id) || null;
  }

  /**
   * Apply an operation to a whiteboard
   * @param operation The operation to apply
   */
  applyOperation(operation: WhiteboardOperation): WhiteboardState {
    const whiteboard = this.whiteboards.get(operation.whiteboardId);
    
    if (!whiteboard) {
      throw new Error(`Whiteboard with ID ${operation.whiteboardId} not found`);
    }
    
    // Get the history of operations for this whiteboard
    const history = this.operationHistory.get(operation.whiteboardId) || [];
    
    // Apply the operation based on its type
    switch (operation.type) {
      case 'add':
        this.addElements(whiteboard, operation.elements);
        break;
      case 'update':
        this.updateElements(whiteboard, operation.elements);
        break;
      case 'delete':
        this.deleteElements(whiteboard, operation.elements);
        break;
      case 'clear':
        whiteboard.elements = [];
        break;
      case 'batch':
        // Apply a batch of operations
        this.applyBatchOperation(whiteboard, operation);
        break;
    }
    
    // Update whiteboard metadata
    whiteboard.version++;
    whiteboard.lastModified = Date.now();
    whiteboard.lastModifiedBy = operation.userId;
    
    // Add the operation to history
    history.push(operation);
    this.operationHistory.set(operation.whiteboardId, history);
    
    // Publish the event
    this.publishWhiteboardEvent({
      id: `wb-op-${operation.id}`,
      type: 'whiteboard-operation',
      resourceId: operation.whiteboardId,
      resourceType: 'whiteboard',
      userId: operation.userId,
      timestamp: Date.now(),
      data: operation,
    });
    
    return whiteboard;
  }

  /**
   * Add elements to a whiteboard
   * @param whiteboard The whiteboard to modify
   * @param elements The elements to add
   */
  private addElements(whiteboard: WhiteboardState, elements: WhiteboardElement[]): void {
    whiteboard.elements = [...whiteboard.elements, ...elements];
  }

  /**
   * Update elements in a whiteboard
   * @param whiteboard The whiteboard to modify
   * @param elements The elements to update
   */
  private updateElements(whiteboard: WhiteboardState, elements: WhiteboardElement[]): void {
    for (const element of elements) {
      const index = whiteboard.elements.findIndex(e => e.id === element.id);
      if (index !== -1) {
        whiteboard.elements[index] = element;
      }
    }
  }

  /**
   * Delete elements from a whiteboard
   * @param whiteboard The whiteboard to modify
   * @param elements The elements to delete
   */
  private deleteElements(whiteboard: WhiteboardState, elements: WhiteboardElement[]): void {
    const elementIds = elements.map(e => e.id);
    whiteboard.elements = whiteboard.elements.filter(e => !elementIds.includes(e.id));
  }

  /**
   * Apply a batch operation to a whiteboard
   * @param whiteboard The whiteboard to modify
   * @param operation The batch operation
   */
  private applyBatchOperation(whiteboard: WhiteboardState, operation: WhiteboardOperation): void {
    // For batch operations, we assume the elements array contains sub-operations
    // Each element in the batch should have a subType property
    for (const element of operation.elements) {
      const subType = element.properties?.subType;
      
      if (!subType) continue;
      
      switch (subType) {
        case 'add':
          this.addElements(whiteboard, [element]);
          break;
        case 'update':
          this.updateElements(whiteboard, [element]);
          break;
        case 'delete':
          this.deleteElements(whiteboard, [element]);
          break;
      }
    }
  }

  /**
   * Publish a whiteboard event
   * @param event The event to publish
   */
  private publishWhiteboardEvent(event: CollaborationEvent): void {
    this.whiteboardEvents.next(event);
    this.collaborationService.publishEvent(event);
  }

  /**
   * Subscribe to whiteboard events
   * @param whiteboardId Optional whiteboard ID to filter events
   */
  subscribeToWhiteboardEvents(whiteboardId?: string) {
    let events = this.whiteboardEvents.asObservable();
    
    if (whiteboardId) {
      events = events.pipe(
        filter(event => event.resourceId === whiteboardId)
      );
    }
    
    return events;
  }

  /**
   * Get the operation history for a whiteboard
   * @param whiteboardId The whiteboard ID
   * @param limit Optional limit on the number of operations to return
   */
  getOperationHistory(whiteboardId: string, limit?: number): WhiteboardOperation[] {
    const history = this.operationHistory.get(whiteboardId) || [];
    
    if (limit && limit > 0) {
      return history.slice(-limit);
    }
    
    return history;
  }

  /**
   * Create a path element (for drawing lines)
   * @param whiteboardId The whiteboard ID
   * @param userId The user ID
   * @param points The points in the path
   * @param strokeColor The stroke color
   * @param strokeWidth The stroke width
   */
  createPathElement(whiteboardId: string, userId: string, points: {x: number, y: number}[], 
                   strokeColor: string, strokeWidth: number): WhiteboardElement {
    return {
      id: `path-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      type: 'path',
      userId,
      properties: {
        points,
        strokeColor,
        strokeWidth,
      },
      position: points[0] || { x: 0, y: 0 },
      timestamp: Date.now(),
    };
  }

  /**
   * Create a shape element (rectangle, circle, etc.)
   * @param whiteboardId The whiteboard ID
   * @param userId The user ID
   * @param shapeType The shape type
   * @param x The x position
   * @param y The y position
   * @param width The width
   * @param height The height
   * @param strokeColor The stroke color
   * @param fillColor The fill color
   */
  createShapeElement(whiteboardId: string, userId: string, shapeType: 'rectangle' | 'circle' | 'triangle',
                    x: number, y: number, width: number, height: number,
                    strokeColor: string, fillColor: string): WhiteboardElement {
    return {
      id: `shape-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      type: 'shape',
      userId,
      properties: {
        shapeType,
        width,
        height,
        strokeColor,
        fillColor,
      },
      position: { x, y },
      timestamp: Date.now(),
    };
  }

  /**
   * Create a text element
   * @param whiteboardId The whiteboard ID
   * @param userId The user ID
   * @param text The text content
   * @param x The x position
   * @param y The y position
   * @param fontSize The font size
   * @param fontFamily The font family
   * @param textColor The text color
   */
  createTextElement(whiteboardId: string, userId: string, text: string,
                   x: number, y: number, fontSize: number,
                   fontFamily: string, textColor: string): WhiteboardElement {
    return {
      id: `text-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      type: 'text',
      userId,
      properties: {
        text,
        fontSize,
        fontFamily,
        textColor,
      },
      position: { x, y },
      timestamp: Date.now(),
    };
  }

  /**
   * Create an image element
   * @param whiteboardId The whiteboard ID
   * @param userId The user ID
   * @param imageUrl The image URL
   * @param x The x position
   * @param y The y position
   * @param width The width
   * @param height The height
   */
  createImageElement(whiteboardId: string, userId: string, imageUrl: string,
                    x: number, y: number, width: number, height: number): WhiteboardElement {
    return {
      id: `image-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      type: 'image',
      userId,
      properties: {
        imageUrl,
        width,
        height,
      },
      position: { x, y },
      timestamp: Date.now(),
    };
  }

  /**
   * Create a whiteboard operation
   * @param type The operation type
   * @param whiteboardId The whiteboard ID
   * @param userId The user ID
   * @param elements The elements to include in the operation
   */
  createWhiteboardOperation(type: 'add' | 'update' | 'delete' | 'clear' | 'batch',
                           whiteboardId: string, userId: string,
                           elements: WhiteboardElement[]): WhiteboardOperation {
    const whiteboard = this.getWhiteboard(whiteboardId);
    
    if (!whiteboard) {
      throw new Error(`Whiteboard with ID ${whiteboardId} not found`);
    }
    
    return {
      id: `wb-op-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      type,
      userId,
      whiteboardId,
      timestamp: Date.now(),
      version: whiteboard.version,
      elements,
    };
  }
}