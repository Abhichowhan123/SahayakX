import express        from 'express';
import cors           from 'cors';
import helmet         from 'helmet';
import admin          from 'firebase-admin';
import twilio         from 'twilio';
import dotenv         from 'dotenv';
import { connectRabbitMQ, consumeEvent, QueueName } from '@serveease/shared/events';
import {
  IBookingCreatedEvent, IBookingStatusChangedEvent,
  IPenaltyEvent, BookingStatus,
} from '@serveease/shared/types';
import { createLogger } from '@serveease/shared/utils';

dotenv.config();

const app  = express();
const PORT = parseInt(process.env.PORT || '3007', 10);
const log  = createLogger('notification-service');

app.use(helmet());
app.use(cors());
app.use(express.json());

// ─── Firebase Admin Init ──────────────────────────────────────────────────────
let firebaseReady = false;
try {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const hasRealCreds = privateKey && !privateKey.includes('YOUR_KEY_HERE') && process.env.FIREBASE_PROJECT_ID;
  if (hasRealCreds) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId:   process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey,
      }),
    });
    firebaseReady = true;
    log.info({ fn: 'init', action: 'STARTUP' }, 'Firebase Admin SDK initialized');
  } else {
    log.warn({ fn: 'init', action: 'STARTUP' }, 'Firebase credentials not configured — push notifications disabled');
  }
} catch (err) {
  log.error({ fn: 'init', action: 'STARTUP' }, 'Firebase init failed — push notifications disabled', err);
}

// ─── Twilio Init ──────────────────────────────────────────────────────────────
const twilioReady = !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
const twilioClient = twilioReady
  ? twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!)
  : null;
if (!twilioReady) {
  log.warn({ fn: 'init', action: 'STARTUP' }, 'Twilio credentials not configured — SMS notifications disabled');
} else {
  log.info({ fn: 'init', action: 'STARTUP' }, 'Twilio client initialized');
}

// ─── Push notification helper ─────────────────────────────────────────────────
const sendPush = async (fcmToken: string, title: string, body: string, data?: Record<string, string>) => {
  const ctx = { fn: 'sendPush', action: 'SEND_PUSH' };
  if (!fcmToken || !firebaseReady || process.env.NODE_ENV === 'development') {
    log.info(ctx, '[DEV] Push notification skipped (dev mode or no token)', { title });
    return;
  }
  try {
    await admin.messaging().send({ token: fcmToken, notification: { title, body }, data });
    log.info(ctx, 'Push notification sent via Firebase', { title });
  } catch (err) {
    log.error(ctx, 'Push notification failed', err);
  }
};

// ─── SMS helper ───────────────────────────────────────────────────────────────
const sendSms = async (phone: string, message: string) => {
  const ctx = { fn: 'sendSms', userId: phone, action: 'SEND_SMS' };
  if (process.env.NODE_ENV === 'development') {
    log.info(ctx, '[DEV] SMS skipped (dev mode)', { messagePreview: message.slice(0, 60) });
    return;
  }
  if (!twilioClient) {
    log.warn(ctx, 'SMS skipped — Twilio not configured', { messagePreview: message.slice(0, 60) });
    return;
  }
  try {
    await twilioClient.messages.create({
      body: message,
      from: process.env.TWILIO_FROM_NUMBER!,
      to:   phone,
    });
    log.info(ctx, 'SMS sent via Twilio', { messagePreview: message.slice(0, 60) });
  } catch (err) {
    log.error(ctx, 'SMS send failed via Twilio', err);
  }
};

// ─── Booking status message maps ──────────────────────────────────────────────
const CUSTOMER_MESSAGES: Partial<Record<BookingStatus, { title: string; body: string }>> = {
  [BookingStatus.ACCEPTED]:        { title: 'Worker Accepted!',    body: 'Your worker accepted the request and is heading to you.' },
  [BookingStatus.WORKER_EN_ROUTE]: { title: 'Worker On the Way',   body: 'Your worker is on the way to your location.' },
  [BookingStatus.IN_PROGRESS]:     { title: 'Work Started',        body: 'Your service has started. Have a great experience!' },
  [BookingStatus.COMPLETED]:       { title: 'Service Completed',   body: 'Job done! Please rate your experience.' },
  [BookingStatus.EXPIRED]:         { title: 'Request Expired',     body: 'No worker accepted your request. Please try again.' },
  [BookingStatus.CANCELLED_BY_WORKER]: { title: 'Booking Cancelled', body: 'Worker cancelled. Refund will be processed shortly.' },
};

