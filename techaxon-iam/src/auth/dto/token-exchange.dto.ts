// src/auth/dto/token-exchange.dto.ts

import { IsString, IsNotEmpty, IsIn, IsUrl } from 'class-validator';

/**
 * Body parameters for the OAuth 2.0 Token Exchange endpoint.
 *
 * POST /auth/token
 *
 * The client application sends this after receiving an authorization code
 * from GET /auth/authorize?...&code=<value> to exchange it for real tokens.
 *
 * Reference: RFC 6749 Section 4.1.3
 *
 * PKCE (Phase 3):
 *   When PKCE support is added, extend this DTO with:
 *     @IsOptional() @IsString() code_verifier?: string;
 *   Then verify SHA-256(code_verifier) === stored code_challenge before issuing tokens.
 */
export class TokenExchangeDto {
  /**
   * Must be "authorization_code" for the Authorization Code Grant flow.
   */
  @IsIn(['authorization_code'])
  grant_type!: 'authorization_code';

  /**
   * The short-lived (60s), single-use authorization code received from /authorize.
   */
  @IsString()
  @IsNotEmpty()
  code!: string;

  /**
   * The client identifier. Must match the clientId stored with the code.
   */
  @IsString()
  @IsNotEmpty()
  client_id!: string;

  /**
   * The redirect URI used in the original /authorize request.
   * Must be in the client's registered allowed redirect URIs.
   */
  @IsUrl()
  redirect_uri!: string;
}
