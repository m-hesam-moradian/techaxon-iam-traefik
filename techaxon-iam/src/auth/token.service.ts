import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { ConfigType } from '@nestjs/config';

import jwtConfig from '../config/jwt.config';

import type { JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,

    @Inject(jwtConfig.KEY)
    private readonly config: ConfigType<typeof jwtConfig>,
  ) {}

  // ==========================================
  // TOKEN GENERATION METHODS
  // ==========================================

  /**
   * Generates a signed access token.
   */
  generateAccessToken(payload: JwtPayload): string {
    return this.jwtService.sign(payload, {
      secret: this.config.access.secret,
      expiresIn: this.config.access.expiresIn,
      issuer: this.config.issuer,
      audience: this.config.audience,
    });
  }

  /**
   * Generates a signed refresh token.
   */
  generateRefreshToken(payload: JwtPayload): string {
    return this.jwtService.sign(payload, {
      secret: this.config.refresh.secret,
      expiresIn: this.config.refresh.expiresIn,
      issuer: this.config.issuer,
      audience: this.config.audience,
    });
  }

  /**
   * Generates a signed verification token.
   */
  generateVerificationToken(payload: JwtPayload): string {
    return this.jwtService.sign(payload, {
      secret: this.config.verification.secret,
      expiresIn: this.config.verification.expiresIn,
      issuer: this.config.issuer,
      audience: this.config.audience,
    });
  }

  // ==========================================
  // TOKEN VERIFICATION METHODS
  // ==========================================

  /**
   * Verifies an access token and returns its decoded payload.
   */
  async verifyAccessToken(token: string): Promise<JwtPayload> {
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.config.access.secret,
        issuer: this.config.issuer,
        audience: this.config.audience,
      });

      if (payload.type !== 'access') {
        throw new UnauthorizedException('Invalid token type');
      }

      return payload;
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }

  /**
   * Verifies a refresh token and returns its decoded payload.
   */
  async verifyRefreshToken(token: string): Promise<JwtPayload> {
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.config.refresh.secret,
        issuer: this.config.issuer,
        audience: this.config.audience,
      });

      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Invalid token type');
      }

      return payload;
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  /**
   * Verifies a verification token and returns its decoded payload.
   */
  async verifyVerificationToken(token: string): Promise<JwtPayload> {
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.config.verification.secret,
        issuer: this.config.issuer,
        audience: this.config.audience,
      });

      if (payload.type !== 'verification') {
        throw new UnauthorizedException('Invalid token type');
      }

      return payload;
    } catch {
      throw new UnauthorizedException('Invalid or expired verification token');
    }
  }
}
