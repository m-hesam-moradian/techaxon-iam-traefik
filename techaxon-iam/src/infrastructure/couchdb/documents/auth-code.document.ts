// src/infrastructure/couchdb/documents/auth-code.document.ts

import { BaseDocument } from './base.document';

/**
 * CouchDB document representing a short-lived OIDC Authorization Code.
 *
 * Expires exactly 60 seconds after creation.
 * Can only be used once (used: true after redemption).
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
   * The OIDC client that initiated the authorization request.
   */
  clientId: string;

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
