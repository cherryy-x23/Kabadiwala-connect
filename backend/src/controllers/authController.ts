import { Request, Response, NextFunction } from 'express';
import { registerSchema, loginSchema } from '../validators/authValidators';
import * as authService from '../services/authService';
import { AUTH_COOKIE_NAME, getAuthCookieOptions } from '../utils/token';

export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const validatedData = registerSchema.parse(req.body);
    const { user, token } = await authService.registerUser(validatedData);

    // Set secure HttpOnly cookie
    res.cookie(AUTH_COOKIE_NAME, token, getAuthCookieOptions());

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        user,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const validatedData = loginSchema.parse(req.body);
    const { user, token } = await authService.loginUser(validatedData);

    // Set secure HttpOnly cookie
    res.cookie(AUTH_COOKIE_NAME, token, getAuthCookieOptions());

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

export const getMe = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    const user = await authService.getUserById(req.user.id);

    res.status(200).json({
      success: true,
      message: 'Current user retrieved successfully',
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          isVerified: user.isVerified,
        },
      },
    });
  } catch (error: any) {
    next(error);
  }
};

export const logout = (
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  res.clearCookie(AUTH_COOKIE_NAME, {
    ...getAuthCookieOptions(),
    maxAge: 0,
  });

  res.status(200).json({
    success: true,
    message: 'Logged out successfully',
  });
};

/**
 * Temporary RBAC verification endpoints for development testing
 */
export const testCollectorAccess = (
  _req: Request,
  res: Response
): void => {
  res.status(200).json({
    success: true,
    message: 'Collector access granted',
  });
};

export const testAdminAccess = (
  _req: Request,
  res: Response
): void => {
  res.status(200).json({
    success: true,
    message: 'Admin access granted',
  });
};
