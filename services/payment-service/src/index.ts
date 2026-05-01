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
import { attachMongooseLogger } from '@serveease/shared/utils';
import { IPenaltyEvent, IPaymentEvent, PaymentStatus } from '@serveease/shared/types';
import axios from 'axios';

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

const WORKER_SERVICE_URL = process.env.WORKER_SERVICE_URL || 'http://worker-service:3003';

const start = async () => {
  attachMongooseLogger(mongoose.connection, 'payment-service');
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/serveease_payments');
  console.log('[Payment Service] MongoDB connected');

  await connectRabbitMQ(process.env.RABBITMQ_URL || 'amqp://localhost:5672');

  // Release escrow to worker wallet when job is completed
  consumeEvent<IPaymentEvent>(QueueName.PAYMENT_PROCESSED, async (event) => {
    if (event.status !== PaymentStatus.RELEASED) return;
    try {
      await axios.patch(`${WORKER_SERVICE_URL}/internal/workers/${event.workerId}/wallet`, {
        amount: event.amount,
      });
      console.log(`[Payment] Released ₹${event.amount} to worker ${event.workerId} for booking ${event.bookingId}`);
    } catch (err) {
      console.error('[Payment] Failed to credit worker wallet:', err);
    }
  });

  // Listen for penalty events
  consumeEvent<IPenaltyEvent>(QueueName.PENALTY_CHARGED, async (event) => {
    console.log('[Payment] Penalty event received:', event);
  });

  app.listen(PORT, () => console.log(`[Payment Service] Running on port ${PORT}`));
};

start().catch(err => { console.error(err); process.exit(1); });
