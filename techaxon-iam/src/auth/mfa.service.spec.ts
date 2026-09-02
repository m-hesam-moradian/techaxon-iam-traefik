// src/auth/mfa.service.spec.ts

import { MfaService } from './mfa.service';

describe('MfaService', () => {
  let service: MfaService;

  beforeEach(() => {
    service = new MfaService({
      access: { secret: 'test-secret-key-12345', expiresIn: '15m', expiresInMs: 900000 },
      refresh: { secret: 'refresh-sec', expiresIn: '30d', expiresInMs: 2592000000 },
      verification: { secret: 'verify-sec', expiresIn: '1h' },
      issuer: 'techaxon-idp',
      audience: 'techaxon-api',
    } as any);
  });

  describe('Base32 encoding and decoding', () => {
    it('should correctly encode and decode a buffer round-trip', () => {
      const original = Buffer.from('TechAxon Security 2026');
      const encoded = service.encodeBase32(original);
      const decoded = service.decodeBase32(encoded);

      expect(typeof encoded).toBe('string');
      expect(decoded.toString()).toBe('TechAxon Security 2026');
    });
  });

  describe('generateSecret and generateKeyUri', () => {
    it('should generate a 32-character Base32 secret', () => {
      const secret = service.generateSecret();
      expect(secret).toHaveLength(32);
      expect(/^[A-Z2-7]+$/.test(secret)).toBe(true);
    });

    it('should generate a standard otpauth URI', () => {
      const secret = service.generateSecret();
      const uri = service.generateKeyUri('user@example.com', secret, 'TechAxon');

      expect(uri).toContain('otpauth://totp/TechAxon:user%40example.com');
      expect(uri).toContain(`secret=${secret}`);
      expect(uri).toContain('issuer=TechAxon');
      expect(uri).toContain('algorithm=SHA1');
      expect(uri).toContain('digits=6');
      expect(uri).toContain('period=30');
    });
  });

  describe('TOTP generation and verification', () => {
    it('should generate and verify a valid 6-digit TOTP code for current time', () => {
      const secret = service.generateSecret();
      const currentStep = Math.floor(Date.now() / 1000 / 30);
      const code = service.computeTotpCode(secret, currentStep);

      expect(code).toHaveLength(6);
      expect(/^\d{6}$/.test(code)).toBe(true);

      const isValid = service.verifyTotp(code, secret);
      expect(isValid).toBe(true);
    });

    it('should verify code within ±1 step drift tolerance window', () => {
      const secret = service.generateSecret();
      const previousStep = Math.floor(Date.now() / 1000 / 30) - 1;
      const code = service.computeTotpCode(secret, previousStep);

      const isValid = service.verifyTotp(code, secret, 1);
      expect(isValid).toBe(true);
    });

    it('should reject invalid or mismatched TOTP codes', () => {
      const secret = service.generateSecret();
      expect(service.verifyTotp('000000', secret)).toBe(false);
      expect(service.verifyTotp('invalid', secret)).toBe(false);
      expect(service.verifyTotp('', secret)).toBe(false);
    });
  });

  describe('AES-256-GCM secret encryption and decryption', () => {
    it('should encrypt and decrypt the TOTP secret accurately', () => {
      const secret = service.generateSecret();
      const encrypted = service.encryptSecret(secret);

      expect(encrypted).toContain(':');
      expect(encrypted.split(':')).toHaveLength(3);

      const decrypted = service.decryptSecret(encrypted);
      expect(decrypted).toBe(secret);
    });
  });

  describe('Backup recovery codes', () => {
    it('should generate 8 readable backup codes formatted with dash', () => {
      const codes = service.generateBackupCodes(8);
      expect(codes).toHaveLength(8);
      codes.forEach((c) => {
        expect(c).toMatch(/^[a-z2-9]{4}-[a-z2-9]{4}$/);
      });
    });

    it('should hash and verify backup codes using bcrypt', async () => {
      const codes = service.generateBackupCodes(4);
      const hashedCodes = await service.hashBackupCodes(codes);

      expect(hashedCodes).toHaveLength(4);

      // Matching code returns index
      const matchedIdx = await service.verifyBackupCode(codes[1], hashedCodes);
      expect(matchedIdx).toBe(1);

      // Wrong code returns -1
      const wrongIdx = await service.verifyBackupCode('wrong-code', hashedCodes);
      expect(wrongIdx).toBe(-1);
    });
  });
});
