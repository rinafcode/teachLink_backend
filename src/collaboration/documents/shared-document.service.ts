import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

export interface DocumentOperation {
  id: string;
  type: 'insert' | 'delete' | 'update';
  position: number;
  content?: string;
  length?: number;
  timestamp: number;
  userId: string;
}

export interface CollaborativeDocument {
  id: string;
  content: string;
  operations: DocumentOperation[];
  collaborators: string[];
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class SharedDocumentService {
  private readonly logger = Logger;
  private documents: Map<string, CollaborativeDocument> = new Map();

  /**
   * Initialize a new collaborative document
   */
  async initializeDocument(documentId: string): Promise<CollaborativeDocument> {
    const document: CollaborativeDocument = {
      id: documentId,
      content: '',
      operations: [],
      collaborators: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.documents.set(documentId, document);
    this.logger.log(`Initialized document ${documentId}`);
    
    return document;
  }

  /**
   * Get a collaborative document
   */
  async getDocument(documentId: string): Promise<CollaborativeDocument | null> {
    return this.documents.get(documentId) || null;
  }

  /**
   * Apply an operation to a document using operational transformation
   */
  async applyOperation(
    documentId: string,
    userId: string,
    operation: Omit<DocumentOperation, 'id' | 'timestamp'>
  ): Promise<CollaborativeDocument> {
    const document = this.documents.get(documentId);
    if (!document) {
      throw new Error(`Document ${documentId} not found`);
    }

    // Add metadata to the operation
    const opWithMetadata: DocumentOperation = {
      ...operation,
      id: uuidv4(),
      timestamp: Date.now(),
      userId,
    };

    // Transform the operation against concurrent operations
    const transformedOp = this.transformOperation(opWithMetadata, document.operations);

    // Apply the transformed operation to the document content
    document.content = this.applyOperationToContent(document.content, transformedOp);

    // Add the operation to the document's operation history
    document.operations.push(transformedOp);
    document.updatedAt = new Date();

    // Add user to collaborators if not already present
    if (!document.collaborators.includes(userId)) {
      document.collaborators.push(userId);
    }

    this.logger.log(`Applied operation ${transformedOp.id} to document ${documentId}`);
    
    return document;
  }

  /**
   * Transform an operation against a list of concurrent operations
   */
  private transformOperation(
    operation: DocumentOperation,
    concurrentOperations: DocumentOperation[]
  ): DocumentOperation {
    let transformedOp = { ...operation };

    for (const concurrentOp of concurrentOperations) {
      // Only transform if operations affect overlapping positions
      if (this.operationsOverlap(transformedOp, concurrentOp)) {
        transformedOp = this.transformSingleOperation(transformedOp, concurrentOp);
      }
    }

    return transformedOp;
  }

  /**
   * Check if two operations overlap in their effect on document content
   */
  private operationsOverlap(op1: DocumentOperation, op2: DocumentOperation): boolean {
    // Operations don't overlap if one happens before the other ends
    if (op1.type === 'insert' && op2.type === 'insert') {
      // Two inserts at the same position need transformation
      return op1.position === op2.position;
    }

    if (op1.type === 'insert') {
      // Insert and another operation overlap if insert position is within or adjacent to other operation
      return op2.position <= op1.position && op1.position <= op2.position + (op2.length || (op2.content?.length || 0));
    }

    if (op2.type === 'insert') {
      // Same as above but reversed
      return op1.position <= op2.position && op2.position <= op1.position + (op1.length || (op1.content?.length || 0));
    }

    // Both are delete/update operations - overlap if ranges intersect
    const op1End = op1.position + (op1.length || (op1.content?.length || 0));
    const op2End = op2.position + (op2.length || (op2.content?.length || 0));
    return !(op1.position >= op2End || op2.position >= op1End);
  }

  /**
   * Transform a single operation against a concurrent operation
   */
  private transformSingleOperation(
    operation: DocumentOperation,
    concurrentOp: DocumentOperation
  ): DocumentOperation {
    const transformedOp = { ...operation };

    // Adjust positions based on concurrent operations
    if (concurrentOp.type === 'insert' && operation.position >= concurrentOp.position) {
      // If concurrent operation inserted text before our operation, adjust position
      transformedOp.position += concurrentOp.content ? concurrentOp.content.length : 0;
    } else if (concurrentOp.type === 'delete') {
      const concurrentEnd = concurrentOp.position + concurrentOp.length;
      
      if (operation.position >= concurrentEnd) {
        // Operation is after the deleted range, adjust position
        transformedOp.position -= concurrentOp.length;
      } else if (operation.position > concurrentOp.position) {
        // Operation starts within the deleted range, clamp to start of deletion
        transformedOp.position = concurrentOp.position;
      }
      // If operation starts before the deletion, position stays the same
    }

    return transformedOp;
  }

  /**
   * Apply an operation to document content
   */
  private applyOperationToContent(content: string, operation: DocumentOperation): string {
    switch (operation.type) {
      case 'insert':
        if (operation.content !== undefined) {
          return content.slice(0, operation.position) + 
                 operation.content + 
                 content.slice(operation.position);
        }
        return content;
        
      case 'delete':
        if (operation.length !== undefined) {
          return content.slice(0, operation.position) + 
                 content.slice(operation.position + operation.length);
        }
        return content;
        
      case 'update':
        if (operation.content !== undefined && operation.length !== undefined) {
          return content.slice(0, operation.position) + 
                 operation.content + 
                 content.slice(operation.position + operation.length);
        }
        return content;
        
      default:
        return content;
    }
  }

  /**
   * Resolve conflicts between simultaneous edits
   */
  async resolveConflicts(documentId: string, operations: DocumentOperation[]): Promise<CollaborativeDocument> {
    const document = this.documents.get(documentId);
    if (!document) {
      throw new Error(`Document ${documentId} not found`);
    }

    // Sort operations by timestamp to process in chronological order
    const sortedOps = [...operations].sort((a, b) => a.timestamp - b.timestamp);

    // Clear existing operations and reapply in order to resolve conflicts
    document.operations = [];
    document.content = '';

    // Rebuild document content from the sorted operations
    for (const operation of sortedOps) {
      document.content = this.applyOperationToContent(document.content, operation);
      document.operations.push(operation);
    }

    document.updatedAt = new Date();
    
    return document;
  }

  /**
   * Get document history
   */
  async getDocumentHistory(documentId: string): Promise<DocumentOperation[]> {
    const document = this.documents.get(documentId);
    if (!document) {
      throw new Error(`Document ${documentId} not found`);
    }

    return [...document.operations];
  }
}