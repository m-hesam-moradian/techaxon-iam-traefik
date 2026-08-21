import { BaseDocument } from './base.document';

export interface MigrationDocument extends BaseDocument {
  type: 'migration';

  name: string;

  executedAt: string;
}
