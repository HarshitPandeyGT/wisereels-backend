import { Response, NextFunction } from 'express';
import { Request as ExpressRequest } from 'express';
import { jwtService, JWTPayload } from '../config/jwt';
import { AppError } from './errorHandler';

export interface AuthRequest extends ExpressRequest {
  user?: JWTPayload;
  body: any;
  params: any;
  query: any;
  headers: any;
}

export const authMiddleware = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError(401, 'Missing or invalid authorization header');
    }

    const token = authHeader.substring(7);
    const user = jwtService.verifyToken(token);
    
    req.user = user;
    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
    } else {
      next(new AppError(401, 'Invalid or expired token'));
    }
  }
};

export const roleMiddleware = (...allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      next(new AppError(403, 'Insufficient permissions'));
    } else {
      next();
    }
  };
};
