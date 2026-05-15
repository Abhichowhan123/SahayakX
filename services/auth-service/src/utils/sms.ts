import twilio from 'twilio';
import { config } from '../config';
import { createLogger } from '@serveease/shared/utils';

const log = createLogger('auth-service');

// Lazy-init: only create the Twilio client in production to avoid startup
// crashes when placeholder credentials are in the dev .env
let _client: ReturnType<typeof twilio> | null = null;
const getClient = () => {
  if (!_client) _client = twilio(config.twilio.accountSid, config.twilio.authToken);
  return _client;
};

export const sendOtpSms = async (phone: string, otp: string): Promise<void> => {
  if (config.nodeEnv === 'development') {
    log.info(
      { fn: 'sendOtpSms', tag: 'authService_sendOtpSms_devOtp', userId: phone, action: 'SEND_OTP_SMS' },
      '[DEV] OTP generated',
      { devOtp: otp },
    );
    return;
  }
  await getClient().messages.create({
    body: `Your ServeEase verification code is: ${otp}. Valid for ${config.otpExpiryMinutes} minutes. Do not share with anyone.`,
    from: config.twilio.fromNumber,
    to:   phone,
  });
};
