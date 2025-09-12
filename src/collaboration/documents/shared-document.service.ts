import { Injectable, Logger } from '@nestjs/common';
import { CollaborationService, CollaborationEvent } from '../collaboration.service';
import { Subject } from 'rxjs';

/**
 * Interface for document operation
 */
export interface DocumentOperation {
  id: string;
  userId: string;
  documentId: string;
  timestamp: number;
  version: number;
  operations: TextOperation[];
}

/**
 * Interface for text operation
 */
export interface TextOperation {
  type: 'insert' | 'delete' | 'retain';
  position: number;
  text?: string;
  length?: number;
}

/**
 * Interface for document state
 */
export interface DocumentState {
  id: string;
  content: string;
  version: number;
  lastModified: number;
  createdBy: string;
  lastModifiedBy: string;
}

/**
 * Service for shared document collaboration with operational transformation
 */
@Injectable()
export class SharedDocumentService {
  private readonly logger = new Logger(SharedDocumentService.name);
  private readonly documents = new Map<string, DocumentState>();
  private readonly operationHistory = new Map<string, DocumentOperation[]>();
  private readonly documentEvents = new Subject<CollaborationEvent>();
  
  constructor(private readonly collaborationService: CollaborationService) {}

  /**
   * Create a new shared document
   * @param id Document ID
   * @param initialContent Initial document content
   * @param userId User ID of the creator
   */
  createDocument(id: string, initialContent: string, userId: string): DocumentState {
    if (this.documents.has(id)) {
      throw new Error(`Document with ID ${id} already exists`);
    }
    
    const document: DocumentState = {
      id,
      content: initialContent,
      version: 0,
      lastModified: Date.now(),
      createdBy: userId,
      lastModifiedBy: userId,
    };
    
    this.documents.set(id, document);
    this.operationHistory.set(id, []);
    
    this.logger.log(`Created document: ${id} by user ${userId}`);
    
    // Create a collaboration session for this document
    this.collaborationService.createSession(id, 'document', userId);
    
    return document;
  }

  /**
   * Get a document by ID
   * @param id Document ID
   */
  getDocument(id: string): DocumentState | null {
    return this.documents.get(id) || null;
  }

  /**
   * Apply an operation to a document using operational transformation
   * @param operation The operation to apply
   */
  applyOperation(operation: DocumentOperation): DocumentState {
    const document = this.documents.get(operation.documentId);
    
    if (!document) {
      throw new Error(`Document with ID ${operation.documentId} not found`);
    }
    
    // Get the history of operations for this document
    const history = this.operationHistory.get(operation.documentId) || [];
    
    // Check if the operation is based on the current version
    if (operation.version !== document.version) {
      // Need to transform the operation against all operations since the base version
      const concurrentOperations = history.filter(op => op.version >= operation.version);
      
      // Transform the operation against each concurrent operation
      let transformedOperation = { ...operation };
      for (const concurrentOp of concurrentOperations) {
        transformedOperation = this.transformOperation(transformedOperation, concurrentOp);
      }
      
      // Apply the transformed operation
      this.applyTransformedOperation(document, transformedOperation);
    } else {
      // Apply the operation directly
      this.applyTransformedOperation(document, operation);
    }
    
    // Update document metadata
    document.version++;
    document.lastModified = Date.now();
    document.lastModifiedBy = operation.userId;
    
    // Add the operation to history
    history.push(operation);
    this.operationHistory.set(operation.documentId, history);
    
    // Publish the event
    this.publishDocumentEvent({
      id: `doc-op-${operation.id}`,
      type: 'document-operation',
      resourceId: operation.documentId,
      resourceType: 'document',
      userId: operation.userId,
      timestamp: Date.now(),
      data: operation,
    });
    
    return document;
  }

