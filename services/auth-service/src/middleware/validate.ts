import Joi from 'joi';
import { Request, Response, NextFunction } from 'express';
import { failure } from '@serveease/shared/utils';

export const validate = (schema: Joi.ObjectSchema) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const { error } = schema.validate(req.body, { abortEarly: false });
    if (error) {
      res.status(400).json(failure(
        'Validation failed',
        error.details.map(d => d.message).join(', '),
      ));
      return;
    }
    next();
  };

export const sendOtpSchema = Joi.object({
  phone: Joi.string().pattern(/^\+?[1-9]\d{9,14}$/).required().messages({
    'string.pattern.base': 'Phone number must be a valid international format e.g. +919876543210',
  }),
  role: Joi.string().valid('customer', 'worker').default('customer'),
});

export const verifyOtpSchema = Joi.object({
  phone:    Joi.string().required(),
  otp:      Joi.string().length(6).pattern(/^\d+$/).required(),
  deviceId: Joi.string().optional(),
  platform: Joi.string().valid('ios', 'android', 'web').optional(),
  fcmToken: Joi.string().optional(),
});
