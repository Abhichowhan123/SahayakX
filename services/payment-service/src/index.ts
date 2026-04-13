import express  from 'express';
import cors     from 'cors';
import helmet   from 'helmet';
import mongoose from 'mongoose';
import dotenv   from 'dotenv';
import { authenticate, requireRole } from './middleware/auth.middleware';
import {
  createOrder, verifyPayment, holdPayment, releasePayment,
  refundPayment, chargePenalty, getHistory, walletTopup,
} from './controllers/payment.controller';
import { connectRabbitMQ, consumeEvent, QueueName } from '@serveease/shared/events';
import { IPenaltyEvent, IPaymentEvent } from '@serveease/shared/types';

dotenv.config();

const app  = express();
const PORT = parseInt(process.env.PORT || '3006', 10);

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'payment-service' }));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.post('/payments/order',        authenticate, requireRole('customer'), createOrder);
app.post('/payments/verify',       authenticate, requireRole('customer'), verifyPayment);
app.post('/payments/wallet/topup', authenticate,                          walletTopup);
app.get('/payments/history',       authenticate,                          getHistory);

// Internal (called by other services)
app.post('/payments/hold',    holdPayment);
app.post('/payments/release', releasePayment);
app.post('/payments/refund',  refundPayment);
app.post('/payments/penalty', chargePenalty);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Payment Service Error]', err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

const start = async () => {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/serveease_payments');
  console.log('[Payment Service] MongoDB connected');

  const channel = await connectRabbitMQ(process.env.RABBITMQ_URL || 'amqp://localhost:5672');

  // Listen for penalty events
  consumeEvent<IPenaltyEvent>(QueueName.PENALTY_CHARGED, async (event) => {
    console.log('[Payment] Penalty event received:', event);
    // chargePenalty logic could be called here directly
  });

  app.listen(PORT, () => console.log(`[Payment Service] Running on port ${PORT}`));
};

start().catch(err => { console.error(err); process.exit(1); });
