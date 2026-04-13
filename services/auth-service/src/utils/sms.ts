import twilio from 'twilio';
import { config } from '../config';

const client = twilio(config.twilio.accountSid, config.twilio.authToken);

export const sendOtpSms = async (phone: string, otp: string): Promise<void> => {
  if (config.nodeEnv === 'development') {
    console.log(`[DEV] OTP for ${phone}: ${otp}`);
    return;
  }
  await client.messages.create({
    body: `Your ServeEase verification code is: ${otp}. Valid for ${config.otpExpiryMinutes} minutes. Do not share with anyone.`,
    from: config.twilio.fromNumber,
    to:   phone,
  });
};
