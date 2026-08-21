import { Test, TestingModule } from '@nestjs/testing';

import { CouchDbSessionRepository } from './couchdb-session.repository';
import { CouchDbService } from '../infrastructure/couchdb/couchdb.service';
import { createSession, createSessionData } from '../test/factories/session.factory';

describe('CouchDbSessionRepository', () => {
  let repository: CouchDbSessionRepository;

  /**
   * ------------------------------------------------------------------------
   * Mock CouchDB Database
   * ------------------------------------------------------------------------
   *
   * Fake implementation of the CouchDB API.
   */
  const mockDb = {
    insert: jest.fn(),
    get: jest.fn(),
    find: jest.fn(),
    destroy: jest.fn(),
  };

  /**
   * ------------------------------------------------------------------------
   * Mock CouchDbService
   * ------------------------------------------------------------------------
   */
  const mockCouchDbService = {
    getDatabase: jest.fn(() => mockDb),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CouchDbSessionRepository,
        {
          provide: CouchDbService,
          useValue: mockCouchDbService,
        },
      ],
    }).compile();

    repository = module.get<CouchDbSessionRepository>(CouchDbSessionRepository);
  });

  /**
   * ------------------------------------------------------------------------
   * Repository Initialization
   * ------------------------------------------------------------------------
   */
  describe('initialization', () => {
    it('should be defined', () => {
      expect(repository).toBeDefined();
    });
  });

  /**
   * ------------------------------------------------------------------------
   * createSession()
   * ------------------------------------------------------------------------
   *
   * Should create a new session document
   * and return CouchDB id/rev.
   */
  describe('createSession', () => {
    it('should create a session successfully', async () => {
      mockDb.insert.mockResolvedValue({
        id: 'session:123',
        rev: '1-abc',
      });

      const sessionData = createSessionData({
        refreshTokenHash: 'hashed-refresh-token',
      });

      const result = await repository.createSession('session:123', sessionData);

      expect(mockDb.insert).toHaveBeenCalledTimes(1);

      expect(mockDb.insert).toHaveBeenCalledWith({
        _id: 'session:123',
        ...sessionData,
      });

      expect(result).toEqual({
        id: 'session:123',
        rev: '1-abc',
      });
    });
  });

  /**
   * ------------------------------------------------------------------------
   * findById()
   * ------------------------------------------------------------------------
   *
   * Should find a session by its identifier.
   */
  describe('findById', () => {
    it('should return a session when it exists', async () => {
      const session = createSession({
        _id: 'session:123',

        _rev: '1-abc',

        refreshTokenHash: 'hashed-refresh-token',
      });

      mockDb.get.mockResolvedValue(session);

      const result = await repository.findById('session:123');

      expect(mockDb.get).toHaveBeenCalledTimes(1);

      expect(mockDb.get).toHaveBeenCalledWith('session:123');

      expect(result).toEqual(session);
    });

    it('should return null when session does not exist', async () => {
      mockDb.get.mockRejectedValue({
        statusCode: 404,
      });

      const result = await repository.findById('session:404');

      expect(mockDb.get).toHaveBeenCalledWith('session:404');

      expect(result).toBeNull();
    });
  });

  /**
   * ------------------------------------------------------------------------
   * findByUserId()
   * ------------------------------------------------------------------------
   *
   * Should return all sessions belonging to a user.
   */
  describe('findByUserId', () => {
    it('should return all sessions for a user', async () => {
      const sessions = [
        createSession({
          _id: 'session:1',
          _rev: '1-a',
          refreshTokenHash: 'hash-1',
        }),

        createSession({
          _id: 'session:2',
          _rev: '1-b',
          refreshTokenHash: 'hash-2',
          expiresAt: '2030-02-01T00:00:00.000Z',
          lastAccessedAt: '2026-02-01T00:00:00.000Z',
          createdAt: '2026-02-01T00:00:00.000Z',
          updatedAt: '2026-02-01T00:00:00.000Z',
        }),
      ];

      mockDb.find.mockResolvedValue({
        docs: sessions,
      });

      const result = await repository.findByUserId('user:1');

      expect(mockDb.find).toHaveBeenCalledTimes(1);

      expect(mockDb.find).toHaveBeenCalledWith({
        selector: {
          type: 'session',
          userId: 'user:1',
        },
      });

      expect(result).toEqual(sessions);
    });

    it('should return an empty array when no sessions exist', async () => {
      mockDb.find.mockResolvedValue({
        docs: [],
      });

      const result = await repository.findByUserId('user:999');

      expect(mockDb.find).toHaveBeenCalledWith({
        selector: {
          type: 'session',
          userId: 'user:999',
        },
      });

      expect(result).toEqual([]);
    });
  });
  /**
   * ------------------------------------------------------------------------
   * findByRefreshTokenHash()
   * ------------------------------------------------------------------------
   *
   * Should find a session by its refresh token hash.
   *
   * The refresh token hash is unique, therefore the query
   * is limited to a single document.
   */
  describe('findByRefreshTokenHash', () => {
    it('should return a session when refresh token hash exists', async () => {
      const session = createSession({
        _id: 'session:123',

        _rev: '1-abc',

        refreshTokenHash: 'hashed-refresh-token',
      });

      mockDb.find.mockResolvedValue({
        docs: [session],
      });

      const result = await repository.findByRefreshTokenHash('hashed-refresh-token');

      expect(mockDb.find).toHaveBeenCalledTimes(1);

      expect(mockDb.find).toHaveBeenCalledWith({
        selector: {
          type: 'session',
          refreshTokenHash: 'hashed-refresh-token',
        },
        limit: 1,
      });

      expect(result).toEqual(session);
    });

    it('should return null when refresh token hash does not exist', async () => {
      mockDb.find.mockResolvedValue({
        docs: [],
      });

      const result = await repository.findByRefreshTokenHash('unknown-hash');

      expect(mockDb.find).toHaveBeenCalledTimes(1);

      expect(mockDb.find).toHaveBeenCalledWith({
        selector: {
          type: 'session',
          refreshTokenHash: 'unknown-hash',
        },
        limit: 1,
      });

      expect(result).toBeNull();
    });
  });
  /**
   * ------------------------------------------------------------------------
   * updateSession()
   * ------------------------------------------------------------------------
   *
   * Should update an existing session document.
   */
  describe('updateSession', () => {
    it('should update a session successfully', async () => {
      mockDb.insert.mockResolvedValue({
        id: 'session:123',
        rev: '2-def',
      });

      const session = createSession({
        _id: 'session:123',
        _rev: '1-abc',

        refreshTokenHash: 'new-hash',

        lastAccessedAt: '2026-02-01T00:00:00.000Z',
        updatedAt: '2026-02-01T00:00:00.000Z',
      });

      const result = await repository.updateSession(session);

      expect(mockDb.insert).toHaveBeenCalledTimes(1);

      expect(mockDb.insert).toHaveBeenCalledWith(session);

      expect(result).toEqual({
        id: 'session:123',
        rev: '2-def',
      });
    });
  });
  /**
   * ------------------------------------------------------------------------
   * revokeSession()
   * ------------------------------------------------------------------------
   *
   * Should revoke an existing session.
   */
  describe('revokeSession', () => {
    it('should revoke an active session', async () => {
      const session = createSession({
        _id: 'session:123',

        _rev: '1-abc',

        refreshTokenHash: 'hashed-refresh-token',
      });

      mockDb.get.mockResolvedValue(session);

      mockDb.insert.mockResolvedValue({
        id: 'session:123',
        rev: '2-def',
      });

      await repository.revokeSession('session:123');

      expect(mockDb.get).toHaveBeenCalledWith('session:123');

      expect(mockDb.insert).toHaveBeenCalledTimes(1);

      expect(mockDb.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          _id: 'session:123',

          status: 'revoked',

          revokedAt: expect.any(String),

          updatedAt: expect.any(String),
        }),
      );
    });

    it('should do nothing when session does not exist', async () => {
      mockDb.get.mockRejectedValue({
        statusCode: 404,
      });

      await expect(repository.revokeSession('session:404')).resolves.toBeUndefined();

      expect(mockDb.insert).not.toHaveBeenCalled();
    });
  });
  /**
   * ------------------------------------------------------------------------
   * revokeAllUserSessions()
   * ------------------------------------------------------------------------
   *
   * Should revoke every session belonging to a user.
   */
  describe('revokeAllUserSessions', () => {
    it('should revoke all sessions for a user', async () => {
      const sessions = [
        createSession({
          _id: 'session:1',
          refreshTokenHash: 'hash-1',
        }),

        createSession({
          _id: 'session:2',
          refreshTokenHash: 'hash-2',
        }),
      ];

      mockDb.find.mockResolvedValue({
        docs: sessions,
      });

      mockDb.insert.mockResolvedValue({
        id: 'session',
        rev: '2-new',
      });

      await repository.revokeAllUserSessions('user:1');

      expect(mockDb.find).toHaveBeenCalledWith({
        selector: {
          type: 'session',
          userId: 'user:1',
        },
      });

      expect(mockDb.insert).toHaveBeenCalledTimes(2);

      expect(mockDb.insert).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          _id: 'session:1',

          status: 'revoked',

          revokedAt: expect.any(String),

          updatedAt: expect.any(String),
        }),
      );

      expect(mockDb.insert).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          _id: 'session:2',

          status: 'revoked',

          revokedAt: expect.any(String),

          updatedAt: expect.any(String),
        }),
      );
    });

    it('should do nothing when user has no sessions', async () => {
      mockDb.find.mockResolvedValue({
        docs: [],
      });

      await expect(repository.revokeAllUserSessions('user:404')).resolves.toBeUndefined();

      expect(mockDb.insert).not.toHaveBeenCalled();
    });
  });
  /**
   * ------------------------------------------------------------------------
   * deleteSession()
   * ------------------------------------------------------------------------
   *
   * Should permanently delete a session document.
   */
  describe('deleteSession', () => {
    it('should delete an existing session', async () => {
      const session = createSession({
        _id: 'session:123',

        _rev: '1-abc',
      });

      mockDb.get.mockResolvedValue(session);

      mockDb.destroy.mockResolvedValue({
        ok: true,
        id: 'session:123',
        rev: '2-deleted',
      });

      await repository.deleteSession('session:123');

      expect(mockDb.get).toHaveBeenCalledWith('session:123');

      expect(mockDb.destroy).toHaveBeenCalledTimes(1);

      expect(mockDb.destroy).toHaveBeenCalledWith('session:123', '1-abc');
    });

    it('should do nothing when session does not exist', async () => {
      mockDb.get.mockRejectedValue({
        statusCode: 404,
      });

      await expect(repository.deleteSession('session:404')).resolves.toBeUndefined();

      expect(mockDb.destroy).not.toHaveBeenCalled();
    });
  });
  /**
   * ------------------------------------------------------------------------
   * deleteExpiredSessions()
   * ------------------------------------------------------------------------
   *
   * Should permanently remove expired session documents.
   */
  describe('deleteExpiredSessions', () => {
    it('should delete all expired sessions', async () => {
      const expiredSessions = [
        createSession({
          _id: 'session:1',
          _rev: '1-a',

          refreshTokenHash: 'hash-1',

          expiresAt: '2025-01-01T00:00:00.000Z',

          lastAccessedAt: '2024-12-31T00:00:00.000Z',

          createdAt: '2024-01-01T00:00:00.000Z',

          updatedAt: '2024-12-31T00:00:00.000Z',
        }),

        createSession({
          _id: 'session:2',
          _rev: '1-b',

          userId: 'user:2',

          refreshTokenHash: 'hash-2',

          status: 'revoked',

          expiresAt: '2025-01-02T00:00:00.000Z',

          lastAccessedAt: '2024-12-31T00:00:00.000Z',

          createdAt: '2024-01-02T00:00:00.000Z',

          updatedAt: '2024-12-31T00:00:00.000Z',
        }),
      ];

      mockDb.find.mockResolvedValue({
        docs: expiredSessions,
      });

      mockDb.destroy.mockResolvedValue({
        ok: true,
      });

      const result = await repository.deleteExpiredSessions('2026-01-01T00:00:00.000Z');

      expect(mockDb.find).toHaveBeenCalledWith({
        selector: {
          type: 'session',
          expiresAt: {
            $lt: '2026-01-01T00:00:00.000Z',
          },
        },
      });

      expect(mockDb.destroy).toHaveBeenCalledTimes(2);

      expect(mockDb.destroy).toHaveBeenNthCalledWith(1, 'session:1', '1-a');

      expect(mockDb.destroy).toHaveBeenNthCalledWith(2, 'session:2', '1-b');

      expect(result).toBe(2);
    });

    it('should return zero when there are no expired sessions', async () => {
      mockDb.find.mockResolvedValue({
        docs: [],
      });

      const result = await repository.deleteExpiredSessions('2026-01-01T00:00:00.000Z');

      expect(mockDb.destroy).not.toHaveBeenCalled();

      expect(result).toBe(0);
    });

    it('should skip documents without _id or _rev', async () => {
      const invalidSessions = [
        {
          type: 'session',
          userId: 'user:1',

          refreshTokenHash: 'hash',

          status: 'active',

          expiresAt: '2025-01-01T00:00:00.000Z',

          lastAccessedAt: '2024-12-31T00:00:00.000Z',

          createdAt: '2024-01-01T00:00:00.000Z',

          updatedAt: '2024-12-31T00:00:00.000Z',
        },
      ];

      mockDb.find.mockResolvedValue({
        docs: invalidSessions,
      });

      const result = await repository.deleteExpiredSessions('2026-01-01T00:00:00.000Z');

      expect(mockDb.destroy).not.toHaveBeenCalled();

      expect(result).toBe(0);
    });
  });
});
