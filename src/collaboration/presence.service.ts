import { Injectable } from '@nestjs/common';

export interface PresenceInfo {
  userId: string;
  sessionId: string;
  joinedAt: Date;
  lastSeenAt: Date;
  cursorPosition?: number;
}

@Injectable()
export class PresenceService {
  // sessionId -> userId -> PresenceInfo
  private readonly sessions = new Map<string, Map<string, PresenceInfo>>();

  join(sessionId: string, userId: string): PresenceInfo {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, new Map());
    }
    const now = new Date();
    const info: PresenceInfo = { userId, sessionId, joinedAt: now, lastSeenAt: now };
    this.sessions.get(sessionId)!.set(userId, info);
    return info;
  }

  leave(sessionId: string, userId: string): void {
    this.sessions.get(sessionId)?.delete(userId);
    if (this.sessions.get(sessionId)?.size === 0) {
      this.sessions.delete(sessionId);
    }
  }

  updateCursor(sessionId: string, userId: string, cursorPosition: number): void {
    const info = this.sessions.get(sessionId)?.get(userId);
    if (info) {
      info.cursorPosition = cursorPosition;
      info.lastSeenAt = new Date();
    }
  }

  getPresence(sessionId: string): PresenceInfo[] {
    return Array.from(this.sessions.get(sessionId)?.values() ?? []);
  }

  isPresent(sessionId: string, userId: string): boolean {
    return this.sessions.get(sessionId)?.has(userId) ?? false;
  }
}
