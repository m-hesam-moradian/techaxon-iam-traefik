export * from './base.document';

export * from './user.document';

export * from './email-claim.document';

export * from './migration.document';

export * from './session.document';

export * from './verification-token.document';

export * from './audit.document';

export * from './auth-code.document';

import { UserDocument } from './user.document';
import { AuthCodeDocument } from './auth-code.document';
import { EmailClaimDocument } from './email-claim.document';
import { MigrationDocument } from './migration.document';
import { SessionDocument } from './session.document';
import { VerificationTokenDocument } from './verification-token.document';
import { AuditDocument } from './audit.document';

export type IamDocument =
  | UserDocument
  | EmailClaimDocument
  | MigrationDocument
  | SessionDocument
  | VerificationTokenDocument
  | AuditDocument
  | AuthCodeDocument;
