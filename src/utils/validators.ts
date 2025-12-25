import Joi from 'joi';

export const registerSchema = Joi.object({
  phoneNumber: Joi.string().pattern(/^[+]?[0-9]{10,15}$/).required(),
  username: Joi.string().alphanum().min(3).max(32).required(),
  displayName: Joi.string().alphanum().min(3).max(50).required(),
});

export const loginSchema = Joi.object({
  phoneNumber: Joi.string().pattern(/^[+]?[0-9]{10,15}$/).required(),
});

export const videoUploadSchema = Joi.object({
  title: Joi.string().min(5).max(255).required(),
  description: Joi.string().max(1000).optional(),
  category: Joi.string()
    .valid('FINANCE', 'HEALTH', 'FITNESS', 'EDUCATION', 'ENTERTAINMENT', 'OTHER')
    .required(),
  durationSeconds: Joi.number().integer().min(10).required(),
});

export const credentialSubmissionSchema = Joi.object({
  credentialType: Joi.string().valid('CA', 'DOCTOR', 'TRAINER').required(),
  credentialId: Joi.string().min(5).max(100).required(),
  issuingBody: Joi.string().min(3).max(255).required(),
  expiryDate: Joi.date().iso().required(),
});

export const watchEventSchema = Joi.object({
  videoId: Joi.string().uuid().required(),
  creatorId: Joi.string().uuid().required(),
  watchDurationSeconds: Joi.number().integer().min(5).required(),
  category: Joi.string()
    .valid('FINANCE', 'HEALTH', 'FITNESS', 'EDUCATION', 'ENTERTAINMENT', 'OTHER')
    .required(),
});

export const redemptionSchema = Joi.object({
  pointsToRedeem: Joi.number().integer().min(100).required(),
  redemptionType: Joi.string().valid('UPI', 'GIFT_CARD', 'RECHARGE').required(),
  upiId: Joi.string().when('redemptionType', {
    is: 'UPI',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
});

export const validate = (data: any, schema: Joi.Schema) => {
  const { error, value } = schema.validate(data, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    const errors = error.details.map((detail) => ({
      field: detail.path.join('.'),
      message: detail.message,
    }));
    return { error: true, errors, value: null };
  }

  return { error: false, errors: null, value };
};
