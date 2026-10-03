// src/auth/auth.controller.spec.ts

jest.mock('uuid', () => ({
  v7: () => 'mocked-uuid-v7-string',
}));

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  const publicIamHost = process.env.TEST_PUBLIC_IAM_HOST ?? 'localhost:3000';
  const publicFrontendUrl =
    process.env.TEST_PUBLIC_FRONTEND_URL ?? 'http://localhost:3001';
  const publicRedirectUri = `${publicFrontendUrl}/callback`;

  let controller: AuthController;
  let authService: AuthService;

  const mockAuthService = {
    register: jest.fn(),
    login: jest.fn(),
    getProfile: jest.fn(),
    verifyEmail: jest.fn(),
    refreshToken: jest.fn(),
    logout: jest.fn(),
    mfaAuthenticate: jest.fn(),
    validateClientRedirectUri: jest.fn().mockResolvedValue(true),
    getClientRedirectUri: jest.fn(),
    validateRefreshTokenCookie: jest.fn(),
    generateAuthorizationCode: jest.fn(),
    exchangeAuthCode: jest.fn(),
    getRefreshTokenExpiresInMs: jest.fn().mockReturnValue(30 * 24 * 60 * 60 * 1000),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /auth/client-config', () => {
    it('returns the server-configured callback URI', () => {
      mockAuthService.getClientRedirectUri.mockReturnValue(publicRedirectUri);

      expect(controller.getClientConfig('techaxon-web')).toEqual({
        clientId: 'techaxon-web',
        redirectUri: publicRedirectUri,
      });
      expect(authService.getClientRedirectUri).toHaveBeenCalledWith('techaxon-web');
    });
  });

  describe('POST /auth/token', () => {
    it('sets the web refresh cookie without returning the refresh token in JSON', async () => {
      const result = {
        access_token: 'access-token',
        token_type: 'Bearer' as const,
        expires_in: 900,
        refresh_token: 'refresh-token',
      };
      const dto = {
        grant_type: 'authorization_code' as const,
        code: 'auth-code',
        client_id: 'techaxon-web',
        redirect_uri: publicRedirectUri,
      };
      const mockRes = {
        cookie: jest.fn(),
        json: jest.fn(),
      } as unknown as Response;
      mockAuthService.exchangeAuthCode.mockResolvedValue(result);

      await controller.token(dto, mockRes);

      expect(mockRes.cookie).toHaveBeenCalledWith(
        'techaxon_refresh_token',
        'refresh-token',
        expect.any(Object),
      );
      expect(mockRes.json).toHaveBeenCalledWith({
        access_token: 'access-token',
        token_type: 'Bearer',
        expires_in: 900,
      });
    });

    it('keeps token-body responses for non-web clients', async () => {
      const result = {
        access_token: 'access-token',
        token_type: 'Bearer' as const,
        expires_in: 900,
        refresh_token: 'refresh-token',
      };
      const mockRes = {
        cookie: jest.fn(),
        json: jest.fn(),
      } as unknown as Response;
      mockAuthService.exchangeAuthCode.mockResolvedValue(result);

      await controller.token(
        {
          grant_type: 'authorization_code',
          code: 'auth-code',
          client_id: 'techaxon-app',
          redirect_uri: 'http://localhost:3000/callback',
        },
        mockRes,
      );

      expect(mockRes.cookie).not.toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith(result);
    });
  });

  describe('POST /auth/refresh', () => {
    it('rotates an HttpOnly cookie token without returning it in JSON', async () => {
      const mockReq = {
        cookies: { techaxon_refresh_token: 'old-refresh-token' },
      } as unknown as Request;
      const mockRes = {
        cookie: jest.fn(),
        json: jest.fn(),
      } as unknown as Response;
      mockAuthService.refreshToken.mockResolvedValue({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });

      await controller.refresh({}, mockReq, mockRes);

      expect(authService.refreshToken).toHaveBeenCalledWith('old-refresh-token');
      expect(mockRes.cookie).toHaveBeenCalledWith(
        'techaxon_refresh_token',
        'new-refresh-token',
        expect.any(Object),
      );
      expect(mockRes.json).toHaveBeenCalledWith({
        accessToken: 'new-access-token',
      });
    });

    it('keeps token-body responses for mobile/API clients', async () => {
      const result = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      };
      const mockRes = {
        cookie: jest.fn(),
        json: jest.fn(),
      } as unknown as Response;
      mockAuthService.refreshToken.mockResolvedValue(result);

      await controller.refresh(
        { refreshToken: 'old-refresh-token' },
        { cookies: {} } as unknown as Request,
        mockRes,
      );

      expect(authService.refreshToken).toHaveBeenCalledWith('old-refresh-token');
      expect(mockRes.cookie).not.toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith(result);
    });
  });

  describe('POST /auth/logout', () => {
    it('revokes the authenticated session and clears the refresh cookie', async () => {
      const mockReq = {
        user: { userId: 'user:123', sessionId: 'session:123' },
      } as unknown as Request & { user: { userId: string; sessionId: string } };
      const mockRes = {
        clearCookie: jest.fn(),
        json: jest.fn(),
      } as unknown as Response;
      mockAuthService.logout.mockResolvedValue({ success: true });

      await controller.logout(mockReq, mockRes);

      expect(authService.logout).toHaveBeenCalledWith('session:123');
      expect(mockRes.clearCookie).toHaveBeenCalledWith(
        'techaxon_refresh_token',
        expect.any(Object),
      );
      expect(mockRes.json).toHaveBeenCalledWith({ success: true });
    });
  });

  describe('GET /auth/me', () => {
    it('should return the authenticated user profile including MFA status', async () => {
      const profile = {
        id: 'user:123',
        username: 'tester',
        email: 'test@example.com',
        mfaEnabled: true,
      };
      const req = {
        user: { userId: 'user:123', sessionId: 'session:123' },
      } as unknown as Request & { user: { userId: string; sessionId: string } };
      mockAuthService.getProfile.mockResolvedValue(profile);

      await expect(controller.getProfile(req)).resolves.toEqual(profile);
      expect(mockAuthService.getProfile).toHaveBeenCalledWith('user:123');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GET /auth/authorize
  // ─────────────────────────────────────────────────────────────────────────

  describe('GET /auth/authorize', () => {
    const queryDto = {
      client_id: 'test-client',
      redirect_uri: 'https://app.example.com/callback',
      state: 'random-state-string',
      response_type: 'code' as const,
    };

    /**
     * Test:
     * Invalid client_id or unauthorized redirect_uri → throws BadRequestException (400)
     */
    it('should throw BadRequestException when client_id or redirect_uri is invalid', async () => {
      mockAuthService.validateClientRedirectUri.mockResolvedValue(false);

      const mockReq = {
        cookies: {},
      } as unknown as Request;

      const mockRes = {
        redirect: jest.fn(),
        render: jest.fn(),
      } as unknown as Response;

      await expect(controller.authorize(queryDto, mockReq, mockRes)).rejects.toThrow(
        BadRequestException,
      );

      expect(authService.validateClientRedirectUri).toHaveBeenCalledWith(
        queryDto.client_id,
        queryDto.redirect_uri,
      );
      expect(mockRes.redirect).not.toHaveBeenCalled();
      expect(mockRes.render).not.toHaveBeenCalled();
    });

    /**
     * Test:
     * Valid client, no cookie present → render login view with form context.
     */
    it('should render login view when client is valid but no cookie is present', async () => {
      mockAuthService.validateClientRedirectUri.mockResolvedValue(true);

      const mockReq = {
        cookies: {},
      } as unknown as Request;

      const mockRes = {
        redirect: jest.fn(),
        render: jest.fn(),
      } as unknown as Response;

      await controller.authorize(queryDto, mockReq, mockRes);

      expect(authService.validateClientRedirectUri).toHaveBeenCalledWith(
        queryDto.client_id,
        queryDto.redirect_uri,
      );
      expect(authService.validateRefreshTokenCookie).not.toHaveBeenCalled();
      expect(authService.generateAuthorizationCode).not.toHaveBeenCalled();
      expect(mockRes.render).toHaveBeenCalledWith(
        'login',
        expect.objectContaining({
          clientId: queryDto.client_id,
          client_id: queryDto.client_id,
          redirectUri: queryDto.redirect_uri,
          redirect_uri: queryDto.redirect_uri,
          state: queryDto.state,
        }),
      );
      expect(mockRes.redirect).not.toHaveBeenCalled();
    });

    /**
     * Test:
     * Valid client, cookie present but invalid → render login view.
     */
    it('should render login view when cookie is present but invalid', async () => {
      mockAuthService.validateClientRedirectUri.mockResolvedValue(true);
      mockAuthService.validateRefreshTokenCookie.mockResolvedValue(null);

      const mockReq = {
        cookies: { techaxon_refresh_token: 'bad-token' },
      } as unknown as Request;

      const mockRes = {
        redirect: jest.fn(),
        render: jest.fn(),
      } as unknown as Response;

      await controller.authorize(queryDto, mockReq, mockRes);

      expect(authService.validateRefreshTokenCookie).toHaveBeenCalledWith('bad-token');
      expect(authService.generateAuthorizationCode).not.toHaveBeenCalled();
      expect(mockRes.render).toHaveBeenCalledWith(
        'login',
        expect.objectContaining({
          clientId: queryDto.client_id,
          redirectUri: queryDto.redirect_uri,
          state: queryDto.state,
        }),
      );
      expect(mockRes.redirect).not.toHaveBeenCalled();
    });

    /**
     * Test:
     * Valid client, cookie present and valid → generate auth code → 302 redirect.
     */
    it('should redirect with auth code when cookie is valid and client is registered', async () => {
      mockAuthService.validateClientRedirectUri.mockResolvedValue(true);
      mockAuthService.validateRefreshTokenCookie.mockResolvedValue('user:abc-123');
      mockAuthService.generateAuthorizationCode.mockResolvedValue('generated-auth-code-hex');

      const mockReq = {
        cookies: { techaxon_refresh_token: 'valid-refresh-token' },
      } as unknown as Request;

      const mockRes = {
        redirect: jest.fn(),
        render: jest.fn(),
      } as unknown as Response;

      await controller.authorize(queryDto, mockReq, mockRes);

      expect(authService.validateClientRedirectUri).toHaveBeenCalledWith(
        queryDto.client_id,
        queryDto.redirect_uri,
      );
      expect(authService.validateRefreshTokenCookie).toHaveBeenCalledWith('valid-refresh-token');
      expect(authService.generateAuthorizationCode).toHaveBeenCalledWith(
        'user:abc-123',
        queryDto.client_id,
        queryDto.redirect_uri,
      );
      expect(mockRes.redirect).toHaveBeenCalledWith(
        302,
        'https://app.example.com/callback?code=generated-auth-code-hex&state=random-state-string',
      );
      expect(mockRes.render).not.toHaveBeenCalled();
    });

    /**
     * Test:
     * Redirect URI already contains query parameters (e.g. ?tenant=abc) → merges code and state correctly.
     */
    it('should correctly merge code and state when redirect_uri already contains query parameters', async () => {
      const queryWithParams = {
        client_id: 'techaxon-lms',
        redirect_uri: 'https://lms.techaxon.de/auth/callback?tenant=abc',
        state: 'xyz-state',
        response_type: 'code' as const,
      };

      mockAuthService.validateClientRedirectUri.mockResolvedValue(true);
      mockAuthService.validateRefreshTokenCookie.mockResolvedValue('user:lms-user');
      mockAuthService.generateAuthorizationCode.mockResolvedValue('auth-code-123');

      const mockReq = {
        cookies: { techaxon_refresh_token: 'valid-token' },
      } as unknown as Request;

      const mockRes = {
        redirect: jest.fn(),
        render: jest.fn(),
      } as unknown as Response;

      await controller.authorize(queryWithParams, mockReq, mockRes);

      expect(mockRes.redirect).toHaveBeenCalledWith(
        302,
        'https://lms.techaxon.de/auth/callback?tenant=abc&code=auth-code-123&state=xyz-state',
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // POST /auth/login — cookie-setting
  // ─────────────────────────────────────────────────────────────────────────

  describe('POST /auth/login — SSO cookie', () => {
    it('should allow a login request from an exact configured origin', async () => {
      const previousOrigins = process.env.CORS_ALLOWED_ORIGINS;
      process.env.CORS_ALLOWED_ORIGINS = publicFrontendUrl;

      try {
        const mockReq = {
          headers: { origin: publicFrontendUrl },
          ip: '127.0.0.1',
          socket: { remoteAddress: '127.0.0.1' },
        } as unknown as Request;
        const mockRes = { json: jest.fn() } as unknown as Response;
        mockAuthService.login.mockResolvedValue({ accessToken: 'access-jwt' });

        await controller.login(
          { email: 'test@example.com', password: 'pass123' },
          mockReq,
          mockRes,
        );

        expect(authService.login).toHaveBeenCalled();
      } finally {
        if (previousOrigins === undefined) {
          delete process.env.CORS_ALLOWED_ORIGINS;
        } else {
          process.env.CORS_ALLOWED_ORIGINS = previousOrigins;
        }
      }
    });

    it('should reject an untrusted login origin before authenticating', async () => {
      const previousOrigins = process.env.CORS_ALLOWED_ORIGINS;
      const previousIamUrl = process.env.IAM_PUBLIC_URL;
      process.env.CORS_ALLOWED_ORIGINS = publicFrontendUrl;
      process.env.IAM_PUBLIC_URL = `https://${publicIamHost}`;

      try {
        const mockReq = {
          headers: { origin: 'https://attacker.example' },
          ip: '127.0.0.1',
          socket: { remoteAddress: '127.0.0.1' },
        } as unknown as Request;
        const mockRes = { json: jest.fn() } as unknown as Response;

        await expect(
          controller.login({ email: 'test@example.com', password: 'pass123' }, mockReq, mockRes),
        ).rejects.toThrow(ForbiddenException);
        expect(authService.login).not.toHaveBeenCalled();
      } finally {
        if (previousOrigins === undefined) {
          delete process.env.CORS_ALLOWED_ORIGINS;
        } else {
          process.env.CORS_ALLOWED_ORIGINS = previousOrigins;
        }
        if (previousIamUrl === undefined) {
          delete process.env.IAM_PUBLIC_URL;
        } else {
          process.env.IAM_PUBLIC_URL = previousIamUrl;
        }
      }
    });

    /**
     * Test:
     * On a successful login the techaxon_refresh_token cookie is set
     * with the dynamic maxAge and security options.
     */
    it('should set techaxon_refresh_token cookie with correct options and aligned maxAge on login', async () => {
      const mockReq = {
        headers: { 'user-agent': 'jest-test-agent' },
        ip: '127.0.0.1',
        socket: { remoteAddress: '127.0.0.1' },
      } as unknown as Request;

      const cookieMock = jest.fn();
      const mockRes = {
        cookie: cookieMock,
        json: jest.fn(),
      } as unknown as Response;

      mockAuthService.login.mockResolvedValue({
        accessToken: 'access-jwt',
        refreshToken: 'raw-refresh-token',
        user: { id: 'user:123', email: 'test@example.com', username: 'tester' },
      });

      await controller.login({ email: 'test@example.com', password: 'pass123' }, mockReq, mockRes);

      expect(cookieMock).toHaveBeenCalledWith(
        'techaxon_refresh_token',
        'raw-refresh-token',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          maxAge: 30 * 24 * 60 * 60 * 1000,
        }),
      );
    });

    it('should preserve the forwarded public origin when redirecting back to authorize', async () => {
      const mockReq = {
        headers: { 'user-agent': 'jest-test-agent' },
        ip: '127.0.0.1',
        socket: { remoteAddress: '127.0.0.1' },
        protocol: 'http',
        get: jest.fn((header: string) => {
          if (header === 'x-forwarded-proto') return 'https';
          if (header === 'x-forwarded-host') {
            return publicIamHost;
          }
          return 'localhost:3000';
        }),
      } as unknown as Request;

      const mockRes = {
        cookie: jest.fn(),
        redirect: jest.fn(),
      } as unknown as Response;

      mockAuthService.login.mockResolvedValue({
        accessToken: 'access-jwt',
        refreshToken: 'raw-refresh-token',
        user: { id: 'user:123', email: 'test@example.com', username: 'tester' },
      });

      await controller.login(
        {
          email: 'test@example.com',
          password: 'pass123',
          clientId: 'techaxon-web',
          redirectUri: publicRedirectUri,
          state: 'forwarded-state',
        },
        mockReq,
        mockRes,
      );

      expect(mockRes.redirect).toHaveBeenCalledWith(
        302,
        `${process.env.TEST_PUBLIC_IAM_URL ?? `https://${publicIamHost}`}/auth/authorize?client_id=techaxon-web&redirect_uri=${encodeURIComponent(publicRedirectUri)}&state=forwarded-state&response_type=code`,
      );
    });
  });

  describe('MFA login challenge', () => {
    it('should render the MFA challenge for an OAuth 2.0 login', async () => {
      const mockReq = {
        headers: { 'user-agent': 'jest-test-agent' },
        ip: '127.0.0.1',
        socket: { remoteAddress: '127.0.0.1' },
      } as unknown as Request;
      const mockRes = {
        cookie: jest.fn(),
        render: jest.fn(),
      } as unknown as Response;

      mockAuthService.login.mockResolvedValue({
        mfaRequired: true,
        mfaToken: 'mfa-challenge-token',
      });

      await controller.login(
        {
          email: 'test@example.com',
          password: 'pass123',
          clientId: 'techaxon-web',
          redirectUri: publicRedirectUri,
          state: 'mfa-state',
        },
        mockReq,
        mockRes,
      );

      expect(mockRes.render).toHaveBeenCalledWith('mfa-challenge', {
        mfaToken: 'mfa-challenge-token',
        clientId: 'techaxon-web',
        redirectUri: publicRedirectUri,
        state: 'mfa-state',
      });
      expect(mockRes.cookie).not.toHaveBeenCalled();
    });

    it('should redirect to authorize after valid MFA for an OAuth 2.0 login', async () => {
      const mockReq = {
        headers: { 'user-agent': 'jest-test-agent' },
        ip: '127.0.0.1',
        socket: { remoteAddress: '127.0.0.1' },
        protocol: 'http',
        get: jest.fn((header: string) => {
          if (header === 'x-forwarded-proto') return 'https';
          if (header === 'x-forwarded-host') return publicIamHost;
          return 'localhost:3000';
        }),
      } as unknown as Request;
      const mockRes = {
        cookie: jest.fn(),
        redirect: jest.fn(),
      } as unknown as Response;
      const dto = {
        mfa_token: 'mfa-challenge-token',
        code: '123456',
        clientId: 'techaxon-web',
        redirectUri: publicRedirectUri,
        state: 'mfa-state',
      };

      mockAuthService.mfaAuthenticate.mockResolvedValue({
        accessToken: 'access-jwt',
        refreshToken: 'raw-refresh-token',
      });

      const originalIamPublicUrl = process.env.IAM_PUBLIC_URL;
      process.env.IAM_PUBLIC_URL = 'https://public-iam.app.github.dev';
      try {
        await controller.mfaAuthenticate(dto, mockReq, mockRes);
      } finally {
        if (originalIamPublicUrl === undefined) {
          delete process.env.IAM_PUBLIC_URL;
        } else {
          process.env.IAM_PUBLIC_URL = originalIamPublicUrl;
        }
      }

      expect(mockAuthService.validateClientRedirectUri).toHaveBeenCalledWith(
        dto.clientId,
        dto.redirectUri,
      );
      expect(mockAuthService.mfaAuthenticate).toHaveBeenCalledWith(
        dto,
        expect.objectContaining({ userAgent: 'jest-test-agent' }),
      );
      expect(mockRes.cookie).toHaveBeenCalledWith(
        'techaxon_refresh_token',
        'raw-refresh-token',
        expect.any(Object),
      );
      expect(mockRes.redirect).toHaveBeenCalledWith(
        302,
        `https://public-iam.app.github.dev/auth/authorize?client_id=techaxon-web&redirect_uri=${encodeURIComponent(publicRedirectUri)}&state=mfa-state&response_type=code`,
      );
    });

    it('should return only the access token for web MFA API calls', async () => {
      const mockReq = {
        headers: { 'x-auth-client': 'techaxon-web' },
        ip: '127.0.0.1',
        socket: { remoteAddress: '127.0.0.1' },
      } as unknown as Request;
      const mockRes = {
        cookie: jest.fn(),
        json: jest.fn(),
      } as unknown as Response;
      mockAuthService.mfaAuthenticate.mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });

      await controller.mfaAuthenticate(
        { mfa_token: 'challenge-token', code: '123456' },
        mockReq,
        mockRes,
      );

      expect(mockRes.cookie).toHaveBeenCalledWith(
        'techaxon_refresh_token',
        'refresh-token',
        expect.any(Object),
      );
      expect(mockRes.json).toHaveBeenCalledWith({
        accessToken: 'access-token',
      });
    });

    it('should re-render the MFA challenge with an invalid-code error for browser login', async () => {
      const mockReq = {
        headers: { 'user-agent': 'jest-test-agent' },
        ip: '127.0.0.1',
        socket: { remoteAddress: '127.0.0.1' },
      } as unknown as Request;
      const mockRes = {
        cookie: jest.fn(),
        redirect: jest.fn(),
        render: jest.fn(),
        status: jest.fn().mockReturnThis(),
      } as unknown as Response;
      const dto = {
        mfa_token: 'mfa-challenge-token',
        code: '000000',
        clientId: 'techaxon-web',
        redirectUri: publicRedirectUri,
        state: 'mfa-state',
      };

      mockAuthService.mfaAuthenticate.mockRejectedValue(
        new UnauthorizedException('Invalid MFA verification code'),
      );

      await controller.mfaAuthenticate(dto, mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.render).toHaveBeenCalledWith('mfa-challenge', {
        mfaToken: dto.mfa_token,
        clientId: dto.clientId,
        redirectUri: dto.redirectUri,
        state: dto.state,
        error: 'Invalid MFA verification code',
      });
      expect(mockRes.cookie).not.toHaveBeenCalled();
      expect(mockRes.redirect).not.toHaveBeenCalled();
    });

    it('should show an error for an unregistered redirect before completing MFA', async () => {
      mockAuthService.validateClientRedirectUri.mockResolvedValue(false);
      const mockReq = {
        headers: {},
        ip: '127.0.0.1',
        socket: { remoteAddress: '127.0.0.1' },
      } as unknown as Request;
      const mockRes = {
        cookie: jest.fn(),
        redirect: jest.fn(),
        render: jest.fn(),
        status: jest.fn().mockReturnThis(),
      } as unknown as Response;

      await controller.mfaAuthenticate(
        {
          mfa_token: 'mfa-challenge-token',
          code: '123456',
          clientId: 'techaxon-web',
          redirectUri: 'https://attacker.example/callback',
        },
        mockReq,
        mockRes,
      );

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.render).toHaveBeenCalledWith(
        'mfa-challenge',
        expect.objectContaining({
          error: 'Invalid client_id or unauthorized redirect_uri',
        }),
      );
      expect(mockAuthService.mfaAuthenticate).not.toHaveBeenCalled();
      expect(mockRes.cookie).not.toHaveBeenCalled();
      expect(mockRes.redirect).not.toHaveBeenCalled();
    });
  });
});
