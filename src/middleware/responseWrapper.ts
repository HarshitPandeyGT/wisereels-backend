import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to standardize all API responses.
 * Ensures every successful response is wrapped in a consistent structure.
 */
export const responseWrapper = (req: Request, res: Response, next: NextFunction) => {
  // Store original send
  const oldJson = res.json;
  res.json = function (data: any) {
    // If already wrapped, don't double wrap
    if (data && typeof data === 'object' && 'success' in data) {
      return oldJson.call(this, data);
    }
    return oldJson.call(this, { success: true, data });
  };
  next();
};
