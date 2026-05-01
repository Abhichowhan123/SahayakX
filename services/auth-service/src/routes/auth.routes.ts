import { Router } from 'express';
import rateLimit  from 'express-rate-limit';
import { sendOtp, verifyOtp, refreshToken, logout, validateToken } from '../controllers/auth.controller';
import { validate, sendOtpSchema, verifyOtpSchema } from '../middleware/validate';

const router = Router();

// Allow up to 10 OTP sends per 10 minutes per IP
const sendOtpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max:      10,
  message:  { success: false, message: 'Too many OTP requests. Try after 10 minutes.' },
});

// Allow up to 10 verify attempts per 10 minutes per IP
const verifyOtpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max:      10,
  message:  { success: false, message: 'Too many verify attempts. Try after 10 minutes.' },
});

router.post('/send-otp',   sendOtpLimiter,   validate(sendOtpSchema),   sendOtp);
router.post('/verify-otp', verifyOtpLimiter, validate(verifyOtpSchema), verifyOtp);
router.post('/refresh',    refreshToken);
router.post('/logout',     logout);
router.get('/validate',    validateToken);  // internal use

export default router;
