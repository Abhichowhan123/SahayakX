import twilio from 'twilio';
import { config } from '../config';

// Lazy-init: only create the Twilio client in production to avoid startup
// crashes when placeholder credentials are in the dev .env
let _client: ReturnType<typeof twilio> | null = null;
const getClient = () => {
  if (!_client) _client = twilio(config.twilio.accountSid, config.twilio.authToken);
  return _client;
};

export const sendOtpSms = async (phone: string, otp: string): Promise<void> => {
  if (config.nodeEnv === 'development') {
    console.log(`[DEV] OTP for ${phone}: ${otp}`);
    return;
  }
  await getClient().messages.create({
    body: `Your ServeEase verification code is: ${otp}. Valid for ${config.otpExpiryMinutes} minutes. Do not share with anyone.`,
    from: config.twilio.fromNumber,
    to:   phone,
  });
};