  /**
   * Transform an operation against another concurrent operation
   * @param operation The operation to transform
   * @param concurrentOperation The concurrent operation
   */
  private transformOperation(operation: DocumentOperation, concurrentOperation: DocumentOperation): DocumentOperation {
    // Create a new operation with transformed text operations
    const transformedOperations: TextOperation[] = [];
    
    // For each text operation in the original operation
    for (const textOp of operation.operations) {
      // Transform this text operation against all concurrent text operations
      let transformedOp = { ...textOp };
      
      for (const concurrentTextOp of concurrentOperation.operations) {
        transformedOp = this.transformTextOperation(transformedOp, concurrentTextOp);
      }
      
      transformedOperations.push(transformedOp);
    }
    
    return {
      ...operation,
      operations: transformedOperations,
      version: concurrentOperation.version + 1, // Update the version
    };
  }

  /**
   * Transform a text operation against another concurrent text operation
   * @param op The text operation to transform
   * @param concurrentOp The concurrent text operation
   */
  private transformTextOperation(op: TextOperation, concurrentOp: TextOperation): TextOperation {
    // Implement operational transformation rules
    // This is a simplified implementation
    
    // If operations are at different positions, no transformation needed
    if (op.position > concurrentOp.position + (concurrentOp.length || 0)) {
      return op;
    }
    
    // If concurrent operation is before this one, adjust position
    if (concurrentOp.position < op.position) {
      if (concurrentOp.type === 'insert' && concurrentOp.text) {
        // Shift position forward for inserts
        return {
          ...op,
          position: op.position + concurrentOp.text.length,
        };
      } else if (concurrentOp.type === 'delete' && concurrentOp.length) {
        // Shift position backward for deletes
        return {
          ...op,
          position: Math.max(concurrentOp.position, op.position - concurrentOp.length),
        };
      }
    }
    
    // Handle more complex cases (overlapping operations)
    // This would require a more sophisticated implementation
    
    return op;
  }

  /**
   * Apply a transformed operation to a document
   * @param document The document to modify
   * @param operation The operation to apply
   */
  private applyTransformedOperation(document: DocumentState, operation: DocumentOperation): void {
    let content = document.content;
    
    // Apply each text operation in sequence
    for (const textOp of operation.operations) {
      if (textOp.type === 'insert' && textOp.text) {
        // Insert text at position
        content = content.substring(0, textOp.position) + 
                 textOp.text + 
                 content.substring(textOp.position);
      } else if (textOp.type === 'delete' && textOp.length) {
        // Delete text at position
        content = content.substring(0, textOp.position) + 
                 content.substring(textOp.position + textOp.length);
      } else if (textOp.type === 'retain') {
        // Retain operation - no change to content
      }
    }
    
    document.content = content;
  }

  /**
   * Publish a document event
   * @param event The event to publish
   */
  private publishDocumentEvent(event: CollaborationEvent): void {
    this.documentEvents.next(event);
    this.collaborationService.publishEvent(event);
  }

  /**
   * Subscribe to document events
   * @param documentId Optional document ID to filter events
   */
  subscribeToDocumentEvents(documentId?: string) {
    let events = this.documentEvents.asObservable();
    
    if (documentId) {
      events = events.pipe(
        filter(event => event.resourceId === documentId)
      );
    }
    
    return events;
  }

  /**
   * Get the operation history for a document
   * @param documentId The document ID
   * @param limit Optional limit on the number of operations to return
   */
  getOperationHistory(documentId: string, limit?: number): DocumentOperation[] {
    const history = this.operationHistory.get(documentId) || [];
    
    if (limit && limit > 0) {
      return history.slice(-limit);
    }
    
    return history;
  }

  /**
   * Create a new text operation
   * @param type The operation type
   * @param position The position in the document
   * @param text The text to insert (for insert operations)
   * @param length The length to delete or retain (for delete/retain operations)
   */
  createTextOperation(type: 'insert' | 'delete' | 'retain', position: number, text?: string, length?: number): TextOperation {
    return { type, position, text, length };
  }

  /**
   * Create a document operation from text operations
   * @param documentId The document ID
   * @param userId The user ID
   * @param textOperations The text operations to include
   */
  createDocumentOperation(documentId: string, userId: string, textOperations: TextOperation[]): DocumentOperation {
    const document = this.getDocument(documentId);
    
    if (!document) {
      throw new Error(`Document with ID ${documentId} not found`);
    }
    
    return {
      id: `op-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      userId,
      documentId,
      timestamp: Date.now(),
      version: document.version,
      operations: textOperations,
    };
  }
}