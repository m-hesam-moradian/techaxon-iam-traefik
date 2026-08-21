import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { SessionRepository } from './session.repository';
import { CouchDbSessionRepository } from './couchdb-session.repository';
import { SessionService } from './session.service'; // Business Layer

@Global()
@Module({
  imports: [ConfigModule],

  providers: [
    SessionService,

    {
      provide: SessionRepository,
      useClass: CouchDbSessionRepository,
    },
  ],

  exports: [SessionService, SessionRepository],
})
export class SessionModule {}
