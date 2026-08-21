import { BaseDocument } from './base.document';

export interface UserDocument extends BaseDocument {
  type: 'user';

  username?: string;

  email: string;

  passwordHash: string;

  status: 'active' | 'disabled' | 'pending_verification';

  tenantId: string | null;

  emailVerified: boolean;

  updatedAt: string;
}
