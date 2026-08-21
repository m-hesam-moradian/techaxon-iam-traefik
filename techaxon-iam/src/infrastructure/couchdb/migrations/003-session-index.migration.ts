import { CouchDbService } from '../couchdb.service';
import type { CouchDbMigration } from './migration.interface';

export class SessionIndexMigration implements CouchDbMigration {
  readonly name = 'iam_sessions';

  constructor(private readonly couchDbService: CouchDbService) {}

  async up(): Promise<void> {
    const db = this.couchDbService.getDatabase();

    /**
     * Find all sessions belonging to a user.
     *
     * Used by:
     * - Session dashboard
     * - Logout all devices
     * - Security settings
     */
    await db.createIndex({
      name: 'session-user-index',
      type: 'json',
      index: {
        fields: ['type', 'userId'],
      },
      ddoc: 'iam_sessions',
    });

    /**
     * Lookup a session by refresh token hash.
     *
     * Used during refresh token rotation.
     */
    await db.createIndex({
      name: 'session-refresh-token-index',
      type: 'json',
      index: {
        fields: ['type', 'refreshTokenHash'],
      },
      ddoc: 'iam_sessions',
    });

    /**
     * Find expired sessions.
     *
     * Used by scheduled cleanup jobs.
     */
    await db.createIndex({
      name: 'session-expiration-index',
      type: 'json',
      index: {
        fields: ['type', 'expiresAt'],
      },
      ddoc: 'iam_sessions',
    });
    // Hesam
    await db.createIndex({
      name: 'idx_session_user',
      type: 'json',
      index: {
        fields: ['type', 'userId', 'status'],
      },
      ddoc: 'iam_sessions',
    });
    // Hesam
    await db.createIndex({
      name: 'idx_session_cleanup',
      type: 'json',
      index: {
        fields: ['type', 'status', 'expiresAt'],
      },
      ddoc: 'iam_sessions',
    });

    console.log('✓ Session indexes created.');
  }
}
