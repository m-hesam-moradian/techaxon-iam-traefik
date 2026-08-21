// src/auth/auth.service.ts

import {
  Injectable,
  Inject,
  Optional,
  ConflictException,
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { randomUUID, randomBytes } from 'crypto';

import { UserRepository } from '../users/user.repository';
import { SessionService } from '../sessions/session.service';
import { TokenService } from './token.service';
import { AuthCodeRepository } from './auth-code.repository';
import jwtConfig from '../config/jwt.config';
import clientsConfig from '../config/clients.config';

import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import type { JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly sessionService: SessionService,
    private readonly tokenService: TokenService,
    private readonly authCodeRepo: AuthCodeRepository,
    @Optional()
    @Inject(jwtConfig.KEY)
    private readonly jwtConfiguration?: ConfigType<typeof jwtConfig>,
    @Optional()
    @Inject(clientsConfig.KEY)
    private readonly clientsConfiguration?: ConfigType<typeof clientsConfig>,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();

    // 1. Check existing user
    const existingUser = await this.userRepo.findByEmail(email);
    if (existingUser) {
      throw new ConflictException('A user with this email already exists');
    }

    const userId = `user:${randomUUID()}`;

    // 2. Reserve email
    try {
      await this.userRepo.claimEmail(email, userId);
    } catch {
      throw new ConflictException('A user with this email already exists');
    }

    // 3. Create User Document with Safe Cleanup Rollback
    try {
      const passwordHash = await bcrypt.hash(dto.password, 10);
      const now = new Date().toISOString();

      const newUser = {
        _id: userId,
        type: 'user' as const,
        username: dto.username,
        email,
        passwordHash,
        status: 'pending_verification' as const,
        emailVerified: false,
        tenantId: null,
        createdAt: now,
        updatedAt: now,
      };

      const response = await this.userRepo.createUser(newUser);

      const verificationPayload: JwtPayload = {
        sub: response.id,
        sid: '',
        type: 'verification',
      };

      const verificationToken = this.tokenService.generateVerificationToken(verificationPayload);

      return {
        success: true,
        id: response.id,
        verificationToken,
      };
    } catch (error) {
      // 🛡️ پاک‌سازی ایمن: حتی اگر releaseEmailClaim خطا بدهد، برنامه کرش نکرده و خطای اصلی ثبت‌نام Throw می‌شود
      await this.userRepo.releaseEmailClaim(email).catch(() => {
        // لوگ کردن خطای پاک‌سازی برای بررسی‌های بعدی سیستم
      });

      // اگر خطا از نوع Conflict نباشد، خطای صریح ۵۰۰ یا عمومی می‌دهیم
      if (error instanceof ConflictException) {
        throw error;
      }

      throw new InternalServerErrorException(
        'Registration failed due to a server error. Please try again.',
      );
    }
  }

  /**
   * Log in user, create a new session, and issue access & refresh tokens.
   */

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async login(dto: LoginDto, meta?: { userAgent?: string; ipAddress?: string }) {
    const email = dto.email.trim().toLowerCase();

    // 1. Find user by email
    const user = await this.userRepo.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // 2. Validate password
    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // 3. Ensure email is verified and user account is active
    if (user.status !== 'active' || !user.emailVerified) {
      throw new UnauthorizedException('Please verify your email address first.');
    }

    if (!user._id) {
      throw new InternalServerErrorException('User document is missing _id');
    }

    const userId: string = user._id;

    // 4. Set expiration for the refresh token & session (dynamically aligned with JWT_REFRESH_EXPIRES_IN)
    const refreshExpiresInMs = this.getRefreshTokenExpiresInMs();
    const expiresAt = new Date(Date.now() + refreshExpiresInMs).toISOString();

    // 5. Generate FIXED Session ID upfront (یکبار برای همیشه)
    const sessionId = `session:${randomUUID()}`;

    // 6. Generate Refresh Token using the EXACT sessionId
    const refreshToken = this.tokenService.generateRefreshToken({
      sub: userId,
      sid: sessionId,
      type: 'refresh',
    });

    // 7. Hash the exact Refresh Token that will be returned to the client
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);

    // 8. Create session in DB with the predetermined sessionId
    await this.sessionService.createSession(
      userId,
      refreshTokenHash,
      expiresAt,
      sessionId, // 👈 پاس دادن sessionId قطعی به SessionService
    );

    // 9. Generate Access Token
    const accessToken = this.tokenService.generateAccessToken({
      sub: userId,
      sid: sessionId,
      type: 'access',
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: userId,
        email: user.email,
        username: user.username,
      },
    };
  }

  /**
   * Verify user's email using the verification JWT token
   */
  async verifyEmail(token: string) {
    // ۱. اعتبارسنجی توکن JWT (افزودن await)
    let payload: JwtPayload;
    try {
      payload = await this.tokenService.verifyVerificationToken(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired verification token');
    }

    // ۲. بررسی نوع توکن
    if (payload.type !== 'verification' || !payload.sub) {
      throw new UnauthorizedException('Invalid verification token payload');
    }

    const userId = payload.sub;

    // ۳. یافتن کاربر در دیتابیس
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // ۴. اگر حساب قبلاً تایید شده باشد
    if (user.emailVerified && user.status === 'active') {
      return {
        success: true,
        message: 'Email is already verified',
      };
    }

    // ۵. آپدیت وضعیت کاربر به active و emailVerified: true
    const now = new Date().toISOString();
    await this.userRepo.updateUser(userId, {
      ...user,
      emailVerified: true,
      status: 'active',
      updatedAt: now,
    });

    return {
      success: true,
      message: 'Email successfully verified. You can now log in.',
    };
  }

  /**
   * Refresh expired access token using a valid refresh token.
   */
  async refreshToken(refreshTokenStr: string) {
    // ۱. اعتبارسنجی اولیه ساختار JWT
    let payload: JwtPayload;
    try {
      payload = await this.tokenService.verifyRefreshToken(refreshTokenStr);
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (payload.type !== 'refresh' || !payload.sub || !payload.sid) {
      throw new UnauthorizedException('Invalid refresh token payload');
    }

    const userId = payload.sub;
    const sessionId = payload.sid;

    // ۲. دریافت نشست (Session) از دیتابیس
    const session = await this.sessionService.findSessionById(sessionId);
    if (!session || session.status !== 'active') {
      throw new UnauthorizedException('Session is inactive or revoked');
    }

    // ۳. بررسی انقضای تاریخ نشست
    if (new Date(session.expiresAt) < new Date()) {
      throw new UnauthorizedException('Session has expired');
    }

    // ۴. تطبیق توکن با هش ذخیره‌شده در دیتابیس (بررسی عدم جعل)
    const isTokenValid = await bcrypt.compare(refreshTokenStr, session.refreshTokenHash);
    if (!isTokenValid) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // ۵. صدور Access Token جدید
    const newAccessToken = this.tokenService.generateAccessToken({
      sub: userId,
      sid: sessionId,
      type: 'access',
    });

    return {
      accessToken: newAccessToken,
    };
  }

  /**
   * Log out user by revoking the active session.
   */
  async logout(sessionId: string) {
    if (!sessionId) {
      return { success: true };
    }

    // ابطال یا حذف Session در دیتابیس
    await this.sessionService.revokeSession(sessionId);

    return {
      success: true,
      message: 'Successfully logged out',
    };
  }

  /**
   * ------------------------------------------------------------------------
   * Validate Client & Allowed Redirect URI
   * ------------------------------------------------------------------------
   *
   * Verifies that the client_id is registered and that the provided redirect_uri
   * is present in the registered client's allowed redirect URIs.
   */
  validateClientRedirectUri(clientId: string, redirectUri: string): Promise<boolean> {
    if (!clientId || !redirectUri) {
      return Promise.resolve(false);
    }

    const registeredClients = this.clientsConfiguration?.clients;
    if (!registeredClients) {
      return Promise.resolve(false);
    }

    const client = registeredClients[clientId];
    if (!client || !Array.isArray(client.allowedRedirectUris)) {
      return Promise.resolve(false);
    }

    return Promise.resolve(client.allowedRedirectUris.includes(redirectUri));
  }

  /**
   * Returns the refresh token TTL in milliseconds (defaults to 30 days if unset).
   */
  getRefreshTokenExpiresInMs(): number {
    return this.jwtConfiguration?.refresh?.expiresInMs ?? 30 * 24 * 60 * 60 * 1000;
  }

  /**
   * ------------------------------------------------------------------------
   * Generate OIDC Authorization Code
   * ------------------------------------------------------------------------
   *
   * Creates a cryptographically random, single-use authorization code
   * that expires in exactly 60 seconds. Persists it to CouchDB via
   * AuthCodeRepository (never touches nano directly).
   */
  async generateAuthorizationCode(userId: string, clientId: string): Promise<string> {
    const code = randomBytes(32).toString('hex');
    const id = `auth_code:${randomUUID()}`;
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 60_000).toISOString();

    await this.authCodeRepo.saveAuthCode(id, {
      type: 'auth_code',
      code,
      userId,
      clientId,
      expiresAt,
      used: false,
      createdAt: now,
      updatedAt: now,
    });

    return code;
  }

  /**
   * ------------------------------------------------------------------------
   * Validate Refresh Token Cookie
   * ------------------------------------------------------------------------
   *
   * Verifies the techaxon_refresh_token cookie value.
   * Checks:
   *  1. Valid JWT signature, issuer, audience, and type === 'refresh'.
   *  2. Active session exists for the sid in DB.
   *  3. User ID matches the session owner.
   *  4. Session timestamp has not expired.
   *
   * Returns the userId on success, or null on any failure — caller always
   * safely falls through to the login view.
   */
  async validateRefreshTokenCookie(cookie: string): Promise<string | null> {
    let payload: JwtPayload;

    try {
      payload = await this.tokenService.verifyRefreshToken(cookie);
    } catch {
      return null;
    }

    if (payload.type !== 'refresh' || !payload.sub || !payload.sid) {
      return null;
    }

    const session = await this.sessionService.findSessionById(payload.sid);

    if (!session || session.status !== 'active') {
      return null;
    }

    if (session.userId && session.userId !== payload.sub) {
      return null;
    }

    if (new Date(session.expiresAt) < new Date()) {
      return null;
    }

    return payload.sub;
  }
}
