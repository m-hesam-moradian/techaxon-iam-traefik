export interface CouchDbMigration {
  name: string;
  up(): Promise<void>;
}
