// src/auth/dto/mfa-disable.dto.ts

import { IsString, IsNotEmpty, Length, Matches } from 'class-validator';

export class MfaDisableDto {
  /**
   * Current account password for security re-authentication.
   */
  @IsString()
  @IsNotEmpty()
  password!: string;

  /**
   * The 6-digit verification code from the authenticator app.
   */
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'MFA code must be exactly 6 digits' })
  code!: string;
}
