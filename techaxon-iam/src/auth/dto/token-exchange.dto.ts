// src/auth/dto/token-exchange.dto.ts

import { IsString, IsNotEmpty, IsIn, IsUrl } from 'class-validator';

/**
 * Body parameters for the OIDC Token Exchange endpoint.
 *
 * POST /auth/token
 *
 * The client application sends this after receiving an authorization code
 * from GET /auth/authorize?...&code=<value> to exchange it for real tokens.
 *
 * Reference: RFC 6749 Section 4.1.3
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
