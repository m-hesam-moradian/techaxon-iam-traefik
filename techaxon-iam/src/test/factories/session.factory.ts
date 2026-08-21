import type { CreateSessionData } from '../../sessions/session.repository';
import type { SessionDocument } from '../../infrastructure/couchdb/documents/session.document';

/**
 * Creates session data for createSession().
 *
 * Does NOT contain _id or _rev.
 */
export function createSessionData(overrides: Partial<CreateSessionData> = {}): CreateSessionData {
  return {
    type: 'session',

    userId: 'user:1',

    refreshTokenHash: 'hash',

    status: 'active',

    expiresAt: '2030-01-01T00:00:00.000Z',

    lastAccessedAt: '2026-01-01T00:00:00.000Z',

    createdAt: '2026-01-01T00:00:00.000Z',

    updatedAt: '2026-01-01T00:00:00.000Z',

    ...overrides,
  };
}

/**
 * Creates a complete SessionDocument.
 *
 * Used for:
 * - updateSession()
 * - revokeSession()
 * - deleteSession()
 * - findById()
 */
export function createSession(overrides: Partial<SessionDocument> = {}): SessionDocument {
  return {
    _id: 'session:1',

    _rev: '1-a',

    ...createSessionData(),

    ...overrides,
  };
}
