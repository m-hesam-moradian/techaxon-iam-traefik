// src\auth\token.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigType } from '@nestjs/config';

import jwtConfig from '../config/jwt.config';

import { TokenService } from './token.service';

@Module({
  imports: [
    ConfigModule.forFeature(jwtConfig),

    JwtModule.registerAsync({
      imports: [ConfigModule.forFeature(jwtConfig)],

      inject: [jwtConfig.KEY],

      useFactory: (config: ConfigType<typeof jwtConfig>) => ({
        secret: config.access.secret,
      }),
    }),
  ],

  providers: [TokenService],

  exports: [TokenService],
})
export class TokenModule {}
