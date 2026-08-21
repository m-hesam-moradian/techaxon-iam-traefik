// src/auth/strategies/jwt.strategy.ts

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

import type { JwtPayload } from '../interfaces/jwt-payload.interface';
import { SessionService } from '../../sessions/session.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly configService: ConfigService,
    private readonly sessionService: SessionService,
  ) {
    const secret = configService.get<string>('JWT_ACCESS_SECRET') || 'default_secret';

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  /**
   * Passport به‌طور خودکار توکن را Decode کرده و Payload را به این متد پاس می‌دهد.
   */
  async validate(payload: JwtPayload) {
    // ۱. بررسی نوع توکن
    if (payload.type !== 'access') {
      throw new UnauthorizedException('Invalid token type');
    }

    // ۲. بررسی فعال بودن جلسه (Session) مربوطه
    const session = await this.sessionService.findSessionById(payload.sid);
    if (!session || session.status !== 'active') {
      throw new UnauthorizedException('Session is inactive or revoked');
    }

    // این آبجکت روی req.user قرار می‌گیرد
    return {
      userId: payload.sub,
      sessionId: payload.sid,
    };
  }
}
