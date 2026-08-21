import { BaseDocument } from './base.document';

/**
 * Possible lifecycle states of a session.
 */
export type SessionStatus = 'active' | 'revoked' | 'expired';

/**
 * CouchDB document representing a user session.
 *
 * Each session owns exactly one refresh token.
 */
export interface SessionDocument extends BaseDocument {
  /**
   * Discriminator.
   */
  type: 'session';

  /**
   * Owner of this session.
   */
  userId: string;

  /**
   * SHA-256 / Argon2 hash of the refresh token.
   *
   * Never store the raw refresh token.
   */
  refreshTokenHash: string;

  /**
   * Optional client-generated device identifier.
   *
   * Useful for mobile applications.
   */
  deviceId?: string;

  /**
   * Client IP address.
   */
  ip?: string;

  /**
   * Browser / client user agent.
   */
  userAgent?: string;

  /**
   * Current session status.
   */
  status: SessionStatus;

  /**
   * Session expiration timestamp.
   */
  expiresAt: string;

  /**
   * Last successful activity.
   *
   * Updated after every successful refresh.
   */
  lastAccessedAt: string;

  /**
   * Filled only after revocation.
   */
  revokedAt?: string;
}
