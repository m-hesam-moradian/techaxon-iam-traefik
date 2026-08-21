// src/infrastructure/couchdb/migrations/005-auth-code-index.migration.ts

import { CouchDbService } from '../couchdb.service';
import type { CouchDbMigration } from './migration.interface';

/**
 * Creates the Mango index required to efficiently look up
 * authorization code documents by their code value and used status.
 *
 * Index name : idx_auth_code_lookup
 * Design doc : iam_auth_codes
 * Fields     : ['type', 'code', 'used']
 * Purpose    : Used by CouchDbAuthCodeRepository.findByCode() during
 *              OIDC authorization code exchange.
 *
 * Manual creation (curl):
 * curl -X POST <DB_URL>/_index \
 *   -H "Content-Type: application/json" \
 *   -d '{
 *     "index": {"fields": ["type", "code", "used"]},
 *     "name": "idx_auth_code_lookup",
 *     "ddoc": "iam_auth_codes",
 *     "type": "json"
 *   }'
 */
export class AuthCodeIndexMigration implements CouchDbMigration {
  name = 'auth_code_index';

  constructor(private readonly couchDbService: CouchDbService) {}

  async up(): Promise<void> {
    const db = this.couchDbService.getDatabase();

    await db.createIndex({
      name: 'idx_auth_code_lookup',
      type: 'json',
      index: {
        fields: ['type', 'code', 'used'],
      },
      ddoc: 'iam_auth_codes',
    });
  }
}
