import Joi from 'joi';

export const userProfileUpdateSchema = Joi.object({
  username: Joi.string().alphanum().min(3).max(32).optional(),
  displayName: Joi.string().min(3).max(50).optional(),
  firstName: Joi.string().max(50).optional(),
  lastName: Joi.string().max(50).optional(),
  email: Joi.string().email().optional(),
  avatar_url: Joi.string().uri().optional(),
  bio: Joi.string().max(500).optional(),
  settings: Joi.object().optional(),
});
