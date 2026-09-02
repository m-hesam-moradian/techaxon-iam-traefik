import { BaseDocument } from './base.document';

export interface UserMfaConfig {
  enabled: boolean;
  /**
   * Encrypted Base32 TOTP secret (AES-256-GCM).
   */
  secret: string;
  /**
   * Array of bcrypt-hashed single-use backup recovery codes.
   */
  backupCodes: string[];
  /**
   * ISO-8601 enrolment timestamp.
   */
  enrolledAt: string;
  /**
   * ISO-8601 timestamp of when MFA was last used to authenticate.
   */
  lastUsedAt?: string;
}

export interface UserDocument extends BaseDocument {
  type: 'user';

  username?: string;

  email: string;

  passwordHash: string;

  status: 'active' | 'disabled' | 'pending_verification';

  tenantId: string | null;

  emailVerified: boolean;

  /**
   * Multi-Factor Authentication configuration (optional).
   */
  mfa?: UserMfaConfig;

  updatedAt: string;
}
