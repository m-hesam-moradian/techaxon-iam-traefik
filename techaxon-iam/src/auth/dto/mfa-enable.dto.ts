// src/auth/dto/mfa-enable.dto.ts

import { IsString, IsNotEmpty, Length, Matches } from 'class-validator';

export class MfaEnableDto {
  /**
   * The 6-digit verification code from the authenticator app.
   */
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'MFA code must be exactly 6 digits' })
  code!: string;

  /**
   * The Base32 secret key received from /auth/mfa/setup.
   */
  @IsString()
  @IsNotEmpty()
  secret!: string;
}
