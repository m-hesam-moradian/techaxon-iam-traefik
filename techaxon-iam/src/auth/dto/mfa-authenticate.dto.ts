// src/auth/dto/mfa-authenticate.dto.ts

import { IsString, IsNotEmpty, IsOptional, Length, Matches } from 'class-validator';

export class MfaAuthenticateDto {
  /**
   * Short-lived (5 min) JWT challenge token received from POST /auth/login.
   */
  @IsString()
  @IsNotEmpty()
  mfa_token!: string;

  /**
   * 6-digit TOTP code from authenticator app.
   * Provide either code OR backup_code.
   */
  @IsOptional()
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'MFA code must be exactly 6 digits' })
  code?: string;

  /**
   * Single-use backup recovery code (format: XXXX-XXXX).
   * Provide either code OR backup_code.
   */
  @IsOptional()
  @IsString()
  backup_code?: string;
}
