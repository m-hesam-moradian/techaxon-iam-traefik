import { Injectable } from '@nestjs/common';
import { CouchDbService } from '../couchdb.service';

interface MigrationDocument {
  _id: string;
  type: 'migration';
  name: string;
  executedAt: string;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class MigrationRepository {
  private readonly migrationPrefix = 'migration:';

  constructor(private readonly couchDbService: CouchDbService) {}

  private get db() {
    return this.couchDbService.getDatabase();
  }

  async hasRun(name: string): Promise<boolean> {
    const id = `${this.migrationPrefix}${name}`;

    try {
      await this.db.get(id);
      return true;
    } catch {
      return false;
    }
  }

  async save(name: string): Promise<void> {
    const now = new Date().toISOString();

    const document: MigrationDocument = {
      _id: `${this.migrationPrefix}${name}`,
      type: 'migration',
      name,
      executedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    await this.db.insert(document);
  }
}
