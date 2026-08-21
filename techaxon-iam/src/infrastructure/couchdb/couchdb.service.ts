import { Injectable, Inject } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import nano from 'nano';

import {
  UserRepository,
  type CreateUserData,
  type CreateUserResult,
} from '../../users/user.repository';

import type { UserDocument, IamDocument } from './documents';

import couchdbConfig from '../../config/couchdb.config';

@Injectable()
export class CouchDbService implements UserRepository {
  private couch!: nano.ServerScope;

  /**
   * Single CouchDB database for IAM documents
   */
  private db!: nano.DocumentScope<IamDocument>;

  constructor(
    @Inject(couchdbConfig.KEY)
    private readonly config: ConfigType<typeof couchdbConfig>,
  ) {}

  async initialize(): Promise<void> {
    if (this.db) {
      return;
    }

    this.couch = nano(this.config.url);

    if (this.config.autoCreateDatabase) {
      await this.ensureDatabaseExists();
    }

    this.db = this.couch.use(this.config.database);
  }

  /**
   * Creates the database if it does not already exist.
   */
  private async ensureDatabaseExists(): Promise<void> {
    try {
      await this.couch.db.create(this.config.database);
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'statusCode' in error &&
        error.statusCode === 412
      ) {
        return;
      }

      throw error;
    }
  }

  /**
   * Create user document.
   */
  async createUser(user: CreateUserData): Promise<CreateUserResult> {
    const response = await this.db.insert(user);

    return {
      id: response.id,
      rev: response.rev,
    };
  }

  /**
   * Find user by normalized email.
   */
  async findByEmail(email: string): Promise<UserDocument | null> {
    const normalizedEmail = email.trim().toLowerCase();

    const query = await this.db.find({
      selector: {
        type: 'user',
        email: normalizedEmail,
      },
    });

    if (query.docs.length === 0) {
      return null;
    }

    return query.docs[0] as UserDocument;
  }

  /**
   * Find user by ID.
   */
  async findById(id: string): Promise<UserDocument | null> {
    try {
      const doc = await this.db.get(id);
      if (doc && (doc as UserDocument).type === 'user') {
        return doc as UserDocument;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Update existing user document.
   */
  async updateUser(id: string, user: Partial<UserDocument>): Promise<void> {
    const existingDoc = await this.db.get(id);

    // ۱. بررسی اینکه آیا سند دریافت شده واقعاً سند کاربر است یا خیر
    if (!existingDoc || existingDoc.type !== 'user') {
      throw new Error(`User document with id ${id} not found.`);
    }

    // ۲. ساخت سند جدید با تایپ صریح UserDocument
    const updatedUserDocument: UserDocument = {
      ...existingDoc,
      ...user,
      _id: id,
      _rev: existingDoc._rev,
      type: 'user', // مشخص کردن صریح نوع سند
      updatedAt: new Date().toISOString(),
    };

    await this.db.insert(updatedUserDocument);
  }

  /**
   * Reserve email address atomically.
   */
  async claimEmail(email: string, userId: string): Promise<void> {
    const normalizedEmail = email.trim().toLowerCase();
    const now = new Date().toISOString();

    await this.db.insert({
      _id: `email:${normalizedEmail}`,
      type: 'email_claim',
      email: normalizedEmail,
      userId,
      createdAt: now,
      updatedAt: now,
    });
  }

  /**
   * Remove email reservation.
   */
  async releaseEmailClaim(email: string): Promise<void> {
    const normalizedEmail = email.trim().toLowerCase();
    const id = `email:${normalizedEmail}`;

    try {
      const document = await this.db.get(id);

      if (!document._rev) {
        return;
      }

      await this.db.destroy(id, document._rev);
    } catch {
      /**
       * Nothing to release if not found or already deleted.
       */
    }
  }

  /**
   * Exposes CouchDB connection.
   */
  getDatabase(): nano.DocumentScope<IamDocument> {
    if (!this.db) {
      if (!this.couch) {
        this.couch = nano(this.config.url);
      }
      this.db = this.couch.use(this.config.database);
    }
    return this.db;
  }
}
