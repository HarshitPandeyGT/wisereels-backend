import Joi from 'joi';

export const videoPublishSchema = Joi.object({
  videoId: Joi.string().uuid().required(),
});

export const videoLikeSchema = Joi.object({
  // No body, but could add userId if needed
});

export const videoCommentSchema = Joi.object({
  comment: Joi.string().min(1).max(500).required(),
});
