import type {
  IamDocument,
  UserDocument,
  SessionDocument,
  VerificationTokenDocument,
  EmailClaimDocument,
  AuditDocument,
  MigrationDocument,
  AuthCodeDocument,
} from './index';

export function isUserDocument(document: IamDocument): document is UserDocument {
  return document.type === 'user';
}

export function isSessionDocument(document: IamDocument): document is SessionDocument {
  return document.type === 'session';
}

export function isVerificationTokenDocument(
  document: IamDocument,
): document is VerificationTokenDocument {
  return document.type === 'verification_token';
}

export function isEmailClaimDocument(document: IamDocument): document is EmailClaimDocument {
  return document.type === 'email_claim';
}

export function isMigrationDocument(document: IamDocument): document is MigrationDocument {
  return document.type === 'migration';
}

export function isAuditDocument(document: IamDocument): document is AuditDocument {
  return document.type === 'audit';
}

export function isAuthCodeDocument(document: IamDocument): document is AuthCodeDocument {
  return document.type === 'auth_code';
}

// ✅ Type Guard
// ❌ Cast (as SessionDocument)
