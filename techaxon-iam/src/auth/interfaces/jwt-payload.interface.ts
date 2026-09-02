/**
 * JWT payload shared by both access and refresh tokens.
 *
 * sub  -> User identifier
 * sid  -> Session identifier
 * type -> Prevents token confusion attacks
 */
export interface JwtPayload {
  /**
   * User identifier.
   *
   * Example:
   * user:01989...
   */
  sub: string;

  /**
   * Session identifier.
   *
   * Example:
   * session:01989...
   */
  sid: string;

  /**
   * Token type.
   */
  type: 'access' | 'refresh' | 'verification' | 'mfa_challenge';
}

// sub  → پیدا کردن کاربر
// sid  → پیدا کردن Session
// type → جلوگیری از استفاده Refresh به جای Access
