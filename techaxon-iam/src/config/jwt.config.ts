// src/config/jwt.config.ts

import { registerAs } from '@nestjs/config';

export type Duration = `${number}${'s' | 'm' | 'h' | 'd' | 'w' | 'y'}` | number;

export function parseDurationToMs(
  duration?: string | number,
  fallbackMs: number = 30 * 24 * 60 * 60 * 1000,
): number {
  if (typeof duration === 'number') {
    return duration;
  }
  if (!duration || typeof duration !== 'string') {
    return fallbackMs;
  }

  const match = duration.trim().match(/^(\d+)\s*(s|m|h|d|w|y)?$/i);
  if (!match) {
    return fallbackMs;
  }

  const value = parseInt(match[1], 10);
  const unit = (match[2] || 's').toLowerCase();

  switch (unit) {
    case 's':
      return value * 1000;
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    case 'w':
      return value * 7 * 24 * 60 * 60 * 1000;
    case 'y':
      return value * 365 * 24 * 60 * 60 * 1000;
    default:
      return fallbackMs;
  }
}

export default registerAs('jwt', () => {
  const refreshExpiresIn = (process.env.JWT_REFRESH_EXPIRES_IN || '30d') as Duration;
  const refreshExpiresInMs = parseDurationToMs(refreshExpiresIn, 30 * 24 * 60 * 60 * 1000);

  return {
    access: {
      secret: process.env.JWT_ACCESS_SECRET!,
      expiresIn: (process.env.JWT_ACCESS_EXPIRES_IN || '15m') as Duration,
    },

    refresh: {
      secret: process.env.JWT_REFRESH_SECRET!,
      expiresIn: refreshExpiresIn,
      expiresInMs: refreshExpiresInMs,
    },

    verification: {
      secret: process.env.JWT_VERIFICATION_SECRET!,
      expiresIn: (process.env.JWT_VERIFICATION_EXPIRES_IN || '1h') as Duration,
    },

    issuer: process.env.JWT_ISSUER!,
    audience: process.env.JWT_AUDIENCE!,
  };
});
