import { registerAs } from '@nestjs/config';

export default registerAs('couchdb', () => ({
  url: process.env.COUCHDB_URL!,
  database: process.env.COUCHDB_DATABASE!,
  autoCreateDatabase: process.env.COUCHDB_AUTO_CREATE_DATABASE,
}));
