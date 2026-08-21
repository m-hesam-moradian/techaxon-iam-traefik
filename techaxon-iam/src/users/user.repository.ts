// src/users/user.repository.ts

import type { UserDocument } from '../infrastructure/couchdb/documents/user.document';

export interface CreateUserResult {
  id: string;
  rev: string;
}

export type CreateUserData = Omit<UserDocument, '_id' | '_rev'>;

export abstract class UserRepository {
  abstract createUser(user: CreateUserData): Promise<CreateUserResult>;

  abstract findByEmail(email: string): Promise<UserDocument | null>;

  abstract findById(id: string): Promise<UserDocument | null>;

  abstract updateUser(id: string, user: Partial<UserDocument>): Promise<void>;

  abstract claimEmail(email: string, userId: string): Promise<void>;

  abstract releaseEmailClaim(email: string): Promise<void>;
}
