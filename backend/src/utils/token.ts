import jwt from 'jsonwebtoken';
import { CookieOptions } from 'express';
import { env } from '../config/env';
import { UserRole } from '../config/constants';

export interface TokenPayload {
  userId: string;
  role: UserRole;
}

export const AUTH_COOKIE_NAME = 'token';

export const generateToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as any,
  });
};

export const verifyToken = (token: string): TokenPayload => {
  return jwt.verify(token, env.JWT_SECRET) as TokenPayload;
};

export const getAuthCookieOptions = (): CookieOptions => {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
    path: '/',
  };
};
