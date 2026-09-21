import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../config/constants';
import { AUTH_COOKIE_NAME, verifyToken } from '../utils/token';
import { User } from '../models/User';

export interface AuthenticatedUser {
  id: string;
  role: UserRole;
  email: string;
  name: string;
  isVerified: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export const requireAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = req.cookies?.[AUTH_COOKIE_NAME];

    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Authentication required. No session token provided.',
      });
      return;
    }

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch {
      res.status(401).json({
        success: false,
        message: 'Invalid or expired authentication token.',
      });
      return;
    }

    const user = await User.findById(decoded.userId);
    if (!user || !user.isActive) {
      res.status(401).json({
        success: false,
        message: 'User account not found or has been deactivated.',
      });
      return;
    }

    req.user = {
      id: user._id.toString(),
      role: user.role,
      email: user.email,
      name: user.name,
      isVerified: user.isVerified || user.verificationStatus === 'verified',
    };

    next();
  } catch (error: any) {
    next(error);
  }
};

export const requireRole = (...roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: `Access denied. Requires one of [${roles.join(', ')}] role.`,
      });
      return;
    }

    next();
  };
};
