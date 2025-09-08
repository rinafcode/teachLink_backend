import { Injectable, Logger } from '@nestjs/common';
import { Subject } from 'rxjs';
import { filter } from 'rxjs/operators';

/**
 * Interface for collaboration events
 */
export interface CollaborationEvent {
  id: string;
  type: string;
  resourceId: string;
  resourceType: 'document' | 'whiteboard' | 'other';
  userId: string;
  timestamp: number;
  data: any;
}

/**
 * Interface for collaboration session
 */
export interface CollaborationSession {
  id: string;
  resourceId: string;
  resourceType: 'document' | 'whiteboard' | 'other';
  participants: string[];
  startTime: number;
  lastActivity: number;
  active: boolean;
}

/**
 * Main service for coordinating real-time collaboration features
 */
@Injectable()
export class CollaborationService {
  private readonly logger = new Logger(CollaborationService.name);
  private readonly eventBus = new Subject<CollaborationEvent>();
  private readonly sessions = new Map<string, CollaborationSession>();

  /**
   * Create a new collaboration session
   * @param resourceId The resource ID
   * @param resourceType The resource type
   * @param userId The user ID who created the session
   */
  createSession(resourceId: string, resourceType: 'document' | 'whiteboard' | 'other', userId: string): CollaborationSession {
    const sessionId = `${resourceType}-${resourceId}-${Date.now()}`;
    
    const session: CollaborationSession = {
      id: sessionId,
      resourceId,
      resourceType,
      participants: [userId],
      startTime: Date.now(),
      lastActivity: Date.now(),
      active: true,
    };
    
    this.sessions.set(sessionId, session);
    this.logger.log(`Created collaboration session: ${sessionId} for ${resourceType} ${resourceId}`);
    
    return session;
  }

  /**
   * Join an existing collaboration session
   * @param sessionId The session ID
   * @param userId The user ID
   */
  joinSession(sessionId: string, userId: string): CollaborationSession | null {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      this.logger.warn(`Session not found: ${sessionId}`);
      return null;
    }
    
    if (!session.active) {
      this.logger.warn(`Session is not active: ${sessionId}`);
      return null;
    }
    
    if (!session.participants.includes(userId)) {
      session.participants.push(userId);
      this.logger.log(`User ${userId} joined session ${sessionId}`);
    }
    
    session.lastActivity = Date.now();
    return session;
  }

  /**
   * Leave a collaboration session
   * @param sessionId The session ID
   * @param userId The user ID
   */
  leaveSession(sessionId: string, userId: string): boolean {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      this.logger.warn(`Session not found: ${sessionId}`);
      return false;
    }
    
    session.participants = session.participants.filter(id => id !== userId);
    session.lastActivity = Date.now();
    
    this.logger.log(`User ${userId} left session ${sessionId}`);
    
    // Close session if no participants left
    if (session.participants.length === 0) {
      this.closeSession(sessionId);
    }
    
    return true;
  }

  /**
   * Close a collaboration session
   * @param sessionId The session ID
   */
  closeSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      this.logger.warn(`Session not found: ${sessionId}`);
      return false;
    }
    
    session.active = false;
    this.logger.log(`Closed collaboration session: ${sessionId}`);
    
    return true;
  }

  /**
   * Get a collaboration session by ID
   * @param sessionId The session ID
   */
  getSession(sessionId: string): CollaborationSession | null {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Get all active sessions for a resource
   * @param resourceId The resource ID
   * @param resourceType The resource type
   */
  getSessionsForResource(resourceId: string, resourceType: 'document' | 'whiteboard' | 'other'): CollaborationSession[] {
    const result: CollaborationSession[] = [];
    
    for (const session of this.sessions.values()) {
      if (session.resourceId === resourceId && 
          session.resourceType === resourceType && 
          session.active) {
        result.push(session);
      }
    }
    
    return result;
  }

  /**
   * Publish a collaboration event
   * @param event The event to publish
   */
  publishEvent(event: CollaborationEvent): void {
    this.eventBus.next({
      ...event,
      timestamp: event.timestamp || Date.now(),
    });
  }

  /**
   * Subscribe to collaboration events
   * @param resourceId The resource ID (optional)
   * @param resourceType The resource type (optional)
   */
  subscribeToEvents(resourceId?: string, resourceType?: 'document' | 'whiteboard' | 'other') {
    let observable = this.eventBus.asObservable();
    
    if (resourceId) {
      observable = observable.pipe(
        filter(event => event.resourceId === resourceId)
      );
    }
    
    if (resourceType) {
      observable = observable.pipe(
        filter(event => event.resourceType === resourceType)
      );
    }
    
    return observable;
  }

  /**
   * Get active participants for a resource
   * @param resourceId The resource ID
   * @param resourceType The resource type
   */
  getActiveParticipants(resourceId: string, resourceType: 'document' | 'whiteboard' | 'other'): string[] {
    const sessions = this.getSessionsForResource(resourceId, resourceType);
    const participants = new Set<string>();
    
    for (const session of sessions) {
      for (const userId of session.participants) {
        participants.add(userId);
      }
    }
    
    return Array.from(participants);
  }
}