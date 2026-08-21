import { CouchDbService } from '../couchdb.service';
import type { CouchDbMigration } from './migration.interface';

export class ClaimEmailIndexMigration implements CouchDbMigration {
  readonly name = 'iam_claims';

  constructor(private readonly couchDbService: CouchDbService) {}

  async up(): Promise<void> {
    const db = this.couchDbService.getDatabase();

    await db.createIndex({
      name: 'idx_claim_email',
      type: 'json',
      index: {
        fields: ['type', 'email', 'status'],
      },
      ddoc: 'iam_claims',
    });
  }
}
