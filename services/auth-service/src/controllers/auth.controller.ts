import { Request, Response } from 'express';
import { createClient }      from 'redis';
import { OtpModel }          from '../models/otp.model';
import { SessionModel }      from '../models/session.model';
import { signToken }         from '../utils/jwt';
import { sendOtpSms }        from '../utils/sms';
import { config }            from '../config';
import { generateOTP, success, failure } from '@serveease/shared/utils';

// Shared Redis client (injected at startup)
let redisClient: ReturnType<typeof createClient>;
export const setRedisClient = (client: ReturnType<typeof createClient>) => {
  redisClient = client;
};

// ─── POST /auth/send-otp ─────────────────────────────────────────────────────
export const sendOtp = async (req: Request, res: Response): Promise<void> => {
  const { phone, role = 'customer' } = req.body;

  // Rate limit: max 5 OTPs per phone per hour (via Redis)
  const rateLimitKey = `otp_rate:${phone}`;
  const attempts     = await redisClient.incr(rateLimitKey);
  if (attempts === 1) await redisClient.expire(rateLimitKey, 3600);
  if (attempts > 5) {
    res.status(429).json(failure('Too many OTP requests. Try again in 1 hour.'));
    return;
  }

  const otp       = generateOTP(6);
  const expiresAt = new Date(Date.now() + config.otpExpiryMinutes * 60 * 1000);

  // Delete existing OTPs for this phone
  await OtpModel.deleteMany({ phone });

  await OtpModel.create({ phone, otp, role, expiresAt });

  try {
    await sendOtpSms(phone, otp);
    res.json(success(null, `OTP sent to ${phone}`));
  } catch (err) {
    res.status(500).json(failure('Failed to send OTP', String(err)));
  }
};

// ─── POST /auth/verify-otp ───────────────────────────────────────────────────
export const verifyOtp = async (req: Request, res: Response): Promise<void> => {
  const { phone, otp, deviceId, platform, fcmToken } = req.body;

  const record = await OtpModel.findOne({ phone, verified: false }).sort({ createdAt: -1 });

  if (!record) {
    res.status(400).json(failure('OTP not found or already used. Request a new one.'));
    return;
  }

  if (record.expiresAt < new Date()) {
    await record.deleteOne();
    res.status(400).json(failure('OTP expired. Request a new one.'));
    return;
  }

  if (record.attempts >= 3) {
    await record.deleteOne();
    res.status(400).json(failure('Too many wrong attempts. Request a new OTP.'));
    return;
  }

  if (record.otp !== otp) {
    record.attempts += 1;
    await record.save();
    res.status(400).json(failure(`Incorrect OTP. ${3 - record.attempts} attempts left.`));
    return;
  }

  // Mark verified
  record.verified = true;
  await record.save();

  // Issue JWT
  // userId will be resolved by user/worker service via phone lookup
  // For auth service we issue with phone as userId placeholder
  const token = signToken({ userId: phone, role: record.role, phone });

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await SessionModel.create({ userId: phone, role: record.role, token, deviceId, platform, fcmToken, expiresAt });

  // Cache session in Redis
  await redisClient.setEx(`session:${token}`, 7 * 24 * 3600, JSON.stringify({ userId: phone, role: record.role, phone }));

  res.json(success({ token, role: record.role, phone, isNewUser: true }, 'Login successful'));
};

// ─── POST /auth/refresh ──────────────────────────────────────────────────────
export const refreshToken = async (req: Request, res: Response): Promise<void> => {
  const { token } = req.body;

  const cached = await redisClient.get(`session:${token}`);
  if (!cached) {
    res.status(401).json(failure('Session expired. Please login again.'));
    return;
  }

  const session = JSON.parse(cached) as { userId: string; role: string; phone: string };
  const newToken = signToken(session);

  await redisClient.setEx(`session:${newToken}`, 7 * 24 * 3600, JSON.stringify(session));
  await redisClient.del(`session:${token}`);

  await SessionModel.findOneAndUpdate({ token }, { token: newToken, lastSeen: new Date() });

  res.json(success({ token: newToken }, 'Token refreshed'));
};

// ─── POST /auth/logout ───────────────────────────────────────────────────────
export const logout = async (req: Request, res: Response): Promise<void> => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    await redisClient.del(`session:${token}`);
    await SessionModel.findOneAndUpdate({ token }, { isActive: false });
  }
  res.json(success(null, 'Logged out successfully'));
};

// ─── GET /auth/validate (internal service-to-service) ───────────────────────
export const validateToken = async (req: Request, res: Response): Promise<void> => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    res.status(401).json(failure('No token provided'));
    return;
  }

  const cached = await redisClient.get(`session:${token}`);
  if (!cached) {
    res.status(401).json(failure('Invalid or expired token'));
    return;
  }

  res.json(success(JSON.parse(cached), 'Token valid'));
};
