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

    const refreshExpiresInMs = this.authService.getRefreshTokenExpiresInMs();
    const domain =
      this.cookieConfiguration?.domain ?? process.env.COOKIE_DOMAIN ?? '.techaxon.localhost';
    const secure = this.cookieConfiguration?.secure ?? process.env.NODE_ENV === 'production';
    const sameSite = this.cookieConfiguration?.sameSite ?? 'lax';
    const httpOnly = this.cookieConfiguration?.httpOnly ?? true;
    const path = this.cookieConfiguration?.path ?? '/';

    /**
     * Set the SSO refresh token cookie.
     *
     * httpOnly    : blocks client-side JS access (XSS protection).
     * secure      : HTTPS-only in production.
     * sameSite    : 'lax' — CSRF protection while allowing top-level navigations.
     * domain      : shared across subdomains for SSO (e.g. .techaxon.localhost).
     * path        : '/' — available for all routes on the domain.
     * maxAge      : dynamic duration matching JWT_REFRESH_EXPIRES_IN (e.g. 30d).
     */
    res.cookie('techaxon_refresh_token', result.refreshToken, {
      httpOnly,
      secure,
      sameSite,
      domain,
      path,
      maxAge: refreshExpiresInMs,
    });

    return result;
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

        const redirectUrl = `${query.redirect_uri}?code=${code}&state=${query.state}`;
        res.redirect(302, redirectUrl);
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
}
