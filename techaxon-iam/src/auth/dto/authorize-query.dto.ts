// src/auth/dto/authorize-query.dto.ts

import { IsString, IsNotEmpty, IsIn, IsUrl } from 'class-validator';

/**
 * Query parameters for the OIDC Authorization Code flow.
 *
 * GET /auth/authorize?client_id=...&redirect_uri=...&state=...&response_type=code
 */
export class AuthorizeQueryDto {
  /**
   * The registered OIDC client identifier.
   */
  @IsString()
  @IsNotEmpty()
  client_id!: string;

  /**
   * The URI the IdP will redirect back to after authorization.
   *
   * Must be a valid URL and pre-registered for the client.
   */
  @IsUrl()
  redirect_uri!: string;

  /**
   * Opaque value the client uses to maintain state between
   * the request and the callback. Prevents CSRF attacks.
   */
  @IsString()
  @IsNotEmpty()
  state!: string;

  /**
   * Must be "code" for the Authorization Code flow.
   */
  @IsIn(['code'])
  response_type!: string;
}
