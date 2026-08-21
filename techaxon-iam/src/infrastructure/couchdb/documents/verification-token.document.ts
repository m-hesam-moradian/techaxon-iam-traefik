import { BaseDocument } from './base.document';

export interface VerificationTokenDocument extends BaseDocument {
  type: 'verification_token';

  userId: string;

  tokenHash: string;

  expiresAt: string;

  usedAt?: string;
}
