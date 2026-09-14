// src/infrastructure/couchdb/documents/auth-code.document.ts

import { BaseDocument } from './base.document';

/**
 * CouchDB document representing a short-lived OAuth 2.0 Authorization Code.
 *
 * Expires exactly 60 seconds after creation.
 * Can only be used once (used: true after redemption).
 *
 * PKCE (Phase 3):
 *   Add optional fields: codeChallenge?: string; codeChallengeMethod?: 'S256';
 *   Existing documents without these fields remain valid (undefined = no PKCE).
 */
export interface AuthCodeDocument extends BaseDocument {
  /**
   * Discriminator field.
   */
  type: 'auth_code';

  /**
   * The opaque, cryptographically random authorization code value.
   *
   * This is the value sent to the client as ?code=<value>.
   * Indexed for fast lookup.
   */
  code: string;

  /**
   * The user this authorization code belongs to.
   */
  userId: string;

  /**
   * The OAuth 2.0 client that initiated the authorization request.
   */
  clientId: string;

  /**
   * The exact redirect_uri used during the authorization request.
   */
  redirectUri: string;

  /**
   * ISO-8601 expiry timestamp, exactly 60 seconds after creation.
   */
  expiresAt: string;

  /**
   * Whether this code has already been redeemed.
   *
   * Prevents replay attacks — a used code must be rejected immediately.
   */
  used: boolean;
}
