import { Test, TestingModule } from '@nestjs/testing';
import { SharedDocumentService, DocumentOperation, TextOperation } from './shared-document.service';

describe('SharedDocumentService', () => {
  let service: SharedDocumentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SharedDocumentService],
    }).compile();

    service = module.get<SharedDocumentService>(SharedDocumentService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Document Operations', () => {
    let documentId: string;

    beforeEach(() => {
      // Create a test document before each test
      const result = service.createDocument('Test Document', 'Initial content', 'user1');
      documentId = result.id;
    });

    it('should create a document with correct initial state', () => {
      const document = service.getDocument(documentId);
      expect(document).toBeDefined();
      expect(document.name).toBe('Test Document');
      expect(document.content).toBe('Initial content');
      expect(document.ownerId).toBe('user1');
    });

    it('should apply insert operations correctly', () => {
      // Apply an insert operation
      const operation: DocumentOperation = {
        id: 'op1',
        userId: 'user1',
        documentId,
        timestamp: Date.now(),
        version: 1,
        operations: [
          {
            type: 'insert',
            position: 8, // After "Initial "
            text: 'test ',
          } as TextOperation,
        ],
      };

      service.applyOperation(documentId, operation);
      const document = service.getDocument(documentId);
      expect(document.content).toBe('Initial test content');
    });

    it('should apply delete operations correctly', () => {
      // Apply a delete operation
      const operation: DocumentOperation = {
        id: 'op2',
        userId: 'user1',
        documentId,
        timestamp: Date.now(),
        version: 1,
        operations: [
          {
            type: 'delete',
            position: 8, // After "Initial "
            length: 7, // Delete "content"
          } as TextOperation,
        ],
      };

      service.applyOperation(documentId, operation);
      const document = service.getDocument(documentId);
      expect(document.content).toBe('Initial ');
    });

    it('should transform concurrent operations correctly', () => {
      // Create two concurrent operations
      const op1: DocumentOperation = {
        id: 'op1',
        userId: 'user1',
        documentId,
        timestamp: Date.now(),
        version: 1,
        operations: [
          {
            type: 'insert',
            position: 0,
            text: 'Hello, ',
          } as TextOperation,
        ],
      };

      const op2: DocumentOperation = {
        id: 'op2',
        userId: 'user2',
        documentId,
        timestamp: Date.now(),
        version: 1,
        operations: [
          {
            type: 'insert',
            position: 15, // At the end
            text: '!',
          } as TextOperation,
        ],
      };

      // Apply operations in different order and check for consistency
      service.applyOperation(documentId, op1);
      service.applyOperation(documentId, op2);
      const result1 = service.getDocument(documentId).content;

      // Reset document
      const newDoc = service.createDocument('Test Document 2', 'Initial content', 'user1');
      const newDocId = newDoc.id;

      // Apply in reverse order
      service.applyOperation(newDocId, op2);
      service.applyOperation(newDocId, op1);
      const result2 = service.getDocument(newDocId).content;

      // Results should be consistent regardless of operation order
      expect(result1).toBe(result2);
      expect(result1).toBe('Hello, Initial content!');
    });

    it('should maintain operation history', () => {
      // Apply multiple operations
      const op1: DocumentOperation = {
        id: 'op1',
        userId: 'user1',
        documentId,
        timestamp: Date.now(),
        version: 1,
        operations: [
          {
            type: 'insert',
            position: 0,
            text: 'Hello, ',
          } as TextOperation,
        ],
      };

      const op2: DocumentOperation = {
        id: 'op2',
        userId: 'user2',
        documentId,
        timestamp: Date.now() + 100,
        version: 2,
        operations: [
          {
            type: 'insert',
            position: 15, // After "Hello, Initial "
            text: 'modified ',
          } as TextOperation,
        ],
      };

      service.applyOperation(documentId, op1);
      service.applyOperation(documentId, op2);

      // Check history
      const history = service.getOperationHistory(documentId);
      expect(history.length).toBe(2);
      expect(history[0].id).toBe('op1');
      expect(history[1].id).toBe('op2');
    });
  });

  describe('Event Subscription', () => {
    it('should emit events when operations are applied', (done) => {
      // Create a test document
      const doc = service.createDocument('Event Test', 'Test content', 'user1');
      const documentId = doc.id;

      // Subscribe to document events
      service.subscribeToDocumentEvents(documentId).subscribe(event => {
        expect(event.documentId).toBe(documentId);
        expect(event.operation.id).toBe('event-op');
        done();
      });

      // Apply an operation to trigger the event
      const operation: DocumentOperation = {
        id: 'event-op',
        userId: 'user1',
        documentId,
        timestamp: Date.now(),
        version: 1,
        operations: [
          {
            type: 'insert',
            position: 5, // After "Test "
            text: 'new ',
          } as TextOperation,
        ],
      };

      service.applyOperation(documentId, operation);
    });
  });
});