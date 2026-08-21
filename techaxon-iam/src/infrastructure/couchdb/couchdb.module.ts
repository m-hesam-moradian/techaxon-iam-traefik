import { Global, Module } from '@nestjs/common';

import { CouchDbService } from './couchdb.service';
import { MigrationRunner } from './migrations/migration.runner';
import { MigrationRepository } from './migrations/migration.repository';

import { UserRepository } from '../../users/user.repository';

@Global()
@Module({
  providers: [
    CouchDbService,

    MigrationRepository,
    MigrationRunner,

    {
      provide: UserRepository,
      useExisting: CouchDbService,
    },
  ],
  exports: [CouchDbService, UserRepository],
})
export class CouchdbModule {}
