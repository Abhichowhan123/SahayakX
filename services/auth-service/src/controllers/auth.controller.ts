import { Request, Response } from 'express';
import { createClient }      from 'redis';
import { OtpModel }          from '../models/otp.model';
import { SessionModel }      from '../models/session.model';
import { RegisteredPhoneModel } from '../models/registered-phone.model';
import { signToken }         from '../utils/jwt';
import { sendOtpSms }        from '../utils/sms';
import { config }            from '../config';
import { generateOTP, success, failure, createLogger } from '@serveease/shared/utils';

const log = createLogger('auth-service');

// Shared Redis client (injected at startup)
let redisClient: ReturnType<typeof createClient>;
export const setRedisClient = (client: ReturnType<typeof createClient>) => {
  redisClient = client;
};

// ─── POST /auth/send-otp ─────────────────────────────────────────────────────
// mode = 'login'    → phone must already be registered; role must match
// mode = 'register' → phone must NOT already be registered (new user only)
export const sendOtp = async (req: Request, res: Response): Promise<void> => {
  const { phone, role = 'customer', mode = 'login' } = req.body;
  const ctx = { fn: 'sendOtp', tag: 'authService_sendOtp', userId: phone, role, action: 'SEND_OTP' };
  log.enter(ctx, { mode });

  try {
    const registered = await RegisteredPhoneModel.findOne({ phone });
    log.db(ctx, 'RegisteredPhoneModel.findOne', { found: !!registered, existingRole: registered?.role });

    if (mode === 'login') {
      if (!registered) {
        log.warn(ctx, 'Phone not registered, login attempt rejected');
        res.status(404).json(failure('NOT_REGISTERED'));
        return;
      }
      if (registered.role !== role) {
        log.warn(ctx, 'Role mismatch on login', { requestedRole: role, registeredRole: registered.role });
        const registeredLabel = registered.role === 'customer' ? 'I need a service' : 'I provide service';
        res.status(400).json(failure(`This number is registered as "${registeredLabel}". Please select the correct role to login.`));
        return;
      }
    }

    if (mode === 'register') {
      if (registered) {
        log.warn(ctx, 'Phone already registered, register attempt rejected', { existingRole: registered.role });
        const registeredLabel = registered.role === 'customer' ? 'I need a service' : 'I provide service';
        res.status(400).json(failure(`This number is already registered as "${registeredLabel}". Please login instead.`));
        return;
      }
    }

    const otp       = generateOTP(6);
    const expiresAt = new Date(Date.now() + config.otpExpiryMinutes * 60 * 1000);

    await OtpModel.deleteMany({ phone });
    await OtpModel.create({ phone, otp, role, expiresAt });
    log.db(ctx, 'OtpModel.create', { expiresAt });

    try {
      await sendOtpSms(phone, otp);
      log.info(ctx, 'OTP sent via SMS successfully');
      // In development: return the OTP in the response so it's visible in the app
      const devPayload = config.nodeEnv === 'development' ? { devOtp: otp } : null;
      res.json(success(devPayload, `OTP sent to ${phone}`));
    } catch (smsErr) {
      log.error({ ...ctx, tag: 'authService_sendOtp_smsFailed' }, 'Failed to send OTP via SMS', smsErr);
      res.status(500).json(failure('Failed to send OTP. Check Twilio credentials.', String(smsErr)));
    }
  } catch (err) {
    log.error({ ...ctx, tag: 'authService_sendOtp_failed' }, 'sendOtp handler failed', err);
    res.status(500).json(failure('Internal server error'));
  }
};

