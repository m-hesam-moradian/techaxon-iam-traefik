import { Injectable, Logger } from '@nestjs/common';

import { MigrationRepository } from './migration.repository';
import { getMigrations } from './migration.registry';

import { CouchDbService } from '../couchdb.service';

@Injectable()
export class MigrationRunner {
  private readonly logger = new Logger(MigrationRunner.name);

  constructor(
    private readonly couchDbService: CouchDbService,
    private readonly migrationRepository: MigrationRepository,
  ) {}

  async run(): Promise<void> {
    const migrations = getMigrations(this.couchDbService);

    for (const migration of migrations) {
      const executed = await this.migrationRepository.hasRun(migration.name);

      if (executed) {
        this.logger.log(`Migration skipped: ${migration.name}`);

        continue;
      }

      await migration.up();

      await this.migrationRepository.save(migration.name);

      this.logger.log(`Migration executed: ${migration.name}`);
    }
  }
}
