import Joi from 'joi';

export const credentialVerificationSchema = Joi.object({
  userId: Joi.string().uuid().required(),
  status: Joi.string().valid('VERIFIED', 'REJECTED').required(),
});
