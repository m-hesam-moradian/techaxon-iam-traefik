// src/config/app.config.ts

import { registerAs } from '@nestjs/config';

export interface CookieConfig {
  domain: string;
  secure: boolean;
  httpOnly: boolean;
  sameSite: 'lax' | 'strict' | 'none';
  path: string;
}

export default registerAs('cookie', (): CookieConfig => ({
  domain: process.env.COOKIE_DOMAIN ?? '.techaxon.localhost',
  secure: process.env.NODE_ENV === 'production' || process.env.COOKIE_SECURE === 'true',
  httpOnly: process.env.COOKIE_HTTP_ONLY !== 'false',
  sameSite: (process.env.COOKIE_SAME_SITE as 'lax' | 'strict' | 'none') || 'lax',
  path: '/',
}));
