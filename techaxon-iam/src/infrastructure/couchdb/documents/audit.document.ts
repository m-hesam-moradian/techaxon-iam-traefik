import { BaseDocument } from './base.document';

export interface AuditDocument extends BaseDocument {
  type: 'audit';

  action: string;

  userId?: string;

  ip?: string;

  metadata?: Record<string, unknown>;
}
