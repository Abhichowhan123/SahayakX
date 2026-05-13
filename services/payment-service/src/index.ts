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
import {
  attachMongooseLogger,
  attachRequestIdToAxios,
  createLogger,
  createRequestContextMiddleware,
} from '@serveease/shared/utils';
import { IPenaltyEvent, IPaymentEvent, PaymentStatus } from '@serveease/shared/types';
import axios from 'axios';

dotenv.config();

const app  = express();
const PORT = parseInt(process.env.PORT || '3006', 10);
const log  = createLogger('payment-service');
attachRequestIdToAxios(axios);

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(createRequestContextMiddleware('payment-service'));

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
  log.error({ fn: 'globalErrorHandler', action: 'UNHANDLED_ERROR' }, 'Unhandled server error', err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

const WORKER_SERVICE_URL = process.env.WORKER_SERVICE_URL || 'http://worker-service:3003';

const start = async () => {
  attachMongooseLogger(mongoose.connection, 'payment-service');
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/serveease_payments');
  log.info({ fn: 'start', action: 'STARTUP' }, 'MongoDB connected');

  await connectRabbitMQ(process.env.RABBITMQ_URL || 'amqp://localhost:5672');

  // Release escrow to worker wallet when job is completed
  consumeEvent<IPaymentEvent>(QueueName.PAYMENT_PROCESSED, async (event) => {
    if (event.status !== PaymentStatus.RELEASED) return;
    try {
      await axios.patch(`${WORKER_SERVICE_URL}/internal/workers/${event.workerId}/wallet`, {
        amount: event.amount,
      });
      log.info({ fn: 'consumePaymentProcessed', action: 'RELEASE_ESCROW', userId: event.workerId }, 'Released payment to worker wallet', {
        amount: event.amount,
        bookingId: event.bookingId,
      });
    } catch (err) {
      log.error({ fn: 'consumePaymentProcessed', action: 'RELEASE_ESCROW', userId: event.workerId }, 'Failed to credit worker wallet', err);
    }
  });

  // Listen for penalty events
  consumeEvent<IPenaltyEvent>(QueueName.PENALTY_CHARGED, async (event) => {
    log.info({ fn: 'consumePenaltyCharged', action: 'PENALTY_EVENT', userId: event.userId }, 'Penalty event received', {
      bookingId: event.bookingId,
      penaltyAmount: event.penaltyAmount,
      cancelledBy: event.cancelledBy,
    });
  });

  app.listen(PORT, () => log.info({ fn: 'start', action: 'STARTUP' }, 'Payment service started', { port: PORT }));
};

start().catch(err => {
  log.error({ fn: 'start', action: 'STARTUP' }, 'Payment service failed to start', err);
  process.exit(1);
});