// ─── POST /auth/verify-otp ───────────────────────────────────────────────────
export const verifyOtp = async (req: Request, res: Response): Promise<void> => {
  const { phone, otp, deviceId, platform, fcmToken } = req.body;
  const ctx = { fn: 'verifyOtp', tag: 'authService_verifyOtp', userId: phone, action: 'VERIFY_OTP' };
  log.enter(ctx, { platform });

  try {
    const record = await OtpModel.findOne({ phone, verified: false }).sort({ createdAt: -1 });
    log.db(ctx, 'OtpModel.findOne', { found: !!record });

    if (!record) {
      log.warn(ctx, 'No active OTP record found');
      res.status(400).json(failure('OTP not found or already used. Request a new one.'));
      return;
    }

    if (record.expiresAt < new Date()) {
      log.warn(ctx, 'OTP expired', { expiresAt: record.expiresAt });
      await record.deleteOne();
      res.status(400).json(failure('OTP expired. Request a new one.'));
      return;
    }

    if (record.attempts >= 3) {
      log.warn(ctx, 'OTP max attempts exceeded', { attempts: record.attempts });
      await record.deleteOne();
      res.status(400).json(failure('Too many wrong attempts. Request a new OTP.'));
      return;
    }

    if (record.otp !== otp) {
      record.attempts += 1;
      await record.save();
      log.warn(ctx, 'Incorrect OTP entered', { attemptsLeft: 3 - record.attempts });
      res.status(400).json(failure(`Incorrect OTP. ${3 - record.attempts} attempts left.`));
      return;
    }

    record.verified = true;
    await record.save();
    log.db(ctx, 'OtpModel.save (verified=true)');

    const isNewUser = !(await RegisteredPhoneModel.exists({ phone }));
    log.db(ctx, 'RegisteredPhoneModel.exists', { isNewUser });

    if (isNewUser) {
      await RegisteredPhoneModel.create({ phone, role: record.role });
      log.db(ctx, 'RegisteredPhoneModel.create', { role: record.role });
    }

    const token = signToken({ userId: phone, role: record.role, phone });

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await SessionModel.create({ userId: phone, role: record.role, token, deviceId, platform, fcmToken, expiresAt });
    log.db(ctx, 'SessionModel.create', { role: record.role, expiresAt, platform });

    await redisClient.setEx(`session:${token}`, 7 * 24 * 3600, JSON.stringify({ userId: phone, role: record.role, phone }));
    log.info(ctx, 'Login successful', { role: record.role, isNewUser });

    res.json(success({ token, role: record.role, phone, isNewUser }, 'Login successful'));
  } catch (err) {
    log.error({ ...ctx, tag: 'authService_verifyOtp_failed' }, 'verifyOtp handler failed', err);
    res.status(500).json(failure('Internal server error'));
  }
};

// ─── POST /auth/refresh ──────────────────────────────────────────────────────
export const refreshToken = async (req: Request, res: Response): Promise<void> => {
  const { token } = req.body;
  const ctx = { fn: 'refreshToken', tag: 'authService_refreshToken', action: 'REFRESH_TOKEN' };
  log.enter(ctx);

  try {
    const cached = await redisClient.get(`session:${token}`);
    if (!cached) {
      log.warn(ctx, 'Session not found in Redis, token likely expired');
      res.status(401).json(failure('Session expired. Please login again.'));
      return;
    }

    const session = JSON.parse(cached) as { userId: string; role: string; phone: string };
    const enrichedCtx = { ...ctx, userId: session.userId, role: session.role };

    const newToken = signToken(session);
    await redisClient.setEx(`session:${newToken}`, 7 * 24 * 3600, JSON.stringify(session));
    await redisClient.del(`session:${token}`);

    await SessionModel.findOneAndUpdate({ token }, { token: newToken, lastSeen: new Date() });
    log.db(enrichedCtx, 'SessionModel.findOneAndUpdate (token rotated)');

    log.info(enrichedCtx, 'Token refreshed successfully');
    res.json(success({ token: newToken }, 'Token refreshed'));
  } catch (err) {
    log.error({ ...ctx, tag: 'authService_refreshToken_failed' }, 'refreshToken handler failed', err);
    res.status(500).json(failure('Internal server error'));
  }
};

// ─── POST /auth/logout ───────────────────────────────────────────────────────
export const logout = async (req: Request, res: Response): Promise<void> => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const ctx = { fn: 'logout', tag: 'authService_logout', action: 'LOGOUT' };
  log.enter(ctx);

  try {
    if (token) {
      await redisClient.del(`session:${token}`);
      await SessionModel.findOneAndUpdate({ token }, { isActive: false });
      log.db(ctx, 'SessionModel.findOneAndUpdate (isActive=false)');
      log.info(ctx, 'Session invalidated and user logged out');
    } else {
      log.warn(ctx, 'Logout called with no token in Authorization header');
    }

    res.json(success(null, 'Logged out successfully'));
  } catch (err) {
    log.error({ ...ctx, tag: 'authService_logout_failed' }, 'logout handler failed', err);
    res.status(500).json(failure('Internal server error'));
  }
};

// ─── GET /auth/validate (internal service-to-service) ───────────────────────
export const validateToken = async (req: Request, res: Response): Promise<void> => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const ctx = { fn: 'validateToken', tag: 'authService_validateToken', action: 'VALIDATE_TOKEN' };
  log.enter(ctx);

  try {
    if (!token) {
      log.warn(ctx, 'No token provided in Authorization header');
      res.status(401).json(failure('No token provided'));
      return;
    }

    const cached = await redisClient.get(`session:${token}`);
    if (!cached) {
      log.warn(ctx, 'Token not found in Redis — invalid or expired');
      res.status(401).json(failure('Invalid or expired token'));
      return;
    }

    const session = JSON.parse(cached) as { userId: string; role: string };
    log.info({ ...ctx, userId: session.userId, role: session.role }, 'Token validated successfully');
    res.json(success(JSON.parse(cached), 'Token valid'));
  } catch (err) {
    log.error({ ...ctx, tag: 'authService_validateToken_failed' }, 'validateToken handler failed', err);
    res.status(500).json(failure('Internal server error'));
  }
};
