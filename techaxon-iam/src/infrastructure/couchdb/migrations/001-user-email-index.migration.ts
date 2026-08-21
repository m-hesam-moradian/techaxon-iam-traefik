import { CouchDbService } from '../couchdb.service';
import type { CouchDbMigration } from './migration.interface';

export class UserEmailIndexMigration implements CouchDbMigration {
  name = 'iam_users';

  constructor(private readonly couchDbService: CouchDbService) {}

  async up(): Promise<void> {
    const db = this.couchDbService.getDatabase();

    await db.createIndex({
      name: 'idx_user_email',
      type: 'json',
      index: {
        fields: ['type', 'email'],
      },
      ddoc: 'iam_users',
    });
  }
}
