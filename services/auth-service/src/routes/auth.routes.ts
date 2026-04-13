import { Router } from 'express';
import rateLimit  from 'express-rate-limit';
import { sendOtp, verifyOtp, refreshToken, logout, validateToken } from '../controllers/auth.controller';
import { validate, sendOtpSchema, verifyOtpSchema } from '../middleware/validate';

const router = Router();

const otpLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max:      3,
  message:  { success: false, message: 'Too many requests. Try after 1 minute.' },
});

router.post('/send-otp',   otpLimiter, validate(sendOtpSchema),   sendOtp);
router.post('/verify-otp', otpLimiter, validate(verifyOtpSchema), verifyOtp);
router.post('/refresh',    refreshToken);
router.post('/logout',     logout);
router.get('/validate',    validateToken);  // internal use

export default router;