const WORKER_MESSAGES: Partial<Record<BookingStatus, { title: string; body: string }>> = {
  [BookingStatus.SEARCHING]:           { title: 'New Booking Request!',  body: 'A customer wants to book your service. Accept within 2 minutes.' },
  [BookingStatus.CANCELLED_BY_CUSTOMER]: { title: 'Booking Cancelled', body: 'Customer cancelled the booking.' },
};

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'notification-service' }));

// ─── Manual send endpoint (for admin broadcasts) ──────────────────────────────
app.post('/notifications/send', async (req, res) => {
  const { fcmToken, phone, title, body } = req.body;
  const ctx = { fn: 'manualSend', action: 'MANUAL_SEND' };
  log.enter(ctx, { hasToken: !!fcmToken, hasPhone: !!phone, title });

  if (fcmToken) await sendPush(fcmToken, title, body);
  if (phone)    await sendSms(phone, `${title}: ${body}`);

  log.info(ctx, 'Manual notification dispatched', { title });
  res.json({ success: true });
});

const start = async () => {
  await connectRabbitMQ(process.env.RABBITMQ_URL || 'amqp://localhost:5672');
  log.info({ fn: 'start', action: 'STARTUP' }, 'RabbitMQ connected, starting event consumers');

  // ── Listen: Booking Created → notify worker ─────────────────────────────
  consumeEvent<IBookingCreatedEvent>(QueueName.BOOKING_CREATED, async (event) => {
    const ctx = { fn: 'onBookingCreated', userId: event.workerPhone, action: 'NOTIFY_WORKER_NEW_BOOKING' };
    log.enter(ctx, { bookingId: event.bookingId });
    await sendSms(event.workerPhone, `New ServeEase booking! ID: ${event.bookingId}. Accept in the app within 2 minutes.`);
    log.info(ctx, 'Worker notified of new booking', { bookingId: event.bookingId });
  });

  // ── Listen: Booking Status Changed → notify both parties ────────────────
  consumeEvent<IBookingStatusChangedEvent & { customerFcm?: string; workerFcm?: string }>(
    QueueName.BOOKING_STATUS_CHANGED,
    async (event) => {
      const ctx = { fn: 'onBookingStatusChanged', action: 'NOTIFY_STATUS_CHANGE' };
      log.enter(ctx, { bookingId: event.bookingId, newStatus: event.newStatus });

      const custMsg = CUSTOMER_MESSAGES[event.newStatus];
      if (custMsg) {
        log.info({ ...ctx, userId: event.customerId }, 'Sending status notification to customer', { newStatus: event.newStatus });
        await sendSms(event.customerId, custMsg.body);
      }

      const workMsg = WORKER_MESSAGES[event.newStatus];
      if (workMsg) {
        log.info({ ...ctx, userId: event.workerId }, 'Sending status notification to worker', { newStatus: event.newStatus });
        await sendSms(event.workerId, workMsg.body);
      }

      if (!custMsg && !workMsg) {
        log.info(ctx, 'No notification configured for this status', { newStatus: event.newStatus });
      }
    },
  );

  // ── Listen: Penalty events ───────────────────────────────────────────────
  consumeEvent<IPenaltyEvent>(QueueName.PENALTY_CHARGED, async (event) => {
    const ctx = { fn: 'onPenaltyCharged', userId: event.userId, action: 'NOTIFY_PENALTY' };
    log.enter(ctx, { bookingId: event.bookingId, penaltyAmount: event.penaltyAmount });
    await sendSms(
      event.userId,
      `ServeEase: ₹${event.penaltyAmount} cancellation penalty charged for booking ${event.bookingId}.`,
    );
    log.info(ctx, 'Penalty SMS sent', { bookingId: event.bookingId, penaltyAmount: event.penaltyAmount });
  });

  // ── Listen: General notifications ───────────────────────────────────────
  consumeEvent<{ userId: string; title: string; body: string; fcmToken?: string }>(
    QueueName.NOTIFICATION_SEND,
    async (event) => {
      const ctx = { fn: 'onNotificationSend', userId: event.userId, action: 'SEND_NOTIFICATION' };
      log.enter(ctx, { title: event.title, hasFcmToken: !!event.fcmToken });
      if (event.fcmToken) {
        await sendPush(event.fcmToken, event.title, event.body);
        log.info(ctx, 'Push notification sent from general event', { title: event.title });
      } else {
        log.warn(ctx, 'General notification event received but no fcmToken', { userId: event.userId });
      }
    },
  );

  app.listen(PORT, () => log.info({ fn: 'start', action: 'STARTUP' }, 'Notification service started', { port: PORT }));
};

start().catch(err => {
  log.error({ fn: 'start', action: 'STARTUP' }, 'Notification service failed to start', err);
  process.exit(1);
});
