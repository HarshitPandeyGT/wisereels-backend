import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export interface CustomRequest extends Request {
  userId?: string;
  userRole?: string;
}

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const errorHandler = (
  error: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  logger.error('Error occurred', {
    message: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
  });

  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      success: false,
      error: error.message,
      details: error.details,
    });
  }

  // Default error
  res.status(500).json({
    success: false,
    error: 'Internal Server Error',
  });
};
