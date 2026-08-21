import { CouchDbService } from '../couchdb.service';

import { UserEmailIndexMigration } from './001-user-email-index.migration';
import { ClaimEmailIndexMigration } from './002-claim-email-index.migration';
import { SessionIndexMigration } from './003-session-index.migration';
import { VerificationTokenIndexMigration } from './004-verification-token-index.migration';
import { AuthCodeIndexMigration } from './005-auth-code-index.migration';

import type { CouchDbMigration } from './migration.interface';

export function getMigrations(couchDbService: CouchDbService): CouchDbMigration[] {
  return [
    new UserEmailIndexMigration(couchDbService),
    new SessionIndexMigration(couchDbService),
    new ClaimEmailIndexMigration(couchDbService),
    new VerificationTokenIndexMigration(couchDbService),
    new AuthCodeIndexMigration(couchDbService),
  ];
}
