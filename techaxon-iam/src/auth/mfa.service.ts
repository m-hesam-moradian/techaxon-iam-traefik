// src/auth/mfa.service.ts

import { Injectable, Inject, Optional } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';

import jwtConfig from '../config/jwt.config';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

@Injectable()
export class MfaService {
  private readonly encryptionKey: Buffer;

  constructor(
    @Optional()
    @Inject(jwtConfig.KEY)
    private readonly jwtConfiguration?: ConfigType<typeof jwtConfig>,
  ) {
    // Derive a 32-byte key for AES-256-GCM encryption
    const secretSource =
      process.env.MFA_ENCRYPTION_KEY ||
      this.jwtConfiguration?.access?.secret ||
      'techaxon-mfa-default-fallback-key-32b';

    this.encryptionKey = crypto.createHash('sha256').update(secretSource).digest();
  }

  // =========================================================================
  // Base32 Utilities (RFC 4648)
  // =========================================================================

  encodeBase32(buffer: Buffer): string {
    let bits = 0;
    let value = 0;
    let output = '';

    for (let i = 0; i < buffer.length; i++) {
      value = (value << 8) | buffer[i];
      bits += 8;

      while (bits >= 5) {
        output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
        bits -= 5;
      }
    }

    if (bits > 0) {
      output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
    }

    return output;
  }

  decodeBase32(base32Str: string): Buffer {
    const cleanStr = base32Str.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
    let bits = 0;
    let value = 0;
    const output: number[] = [];

    for (let i = 0; i < cleanStr.length; i++) {
      const idx = BASE32_ALPHABET.indexOf(cleanStr[i]);
      if (idx === -1) {
        continue;
      }

      value = (value << 5) | idx;
      bits += 5;

      if (bits >= 8) {
        output.push((value >>> (bits - 8)) & 255);
        bits -= 8;
      }
    }

    return Buffer.from(output);
  }

  // =========================================================================
  // TOTP Generation & Verification (RFC 6238 / RFC 4226)
  // =========================================================================

  /**
   * Generates a 20-byte (160-bit) cryptographically random Base32 secret key.
   */
  generateSecret(): string {
    const randomBytes = crypto.randomBytes(20);
    return this.encodeBase32(randomBytes);
  }

  /**
   * Generates a standard otpauth:// URI for scanning with authenticator apps.
   */
  generateKeyUri(email: string, secret: string, issuer = 'TechAxon'): string {
    const cleanEmail = encodeURIComponent(email.trim().toLowerCase());
    const cleanIssuer = encodeURIComponent(issuer);
    return `otpauth://totp/${cleanIssuer}:${cleanEmail}?secret=${secret}&issuer=${cleanIssuer}&algorithm=SHA1&digits=6&period=30`;
  }

  /**
   * Computes the 6-digit TOTP code for a given secret at a specific counter/time step.
   */
  computeTotpCode(secret: string, timeStep: number): string {
    const secretBuffer = this.decodeBase32(secret);

    // 8-byte big-endian counter
    const counterBuffer = Buffer.alloc(8);
    counterBuffer.writeBigUInt64BE(BigInt(timeStep), 0);

    const hmac = crypto.createHmac('sha1', secretBuffer);
    hmac.update(counterBuffer);
    const digest = hmac.digest();

    // Dynamic truncation (RFC 4226 Section 5.4)
    const offset = digest[digest.length - 1] & 0x0f;
    const binary =
      ((digest[offset] & 0x7f) << 24) |
      ((digest[offset + 1] & 0xff) << 16) |
      ((digest[offset + 2] & 0xff) << 8) |
      (digest[offset + 3] & 0xff);

    const otp = binary % 1_000_000;
    return otp.toString().padStart(6, '0');
  }

  /**
   * Verifies a 6-digit TOTP code with time drift window tolerance (default ±1 step = ±30s).
   */
  verifyTotp(code: string, secret: string, windowSteps = 1): boolean {
    if (!code || !secret) {
      return false;
    }

    const cleanCode = code.trim();
    if (!/^\d{6}$/.test(cleanCode)) {
      return false;
    }

    const currentStep = Math.floor(Date.now() / 1000 / 30);

    for (let step = currentStep - windowSteps; step <= currentStep + windowSteps; step++) {
      const expectedCode = this.computeTotpCode(secret, step);
      if (crypto.timingSafeEqual(Buffer.from(cleanCode), Buffer.from(expectedCode))) {
        return true;
      }
    }

    return false;
  }

  // =========================================================================
  // Secret Encryption / Decryption (AES-256-GCM)
  // =========================================================================

  /**
   * Encrypts the Base32 TOTP secret before persisting to database.
   * Format: iv:authTag:ciphertext (hex)
   */
  encryptSecret(secret: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);

    let encrypted = cipher.update(secret, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  /**
   * Decrypts an encrypted Base32 TOTP secret from database.
   */
  decryptSecret(encryptedData: string): string {
    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted secret format');
    }

    const [ivHex, authTagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv);

    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  // =========================================================================
  // Recovery Backup Codes
  // =========================================================================

  /**
   * Generates 8 random, human-readable backup recovery codes (e.g. "a1b2-c3d4").
   */
  generateBackupCodes(count = 8): string[] {
    const codes: string[] = [];
    const chars = '23456789abcdefghjkmnpqrstuvwxyz'; // readable charset (no 0/O, 1/I/l)

    for (let i = 0; i < count; i++) {
      let code = '';
      const bytes = crypto.randomBytes(8);
      for (let j = 0; j < 8; j++) {
        code += chars[bytes[j] % chars.length];
        if (j === 3) code += '-';
      }
      codes.push(code);
    }

    return codes;
  }

  /**
   * Hashes an array of backup codes with bcrypt.
   */
  async hashBackupCodes(codes: string[]): Promise<string[]> {
    return await Promise.all(codes.map((c) => bcrypt.hash(c.toLowerCase().trim(), 10)));
  }

  /**
   * Checks if a provided backup code matches one of the user's stored hashed backup codes.
   * Returns the index of the matching code (to remove it), or -1 if no match.
   */
  async verifyBackupCode(providedCode: string, hashedCodes: string[]): Promise<number> {
    const cleanCode = providedCode.toLowerCase().trim();

    for (let i = 0; i < hashedCodes.length; i++) {
      const match = await bcrypt.compare(cleanCode, hashedCodes[i]);
      if (match) {
        return i;
      }
    }

    return -1;
  }
}
