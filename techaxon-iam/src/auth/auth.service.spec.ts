// src/auth/auth.service.spec.ts

jest.mock('uuid', () => ({
  v7: () => 'mocked-uuid-v7-string',
}));
import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

import { AuthService } from './auth.service';
import { UserRepository } from '../users/user.repository';
import { SessionService } from '../sessions/session.service';
import { TokenService } from './token.service';
import { AuthCodeRepository } from './auth-code.repository';
import jwtConfig from '../config/jwt.config';
import clientsConfig from '../config/clients.config';

describe('AuthService', () => {
  let authService: AuthService;
  let userRepo: UserRepository;
  let authCodeRepo: AuthCodeRepository;
  let sessionService: SessionService;
  let tokenService: TokenService;

  const mockUserRepository = {
    findByEmail: jest.fn(),
    claimEmail: jest.fn(),
    createUser: jest.fn(),
    releaseEmailClaim: jest.fn(),
    findById: jest.fn(),
    updateUser: jest.fn(),
  };

  const mockAuthCodeRepository = {
    saveAuthCode: jest.fn(),
    findByCode: jest.fn(),
    markUsed: jest.fn(),
  };

  const mockJwtConfig = {
    access: { secret: 'access-sec', expiresIn: '15m' },
    refresh: { secret: 'refresh-sec', expiresIn: '30d', expiresInMs: 30 * 24 * 60 * 60 * 1000 },
    verification: { secret: 'verify-sec', expiresIn: '1h' },
    issuer: 'techaxon-idp',
    audience: 'techaxon-api',
  };

  const mockClientsConfig = {
    clients: {
      'test-client': {
        clientId: 'test-client',
        clientName: 'Test Client Application',
        allowedRedirectUris: ['https://app.example.com/callback', 'http://localhost:3000/callback'],
      },
    },
  };

  beforeEach(async () => {
    const mockSessionService = {
      createSession: jest.fn(),
      findSessionById: jest.fn(),
      revokeSession: jest.fn(),
    };
    const mockTokenService = {
      generateAccessToken: jest.fn().mockReturnValue('mock-access-token'),
      generateRefreshToken: jest.fn().mockReturnValue('mock-refresh-token'),
      generateVerificationToken: jest.fn().mockReturnValue('mock-verification-token'),
      verifyAccessToken: jest.fn(),
      verifyRefreshToken: jest.fn(),
      verifyVerificationToken: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UserRepository,
          useValue: mockUserRepository,
        },
        {
          provide: SessionService,
          useValue: mockSessionService,
        },
        {
          provide: TokenService,
          useValue: mockTokenService,
        },
        {
          provide: AuthCodeRepository,
          useValue: mockAuthCodeRepository,
        },
        {
          provide: jwtConfig.KEY,
          useValue: mockJwtConfig,
        },
        {
          provide: clientsConfig.KEY,
          useValue: mockClientsConfig,
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    userRepo = module.get<UserRepository>(UserRepository);
    authCodeRepo = module.get<AuthCodeRepository>(AuthCodeRepository);
    sessionService = module.get<SessionService>(SessionService);
    tokenService = module.get<TokenService>(TokenService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // register()
  // ─────────────────────────────────────────────────────────────────────────

  describe('register', () => {
    it('should throw ConflictException (409) if email already exists', async () => {
      mockUserRepository.findByEmail.mockResolvedValue({
        _id: 'existing_user_id',
        email: 'test@example.com',
      });

      const dto = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
      };

      await expect(authService.register(dto)).rejects.toThrow(ConflictException);
      expect(userRepo.claimEmail).not.toHaveBeenCalled();
      expect(userRepo.createUser).not.toHaveBeenCalled();
    });

    it('should successfully create a new user and return verificationToken', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.claimEmail.mockResolvedValue(undefined);
      mockUserRepository.createUser.mockResolvedValue({
        id: 'new_uuid_123',
        rev: '1-abc',
      });

      const dto = {
        username: 'newuser',
        email: 'new@example.com',
        password: 'password123',
      };

      const result = await authService.register(dto);

      expect(result).toEqual({
        success: true,
        id: 'new_uuid_123',
        verificationToken: 'mock-verification-token',
      });

      expect(userRepo.claimEmail).toHaveBeenCalledWith('new@example.com', expect.any(String));
      expect(userRepo.createUser).toHaveBeenCalled();
    });

    it('should normalize email before checking and saving', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.claimEmail.mockResolvedValue(undefined);
      mockUserRepository.createUser.mockResolvedValue({
        id: 'new_uuid_456',
        rev: '1-def',
      });

      const dto = {
        email: '  Saeed@Example.COM  ',
        password: 'password123',
      };

      await authService.register(dto);

      expect(userRepo.findByEmail).toHaveBeenCalledWith('saeed@example.com');
      expect(userRepo.claimEmail).toHaveBeenCalledWith('saeed@example.com', expect.any(String));
      expect(userRepo.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'saeed@example.com',
        }),
      );
    });

    it('should throw ConflictException when email claim fails', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.claimEmail.mockRejectedValue(new Error('conflict'));

      const dto = {
        email: 'duplicate@example.com',
        password: 'password123',
      };

      await expect(authService.register(dto)).rejects.toThrow(ConflictException);
      expect(userRepo.createUser).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // login()
  // ─────────────────────────────────────────────────────────────────────────

  describe('login', () => {
    it('should create session with expiresAt aligned with JWT_REFRESH_EXPIRES_IN (30d)', async () => {
      const passwordHash = await bcrypt.hash('password123', 10);

      mockUserRepository.findByEmail.mockResolvedValue({
        _id: 'user:123',
        email: 'user@example.com',
        username: 'user123',
        passwordHash,
        status: 'active',
        emailVerified: true,
      });

      const before = Date.now();
      const result = await authService.login({
        email: 'user@example.com',
        password: 'password123',
      });
      const after = Date.now();

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');

      const createSessionCalls = (sessionService.createSession as jest.Mock).mock.calls as [
        string,
        string,
        string,
        string | undefined,
      ][];
      const expiresAtArg = createSessionCalls[0][2];
      const expiresAtMs = new Date(expiresAtArg).getTime();

      // Should be roughly 30 days in the future
      const expected30DaysMs = 30 * 24 * 60 * 60 * 1000;
      expect(expiresAtMs).toBeGreaterThanOrEqual(before + expected30DaysMs - 1000);
      expect(expiresAtMs).toBeLessThanOrEqual(after + expected30DaysMs + 1000);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // validateClientRedirectUri()
  // ─────────────────────────────────────────────────────────────────────────

  describe('validateClientRedirectUri', () => {
    it('should return true for registered client and allowed redirect_uri', async () => {
      const isValid = await authService.validateClientRedirectUri(
        'test-client',
        'https://app.example.com/callback',
      );
      expect(isValid).toBe(true);
    });

    it('should return false for unregistered client', async () => {
      const isValid = await authService.validateClientRedirectUri(
        'unknown-client',
        'https://app.example.com/callback',
      );
      expect(isValid).toBe(false);
    });

    it('should return false for registered client with unauthorized redirect_uri', async () => {
      const isValid = await authService.validateClientRedirectUri(
        'test-client',
        'https://malicious-site.com/callback',
      );
      expect(isValid).toBe(false);
    });

    it('should return false for empty client_id or redirect_uri', async () => {
      expect(await authService.validateClientRedirectUri('', 'https://app.example.com')).toBe(
        false,
      );
      expect(await authService.validateClientRedirectUri('test-client', '')).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // generateAuthorizationCode()
  // ─────────────────────────────────────────────────────────────────────────

  describe('generateAuthorizationCode', () => {
    it('should return a non-empty string code', async () => {
      mockAuthCodeRepository.saveAuthCode.mockResolvedValue({
        id: 'auth_code:test-id',
        rev: '1-abc',
      });

      const code = await authService.generateAuthorizationCode('user:123', 'client-app');

      expect(typeof code).toBe('string');
      expect(code.length).toBeGreaterThan(0);
    });

    it('should save auth_code document with correct type, userId, clientId and used=false', async () => {
      mockAuthCodeRepository.saveAuthCode.mockResolvedValue({
        id: 'auth_code:test-id',
        rev: '1-abc',
      });

      const userId = 'user:abc-123';
      const clientId = 'my-client';

      await authService.generateAuthorizationCode(userId, clientId);

      expect(authCodeRepo.saveAuthCode).toHaveBeenCalledWith(
        expect.stringMatching(/^auth_code:/),
        expect.objectContaining({
          type: 'auth_code',
          userId,
          clientId,
          used: false,
        }),
      );
    });

    it('should set expiresAt to approximately 60 seconds in the future', async () => {
      mockAuthCodeRepository.saveAuthCode.mockResolvedValue({
        id: 'auth_code:test-id',
        rev: '1-abc',
      });

      const before = Date.now();
      await authService.generateAuthorizationCode('user:123', 'client-app');
      const after = Date.now();

      const saveAuthCodeCalls = mockAuthCodeRepository.saveAuthCode.mock.calls as [
        string,
        { expiresAt: string },
      ][];
      const expiresAt = new Date(saveAuthCodeCalls[0][1].expiresAt).getTime();

      expect(expiresAt).toBeGreaterThanOrEqual(before + 59_000);
      expect(expiresAt).toBeLessThanOrEqual(after + 61_000);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // validateRefreshTokenCookie()
  // ─────────────────────────────────────────────────────────────────────────

  describe('validateRefreshTokenCookie', () => {
    const VALID_COOKIE = 'valid-refresh-token';

    it('should return userId when cookie is valid and session is active', async () => {
      (tokenService.verifyRefreshToken as jest.Mock).mockResolvedValue({
        sub: 'user:abc',
        sid: 'session:xyz',
        type: 'refresh',
      });

      (sessionService.findSessionById as jest.Mock).mockResolvedValue({
        _id: 'session:xyz',
        userId: 'user:abc',
        status: 'active',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      });

      const result = await authService.validateRefreshTokenCookie(VALID_COOKIE);

      expect(result).toBe('user:abc');
    });

    it('should return null when token verification fails', async () => {
      (tokenService.verifyRefreshToken as jest.Mock).mockRejectedValue(
        new UnauthorizedException('Invalid token'),
      );

      const result = await authService.validateRefreshTokenCookie('bad-token');

      expect(result).toBeNull();
    });

    it('should return null when session is not found', async () => {
      (tokenService.verifyRefreshToken as jest.Mock).mockResolvedValue({
        sub: 'user:abc',
        sid: 'session:xyz',
        type: 'refresh',
      });

      (sessionService.findSessionById as jest.Mock).mockResolvedValue(null);

      const result = await authService.validateRefreshTokenCookie(VALID_COOKIE);

      expect(result).toBeNull();
    });

    it('should return null when session status is revoked', async () => {
      (tokenService.verifyRefreshToken as jest.Mock).mockResolvedValue({
        sub: 'user:abc',
        sid: 'session:xyz',
        type: 'refresh',
      });

      (sessionService.findSessionById as jest.Mock).mockResolvedValue({
        _id: 'session:xyz',
        userId: 'user:abc',
        status: 'revoked',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      });

      const result = await authService.validateRefreshTokenCookie(VALID_COOKIE);

      expect(result).toBeNull();
    });

    it('should return null when session is past its expiresAt', async () => {
      (tokenService.verifyRefreshToken as jest.Mock).mockResolvedValue({
        sub: 'user:abc',
        sid: 'session:xyz',
        type: 'refresh',
      });

      (sessionService.findSessionById as jest.Mock).mockResolvedValue({
        _id: 'session:xyz',
        userId: 'user:abc',
        status: 'active',
        expiresAt: new Date(Date.now() - 1_000).toISOString(), // already expired
      });

      const result = await authService.validateRefreshTokenCookie(VALID_COOKIE);

      expect(result).toBeNull();
    });

    it('should return null when session userId does not match token subject', async () => {
      (tokenService.verifyRefreshToken as jest.Mock).mockResolvedValue({
        sub: 'user:abc',
        sid: 'session:xyz',
        type: 'refresh',
      });

      (sessionService.findSessionById as jest.Mock).mockResolvedValue({
        _id: 'session:xyz',
        userId: 'user:different-owner',
        status: 'active',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      });

      const result = await authService.validateRefreshTokenCookie(VALID_COOKIE);

      expect(result).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // exchangeAuthCode()
  // ─────────────────────────────────────────────────────────────────────────

  describe('exchangeAuthCode', () => {
    const validDto = {
      grant_type: 'authorization_code' as const,
      code: 'valid-hex-auth-code',
      client_id: 'test-client',
      redirect_uri: 'https://app.example.com/callback',
    };

    const validAuthCodeDoc = {
      _id: 'auth_code:abc-123',
      _rev: '1-rev',
      type: 'auth_code' as const,
      code: 'valid-hex-auth-code',
      userId: 'user:abc',
      clientId: 'test-client',
      expiresAt: new Date(Date.now() + 30_000).toISOString(), // 30s in future
      used: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    it('should return OIDC-compliant tokens on valid code exchange', async () => {
      mockAuthCodeRepository.findByCode.mockResolvedValue(validAuthCodeDoc);
      mockAuthCodeRepository.markUsed.mockResolvedValue(undefined);
      (sessionService.createSession as jest.Mock).mockResolvedValue(undefined);

      const result = await authService.exchangeAuthCode(validDto);

      expect(result).toEqual({
        access_token: 'mock-access-token',
        token_type: 'Bearer',
        expires_in: expect.any(Number),
        refresh_token: 'mock-refresh-token',
      });
      expect(authCodeRepo.markUsed).toHaveBeenCalledWith('auth_code:abc-123', '1-rev');
      expect(sessionService.createSession).toHaveBeenCalledTimes(1);
    });

    it('should throw UnauthorizedException when code is not found', async () => {
      mockAuthCodeRepository.findByCode.mockResolvedValue(null);

      await expect(authService.exchangeAuthCode(validDto)).rejects.toThrow(
        'Invalid or already used authorization code',
      );
      expect(authCodeRepo.markUsed).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when code has expired', async () => {
      mockAuthCodeRepository.findByCode.mockResolvedValue({
        ...validAuthCodeDoc,
        expiresAt: new Date(Date.now() - 1_000).toISOString(), // already expired
      });

      await expect(authService.exchangeAuthCode(validDto)).rejects.toThrow(
        'Authorization code has expired',
      );
      expect(authCodeRepo.markUsed).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when client_id does not match the code', async () => {
      mockAuthCodeRepository.findByCode.mockResolvedValue({
        ...validAuthCodeDoc,
        clientId: 'different-client', // mismatch
      });

      await expect(authService.exchangeAuthCode(validDto)).rejects.toThrow(
        'client_id does not match the authorization code',
      );
      expect(authCodeRepo.markUsed).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when redirect_uri is not registered for client', async () => {
      const dtoWithBadRedirect = {
        ...validDto,
        redirect_uri: 'https://attacker.com/steal',
      };

      await expect(authService.exchangeAuthCode(dtoWithBadRedirect)).rejects.toThrow(
        'Invalid client_id or unauthorized redirect_uri',
      );
      expect(authCodeRepo.findByCode).not.toHaveBeenCalled();
      expect(authCodeRepo.markUsed).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when client_id is not registered', async () => {
      const dtoWithBadClient = {
        ...validDto,
        client_id: 'unregistered-client',
      };

      await expect(authService.exchangeAuthCode(dtoWithBadClient)).rejects.toThrow(
        'Invalid client_id or unauthorized redirect_uri',
      );
      expect(authCodeRepo.findByCode).not.toHaveBeenCalled();
    });

    it('should call markUsed before creating session to prevent replay attacks', async () => {
      const callOrder: string[] = [];

      mockAuthCodeRepository.findByCode.mockResolvedValue(validAuthCodeDoc);
      mockAuthCodeRepository.markUsed.mockImplementation(async () => {
        callOrder.push('markUsed');
      });
      (sessionService.createSession as jest.Mock).mockImplementation(async () => {
        callOrder.push('createSession');
      });

      await authService.exchangeAuthCode(validDto);

      expect(callOrder).toEqual(['markUsed', 'createSession']);
    });
  });
});
