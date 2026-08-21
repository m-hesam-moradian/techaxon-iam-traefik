// src/auth/auth-code.repository.ts

import type { AuthCodeDocument } from '../infrastructure/couchdb/documents/auth-code.document';

export interface CreateAuthCodeData {
  type: 'auth_code';

  /**
   * The opaque random authorization code value.
   */
  code: string;

  /**
   * The user this code is issued for.
   */
  userId: string;

  /**
   * The OIDC client that requested the code.
   */
  clientId: string;

  /**
   * ISO-8601 expiry timestamp, exactly 60 seconds from creation.
   */
  expiresAt: string;

  /**
   * Always false on creation; set to true after the code is redeemed.
   */
  used: boolean;

  createdAt: string;
  updatedAt: string;
}

export interface AuthCodeRepositoryResult {
  id: string;
  rev: string;
}

/**
 * Auth-code repository abstraction.
 *
 * Business logic must never depend on CouchDB directly.
 */
export abstract class AuthCodeRepository {
  /**
   * Persist a new authorization code document.
   */
  abstract saveAuthCode(id: string, data: CreateAuthCodeData): Promise<AuthCodeRepositoryResult>;

  /**
   * Retrieve an authorization code document by its code value.
   */
  abstract findByCode(code: string): Promise<AuthCodeDocument | null>;

  /**
   * Mark an authorization code as used to prevent replay attacks.
   */
  abstract markUsed(id: string, rev: string): Promise<void>;
}
