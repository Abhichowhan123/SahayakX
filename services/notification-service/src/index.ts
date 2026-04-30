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

dotenv.config();

const app  = express();
const PORT = parseInt(process.env.PORT || '3007', 10);

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
  } else {
    console.warn('[Notification] Firebase credentials not configured — push notifications disabled');
  }
} catch (err) {
  console.warn('[Notification] Firebase init failed — push notifications disabled:', err);
}

// ─── Twilio Init ──────────────────────────────────────────────────────────────
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN,
);

// ─── Push notification helper ─────────────────────────────────────────────────
const sendPush = async (fcmToken: string, title: string, body: string, data?: Record<string, string>) => {
  if (!fcmToken || !firebaseReady || process.env.NODE_ENV === 'development') {
    console.log(`[Notification PUSH] ${title}: ${body}`);
    return;
  }
  try {
    await admin.messaging().send({ token: fcmToken, notification: { title, body }, data });
  } catch (err) {
    console.error('[Notification] Push failed:', err);
  }
};

// ─── SMS helper ───────────────────────────────────────────────────────────────
const sendSms = async (phone: string, message: string) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Notification SMS] ${phone}: ${message}`);
    return;
  }
  try {
    await twilioClient.messages.create({
      body: message,
      from: process.env.TWILIO_FROM_NUMBER!,
      to:   phone,
    });
  } catch (err) {
    console.error('[Notification] SMS failed:', err);
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
  if (fcmToken) await sendPush(fcmToken, title, body);
  if (phone)    await sendSms(phone, `${title}: ${body}`);
  res.json({ success: true });
});

const start = async () => {
  await connectRabbitMQ(process.env.RABBITMQ_URL || 'amqp://localhost:5672');

  // ── Listen: Booking Created → notify worker ─────────────────────────────
  consumeEvent<IBookingCreatedEvent>(QueueName.BOOKING_CREATED, async (event) => {
    await sendSms(event.workerPhone, `New ServeEase booking! ID: ${event.bookingId}. Accept in the app within 2 minutes.`);
  });

  // ── Listen: Booking Status Changed → notify both parties ────────────────
  consumeEvent<IBookingStatusChangedEvent & { customerFcm?: string; workerFcm?: string }>(
    QueueName.BOOKING_STATUS_CHANGED,
    async (event) => {
      const custMsg = CUSTOMER_MESSAGES[event.newStatus];
      if (custMsg) {
        await sendSms(event.customerId, custMsg.body);
      }
      const workMsg = WORKER_MESSAGES[event.newStatus];
      if (workMsg) {
        await sendSms(event.workerId, workMsg.body);
      }
    },
  );

  // ── Listen: Penalty events ───────────────────────────────────────────────
  consumeEvent<IPenaltyEvent>(QueueName.PENALTY_CHARGED, async (event) => {
    await sendSms(
      event.userId,
      `ServeEase: ₹${event.penaltyAmount} cancellation penalty charged for booking ${event.bookingId}.`,
    );
  });

  // ── Listen: General notifications ───────────────────────────────────────
  consumeEvent<{ userId: string; title: string; body: string; fcmToken?: string }>(
    QueueName.NOTIFICATION_SEND,
    async (event) => {
      if (event.fcmToken) await sendPush(event.fcmToken, event.title, event.body);
    },
  );

  app.listen(PORT, () => console.log(`[Notification Service] Running on port ${PORT}`));
};

start().catch(err => { console.error(err); process.exit(1); });
