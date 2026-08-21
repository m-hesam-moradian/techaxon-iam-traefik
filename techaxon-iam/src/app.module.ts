import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import couchdbConfig from './config/couchdb.config';
import jwtConfig from './config/jwt.config';
import appConfig from './config/app.config';
import clientsConfig from './config/clients.config';

import { CouchdbModule } from './infrastructure/couchdb/couchdb.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { SessionModule } from './sessions/session.module';

import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [couchdbConfig, jwtConfig, appConfig, clientsConfig],
    }),

    CouchdbModule,
    AuthModule,
    UsersModule,
    SessionModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
