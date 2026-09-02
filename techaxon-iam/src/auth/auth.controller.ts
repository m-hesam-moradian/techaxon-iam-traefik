// src/auth/auth.controller.ts

import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  Req,
  Res,
  UseGuards,
  Inject,
  Optional,
  BadRequestException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { ConfigType } from '@nestjs/config';

import appConfig from '../config/app.config';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { LogoutDto } from './dto/logout.dto';
import { AuthorizeQueryDto } from './dto/authorize-query.dto';
import { TokenExchangeDto } from './dto/token-exchange.dto';
import { MfaEnableDto } from './dto/mfa-enable.dto';
import { MfaDisableDto } from './dto/mfa-disable.dto';
import { MfaAuthenticateDto } from './dto/mfa-authenticate.dto';
import { JwtAuthGuard, AuthenticatedUser } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    @Optional()
    @Inject(appConfig.KEY)
    private readonly cookieConfiguration?: ConfigType<typeof appConfig>,
  ) {}

  /**
   * ------------------------------------------------------------------------
   * Register User
   * POST /auth/register
   * ------------------------------------------------------------------------
   */
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto) {
    return await this.authService.register(dto);
  }

  /**
   * ------------------------------------------------------------------------
   * Verify Email Address
   * GET /auth/verify-email?token=...
   * ------------------------------------------------------------------------
   */
  @Get('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Query('token') token: string) {
    return await this.authService.verifyEmail(token);
  }

  /**
   * ------------------------------------------------------------------------
   * Log In User
   * POST /auth/login
   *
   * On success, sets the techaxon_refresh_token HttpOnly cookie so that
   * subsequent GET /auth/authorize requests can detect an active IdP session
   * and skip the login form (SSO flow).
   * ------------------------------------------------------------------------
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const userAgent = req.headers['user-agent'];
    const ipAddress = req.ip ?? req.socket.remoteAddress;

    const result = await this.authService.login(dto, { userAgent, ipAddress });

    // If MFA is required, return challenge token without setting session cookie
    if (result.mfaRequired || !result.refreshToken) {
      return result;
    }

    this.setRefreshTokenCookie(res, result.refreshToken);
    return result;
  }

  /**
   * Helper to set the SSO refresh token HttpOnly cookie.
   */
  private setRefreshTokenCookie(res: Response, refreshToken: string): void {
    const refreshExpiresInMs = this.authService.getRefreshTokenExpiresInMs();
    const domain =
      this.cookieConfiguration?.domain ?? process.env.COOKIE_DOMAIN ?? '.techaxon.localhost';
    const secure = this.cookieConfiguration?.secure ?? process.env.NODE_ENV === 'production';
    const sameSite = this.cookieConfiguration?.sameSite ?? 'lax';
    const httpOnly = this.cookieConfiguration?.httpOnly ?? true;
    const path = this.cookieConfiguration?.path ?? '/';

    res.cookie('techaxon_refresh_token', refreshToken, {
      httpOnly,
      secure,
      sameSite,
      domain,
      path,
      maxAge: refreshExpiresInMs,
    });
  }

  /**
   * ------------------------------------------------------------------------
   * OIDC Authorization Endpoint
   * GET /auth/authorize?client_id=...&redirect_uri=...&state=...&response_type=code
   *
   * SSO routing logic:
   *  - Validate client_id and redirect_uri against registered allowed redirect URIs.
   *  - Cookie present & valid → generate auth code → HTTP 302 redirect.
   *  - Cookie missing or invalid → HTTP 200 render('login') with form context.
   * ------------------------------------------------------------------------
   */
  @Get('authorize')
  async authorize(
    @Query() query: AuthorizeQueryDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    // 1. Validate client_id and redirect_uri
    const isClientValid = await this.authService.validateClientRedirectUri(
      query.client_id,
      query.redirect_uri,
    );

    if (!isClientValid) {
      throw new BadRequestException('Invalid client_id or unauthorized redirect_uri');
    }

    // 2. Check SSO session via refresh token cookie
    const cookie: string | undefined = req.cookies['techaxon_refresh_token'] as string | undefined;

    if (cookie) {
      const userId = await this.authService.validateRefreshTokenCookie(cookie);

      if (userId) {
        const code = await this.authService.generateAuthorizationCode(userId, query.client_id);

        const redirectUrl = new URL(query.redirect_uri);
        redirectUrl.searchParams.set('code', code);
        if (query.state) {
          redirectUrl.searchParams.set('state', query.state);
        }
        res.redirect(302, redirectUrl.toString());
        return;
      }
    }

    // 3. No valid IdP session — serve the login Handlebars view.
    res.render('login', {
      clientId: query.client_id,
      client_id: query.client_id,
      redirectUri: query.redirect_uri,
      redirect_uri: query.redirect_uri,
      state: query.state,
    });
  }

  /**
   * ------------------------------------------------------------------------
   * Get Current Authenticated User Profile
   * GET /auth/me
   * ------------------------------------------------------------------------
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  getProfile(@Req() req: Request & { user: AuthenticatedUser }) {
    return req.user;
  }

  /**
   * ------------------------------------------------------------------------
   * Refresh Access Token
   * POST /auth/refresh
   * ------------------------------------------------------------------------
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshTokenDto) {
    return await this.authService.refreshToken(dto.refreshToken);
  }

  /**
   * ------------------------------------------------------------------------
   * Logout User
   * POST /auth/logout
   * ------------------------------------------------------------------------
   */
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@Body() dto: LogoutDto) {
    return await this.authService.logout(dto.sessionId);
  }

  /**
   * ------------------------------------------------------------------------
   * OIDC Token Exchange
   * POST /auth/token
   *
   * Exchanges a short-lived (60s) single-use authorization code (received
   * from GET /auth/authorize via ?code=) for a real accessToken + refreshToken.
   *
   * This is Step 8 of the OIDC Authorization Code Grant flow (RFC 6749 §4.1.3).
   * No authentication guard — the code itself is the credential.
   * ------------------------------------------------------------------------
   */
  @Post('token')
  @HttpCode(HttpStatus.OK)
  async token(@Body() dto: TokenExchangeDto) {
    return await this.authService.exchangeAuthCode(dto);
  }

  // =========================================================================
  // Multi-Factor Authentication (MFA / 2FA) Endpoints
  // =========================================================================

  /**
   * ------------------------------------------------------------------------
   * MFA Setup (Step 1 of Enrolment)
   * POST /auth/mfa/setup
   *
   * Authenticated endpoint. Generates a new TOTP Base32 secret and key URI.
   * ------------------------------------------------------------------------
   */
  @Post('mfa/setup')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async mfaSetup(@Req() req: Request & { user: AuthenticatedUser }) {
    return await this.authService.mfaSetup(req.user.id);
  }

  /**
   * ------------------------------------------------------------------------
   * MFA Enable (Step 2 of Enrolment)
   * POST /auth/mfa/enable
   *
   * Authenticated endpoint. Verifies initial 6-digit TOTP code, encrypts
   * the secret, activates MFA, and returns 8 single-use backup recovery codes.
   * ------------------------------------------------------------------------
   */
  @Post('mfa/enable')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async mfaEnable(
    @Req() req: Request & { user: AuthenticatedUser },
    @Body() dto: MfaEnableDto,
  ) {
    return await this.authService.mfaEnable(req.user.id, dto);
  }

  /**
   * ------------------------------------------------------------------------
   * MFA Disable
   * POST /auth/mfa/disable
   *
   * Authenticated endpoint. Deactivates MFA after verifying current password
   * and a valid 6-digit TOTP code.
   * ------------------------------------------------------------------------
   */
  @Post('mfa/disable')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async mfaDisable(
    @Req() req: Request & { user: AuthenticatedUser },
    @Body() dto: MfaDisableDto,
  ) {
    return await this.authService.mfaDisable(req.user.id, dto);
  }

  /**
   * ------------------------------------------------------------------------
   * MFA Authenticate (Step 2 of Login Challenge)
   * POST /auth/mfa/authenticate
   *
   * Public challenge endpoint. Exchanges mfa_token + 6-digit TOTP code
   * (or single-use backup code) for access/refresh tokens and sets SSO cookie.
   * ------------------------------------------------------------------------
   */
  @Post('mfa/authenticate')
  @HttpCode(HttpStatus.OK)
  async mfaAuthenticate(
    @Body() dto: MfaAuthenticateDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const userAgent = req.headers['user-agent'];
    const ipAddress = req.ip ?? req.socket.remoteAddress;

    const result = await this.authService.mfaAuthenticate(dto, { userAgent, ipAddress });
    this.setRefreshTokenCookie(res, result.refreshToken);

    return result;
  }
}
