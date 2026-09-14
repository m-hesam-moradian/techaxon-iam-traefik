// src/auth/couchdb-auth-code.repository.ts

import { Injectable } from '@nestjs/common';

import { CouchDbService } from '../infrastructure/couchdb/couchdb.service';
import type { AuthCodeDocument } from '../infrastructure/couchdb/documents/auth-code.document';
import { isAuthCodeDocument } from '../infrastructure/couchdb/documents/document.guards';

import {
  AuthCodeRepository,
  type CreateAuthCodeData,
  type AuthCodeRepositoryResult,
} from './auth-code.repository';

@Injectable()
export class CouchDbAuthCodeRepository implements AuthCodeRepository {
  constructor(private readonly couchDbService: CouchDbService) {}

  /**
   * Shared CouchDB connection — never instantiates nano directly.
   */
  private get db() {
    return this.couchDbService.getDatabase();
  }

  /**
   * ------------------------------------------------------------------------
   * Save Authorization Code
   * ------------------------------------------------------------------------
   *
   * Inserts a new auth_code document with the given id.
   */
  async saveAuthCode(id: string, data: CreateAuthCodeData): Promise<AuthCodeRepositoryResult> {
    const response = await this.db.insert({
      _id: id,
      ...data,
    });

    return {
      id: response.id,
      rev: response.rev,
    };
  }

  /**
   * ------------------------------------------------------------------------
   * Find By Code Value
   * ------------------------------------------------------------------------
   *
   * Looks up an auth_code document by the opaque code string.
   * Uses the idx_auth_code_lookup Mango index.
   */
  async findByCode(code: string): Promise<AuthCodeDocument | null> {
    const result = await this.db.find({
      selector: {
        type: 'auth_code',
        code,
        used: false,
      },
      limit: 1,
    });

    if (result.docs.length === 0) {
      return null;
    }

    const doc = result.docs[0];

    if (!isAuthCodeDocument(doc)) {
      return null;
    }

    return doc;
  }

  /**
   * ------------------------------------------------------------------------
   * Mark As Used
   * ------------------------------------------------------------------------
   *
   * Sets used: true to prevent code replay attacks.
   */
  async markUsed(id: string, rev: string): Promise<void> {
    const now = new Date().toISOString();

    /**
     * We intentionally do NOT re-fetch the document here.
     *
     * Using the _rev that was read during findByCode ensures CouchDB's
     * optimistic-concurrency check fires: if two requests race, only the
     * first insert wins; the second receives a 409 Conflict which the
     * service layer converts to an invalid_grant error.
     *
     * Re-fetching would give us a fresh _rev, defeating this protection.
     */
    await this.db.insert({
      _id: id,
      _rev: rev,
      used: true,
      updatedAt: now,
    } as any);
  }
}
