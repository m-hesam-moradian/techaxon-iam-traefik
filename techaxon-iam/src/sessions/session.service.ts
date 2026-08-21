// src/sessions/session.service.ts

import { Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import { SessionRepository, type CreateSessionData } from './session.repository';
import type { SessionDocument } from '../infrastructure/couchdb/documents/session.document';

@Injectable()
export class SessionService {
  constructor(private readonly sessionRepository: SessionRepository) {}

  /**
   * Creates a new authenticated session.
   * Accepts an optional customSessionId to keep JWT payload and DB document IDs aligned.
   */
  async createSession(
    userId: string,
    refreshTokenHash: string,
    expiresAt: string,
    customSessionId?: string, // 👈 پارامتر چهارم اضافه شد
  ): Promise<SessionDocument> {
    const now = new Date().toISOString();

    // اگر customSessionId پاس داده شده بود از همان استفاده می‌کند، در غیر این صورت یک UUID جدید می‌سازد
    const sessionId = customSessionId || `session:${uuidv7()}`;

    const sessionData: CreateSessionData = {
      type: 'session',
      userId,
      refreshTokenHash,
      status: 'active',
      expiresAt,
      lastAccessedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    const result = await this.sessionRepository.createSession(sessionId, sessionData);

    return {
      _id: result.id,
      _rev: result.rev,
      ...sessionData,
    };
  }

  /**
   * Finds a session by its ID.
   */
  async findSessionById(sessionId: string): Promise<SessionDocument | null> {
    return await this.sessionRepository.findById(sessionId);
  }

  /**
   * Revokes a session by delegate to repository or updating status.
   */
  async revokeSession(sessionId: string): Promise<void> {
    await this.sessionRepository.revokeSession(sessionId);
  }
}

// findById()
// findByUserId()
// findByRefreshTokenHash()
// updateSession()
// revokeSession()
// revokeAllUserSessions()
// deleteSession()
// deleteExpiredSessions()
