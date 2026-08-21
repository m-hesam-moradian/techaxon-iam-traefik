import { Injectable } from '@nestjs/common';

import { CouchDbService } from '../infrastructure/couchdb/couchdb.service';

import type { SessionDocument } from '../infrastructure/couchdb/documents/session.document';
import { isSessionDocument } from '../infrastructure/couchdb/documents/document.guards';

import {
  SessionRepository,
  type CreateSessionData,
  type RepositoryResult,
} from './session.repository';

@Injectable()
export class CouchDbSessionRepository implements SessionRepository {
  constructor(private readonly couchDbService: CouchDbService) {}

  /**
   * Shared CouchDB connection.
   */
  private get db() {
    return this.couchDbService.getDatabase();
  }

  /**
   * ------------------------------------------------------------------------
   * Create Session
   * ------------------------------------------------------------------------
   *
   * Creates a new session document.
   */
  async createSession(sessionId: string, session: CreateSessionData): Promise<RepositoryResult> {
    const response = await this.db.insert({
      _id: sessionId,
      ...session,
    });

    return {
      id: response.id,
      rev: response.rev,
    };
  }

  /**
   * ------------------------------------------------------------------------
   * Find Session By Id
   * ------------------------------------------------------------------------
   *
   * Returns the session if it exists.
   */
  async findById(sessionId: string): Promise<SessionDocument | null> {
    try {
      const document = await this.db.get(sessionId);

      if (!isSessionDocument(document)) {
        return null;
      }

      return document;
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'statusCode' in error &&
        (error as { statusCode: number }).statusCode === 404
      ) {
        return null;
      }

      throw error;
    }
  }

  /**
   * ------------------------------------------------------------------------
   * Find Sessions By User
   * ------------------------------------------------------------------------
   *
   * Returns every session belonging to a user.
   */
  async findByUserId(userId: string): Promise<SessionDocument[]> {
    const result = await this.db.find({
      selector: {
        type: 'session',
        userId,
      },
    });

    const sessions: SessionDocument[] = [];

    for (const document of result.docs) {
      if (isSessionDocument(document)) {
        sessions.push(document);
      }
    }

    return sessions;
  }

  /**
   * ------------------------------------------------------------------------
   * Find Session By Refresh Token Hash
   * ------------------------------------------------------------------------
   *
   * Refresh token hashes are unique.
   */
  async findByRefreshTokenHash(refreshTokenHash: string): Promise<SessionDocument | null> {
    const result = await this.db.find({
      selector: {
        type: 'session',
        refreshTokenHash,
      },
      limit: 1,
    });

    if (result.docs.length === 0) {
      return null;
    }

    const document = result.docs[0];

    if (!isSessionDocument(document)) {
      return null;
    }

    return document;
  }

  /**
   * ------------------------------------------------------------------------
   * Update Session
   * ------------------------------------------------------------------------
   *
   * Persists changes to an existing session document.
   */
  async updateSession(session: SessionDocument): Promise<RepositoryResult> {
    const response = await this.db.insert(session);

    return {
      id: response.id,
      rev: response.rev,
    };
  }

  /**
   * ------------------------------------------------------------------------
   * Revoke Session
   * ------------------------------------------------------------------------
   *
   * Revokes a single session.
   */
  async revokeSession(sessionId: string): Promise<void> {
    const session = await this.findById(sessionId);

    if (!session) {
      return;
    }

    const now = new Date().toISOString();

    session.status = 'revoked';
    session.revokedAt = now;
    session.updatedAt = now;

    await this.db.insert(session);
  }

  /**
   * ------------------------------------------------------------------------
   * Revoke All User Sessions
   * ------------------------------------------------------------------------
   *
   * Revokes every session belonging to a user.
   */
  async revokeAllUserSessions(userId: string): Promise<void> {
    const sessions = await this.findByUserId(userId);

    const now = new Date().toISOString();

    for (const session of sessions) {
      session.status = 'revoked';
      session.revokedAt = now;
      session.updatedAt = now;

      await this.db.insert(session);
    }
  }

  /**
   * ------------------------------------------------------------------------
   * Delete Session
   * ------------------------------------------------------------------------
   *
   * Permanently removes a session document.
   */
  async deleteSession(sessionId: string): Promise<void> {
    const session = await this.findById(sessionId);

    if (!session?._rev) {
      return;
    }

    await this.db.destroy(sessionId, session._rev);
  }

  /**
   * ------------------------------------------------------------------------
   * Delete Expired Sessions
   * ------------------------------------------------------------------------
   *
   * Deletes every session whose expiration date
   * is older than the provided timestamp.
   *
   * Returns the number of deleted documents.
   */
  async deleteExpiredSessions(before: string): Promise<number> {
    const result = await this.db.find({
      selector: {
        type: 'session',
        expiresAt: {
          $lt: before,
        },
      },
    });

    let deleted = 0;

    for (const session of result.docs.filter(isSessionDocument)) {
      if (!session._id || !session._rev) {
        continue;
      }

      await this.db.destroy(session._id, session._rev);
      deleted++;
    }

    return deleted;
  }
}
