// src/auth/auth.module.ts

import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';

import { AuthService } from './auth.service';
import { MfaService } from './mfa.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { SessionModule } from '../sessions/session.module';
import { UsersModule } from '../users/users.module';
import { TokenModule } from './token.module';
import { AuthCodeRepository } from './auth-code.repository';
import { CouchDbAuthCodeRepository } from './couchdb-auth-code.repository';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({}),
    UsersModule,
    SessionModule,
    TokenModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    MfaService,
    JwtStrategy,
    {
      provide: AuthCodeRepository,
      useClass: CouchDbAuthCodeRepository,
    },
  ],
  exports: [AuthService, MfaService, JwtStrategy, PassportModule],
})
export class AuthModule {}
