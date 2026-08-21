// src/users/users.module.ts

import { Module } from '@nestjs/common';

import { UserRepository } from './user.repository';
import { CouchDbUserRepository } from './couchdb-user.repository';

@Module({
  providers: [
    {
      provide: UserRepository,
      useClass: CouchDbUserRepository,
    },
  ],
  exports: [UserRepository],
})
export class UsersModule {}
