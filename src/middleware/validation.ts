import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { validate as validateSchema } from '../utils/validators';
import { AppError } from '../middleware/errorHandler';
import Joi from 'joi';

export const validateRequest =
  (schema: Joi.Schema) =>
  (req: AuthRequest, res: Response, next: NextFunction) => {
    const { error, errors, value } = validateSchema(req.body, schema);

    if (error) {
      return next(
        new AppError(400, 'Validation failed', {
          errors,
        })
      );
    }

    req.body = value;
    next();
  };
