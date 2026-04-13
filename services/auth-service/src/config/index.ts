import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port:          parseInt(process.env.PORT || '3001', 10),
  mongoUri:      process.env.MONGODB_URI   || 'mongodb://localhost:27017/serveease_auth',
  redisUrl:      process.env.REDIS_URL     || 'redis://localhost:6379',
  rabbitMqUrl:   process.env.RABBITMQ_URL  || 'amqp://localhost:5672',
  jwtSecret:     process.env.JWT_SECRET    || 'serveease_jwt_secret_change_in_prod',
  jwtExpiresIn:  process.env.JWT_EXPIRES   || '7d',
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken:  process.env.TWILIO_AUTH_TOKEN  || '',
    fromNumber: process.env.TWILIO_FROM_NUMBER || '',
  },
  otpExpiryMinutes: 5,
  nodeEnv: process.env.NODE_ENV || 'development',
};
