import express   from 'express';
import cors      from 'cors';
import helmet    from 'helmet';
import mongoose  from 'mongoose';
import http      from 'http';
import { Server } from 'socket.io';
import dotenv    from 'dotenv';
import { createClient } from 'redis';
import axios     from 'axios';
import bookingRoutes  from './routes/booking.routes';
import internalRoutes from './routes/internal.routes';
import { connectRabbitMQ } from '@serveease/shared/events';
import {
  attachMongooseLogger,
  attachRequestIdToAxios,
  createLogger,
  createRequestContextMiddleware,
  setRedisGeoClient,
} from '@serveease/shared/utils';
import { setBookingLockClient, setWorkerBookingLockClient } from './controllers/booking.controller';

dotenv.config();

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*' } });
const PORT   = parseInt(process.env.PORT || '3005', 10);
const log    = createLogger('booking-service');
attachRequestIdToAxios(axios);

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(createRequestContextMiddleware('booking-service'));

// Attach io to requests for real-time updates
app.use((req: any, _res, next) => { req.io = io; next(); });

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'booking-service' }));
app.use('/bookings',          bookingRoutes);
app.use('/internal/bookings', internalRoutes);

// ─── Socket.io — Real-time tracking ──────────────────────────────────────────
io.on('connection', (socket) => {
  log.info({ fn: 'socketConnection', action: 'SOCKET_CONNECT' }, 'Socket client connected', { socketId: socket.id });

  socket.on('join_booking', (bookingId: string) => {
    socket.join(`booking_${bookingId}`);
  });

  socket.on('chat_message', async ({ bookingId, sender, text }: any) => {
    try {
      const { BookingModel } = await import('./models/booking.model');
      const { MessageModel } = await import('./models/message.model');
      const booking = await BookingModel.findOne({ bookingId });
      const chatAllowed = booking && ['accepted','worker_en_route','arrived','in_progress','completed','payment_done'].includes(booking.status);
      if (!chatAllowed) return;
      const message = await MessageModel.create({
        bookingId,
        senderId:   sender,
        senderRole: booking.customerId === sender ? 'customer' : 'worker',
        text,
      });
      io.to(`booking_${bookingId}`).emit('new_message', {
        bookingId,
        sender,
        senderRole: message.senderRole,
        text: message.text,
        createdAt: message.createdAt?.toISOString() ?? new Date().toISOString(),
        id: message._id.toString(),
      });
    } catch (err) {
      log.error({ fn: 'socketChat', action: 'CHAT_MESSAGE' }, 'Failed to relay chat message', err);
    }
  });

  socket.on('worker_location_update', ({ bookingId, lat, lng }: any) => {
    io.to(`booking_${bookingId}`).emit('worker_moved', { lat, lng });
  });

  socket.on('disconnect', () => {
    log.info({ fn: 'socketConnection', action: 'SOCKET_DISCONNECT' }, 'Socket client disconnected', { socketId: socket.id });
  });
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  log.error({ fn: 'globalErrorHandler', action: 'UNHANDLED_ERROR' }, 'Unhandled server error', err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});


const dispatchScheduledBookings = async () => {
  const { BookingModel } = await import('./models/booking.model');
  const { BookingStatus } = await import('@serveease/shared/types');
  try {
    const now = new Date();
    const due = await BookingModel.find({
      status: BookingStatus.SEARCHING,
      'schedule.scheduledAt': { $ne: null, $lte: now },
      dispatchedTo: { $size: 0 },
    });
    const { dispatchWave } = await import('./controllers/booking.controller');
    for (const booking of due) {
      const loc = (booking as any).location?.geo?.coordinates;
      const location = loc ? { lat: loc[1], lng: loc[0] } : undefined;
      await dispatchWave(booking.bookingId, location);
    }
    if (due.length > 0) log.info({ fn: 'dispatchScheduledBookings', action: 'SCHEDULED_DISPATCH' }, 'Dispatched scheduled bookings', { count: due.length });
  } catch (err) {
    log.error({ fn: 'dispatchScheduledBookings', action: 'SCHEDULED_DISPATCH' }, 'Failed to dispatch scheduled bookings', err);
  }
};
const cleanupExpiredBookings = async () => {
  const { BookingModel } = await import('./models/booking.model');
  const { BookingStatus } = await import('@serveease/shared/types');
  const { QueueName, publishEvent } = await import('@serveease/shared/events');
  try {
    const now = new Date();
    const expired = await BookingModel.find({
      status: BookingStatus.SEARCHING,
      'schedule.expiresAt': { $lte: now },
    });
    for (const booking of expired) {
      booking.status = BookingStatus.EXPIRED;
      await booking.save();
      publishEvent(QueueName.BOOKING_STATUS_CHANGED, {
        bookingId: booking.bookingId,
        oldStatus: BookingStatus.SEARCHING,
        newStatus: BookingStatus.EXPIRED,
        customerId: booking.customerId,
        workerId: booking.workerId || '',
      });
    }
    if (expired.length > 0) {
      log.info({ fn: 'cleanupExpiredBookings', action: 'AUTO_EXPIRE' }, 'Cleaned up expired bookings', { count: expired.length });
    }
  } catch (err) {
    log.error({ fn: 'cleanupExpiredBookings', action: 'AUTO_EXPIRE' }, 'Failed to cleanup expired bookings', err);
  }
};

const start = async () => {
  attachMongooseLogger(mongoose.connection, 'booking-service');
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/serveease_bookings');
  log.info({ fn: 'start', action: 'STARTUP' }, 'MongoDB connected');

  await connectRabbitMQ(process.env.RABBITMQ_URL || 'amqp://localhost:5672');

  const lockClient = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
  await lockClient.connect();
  setBookingLockClient(lockClient as any);
  setWorkerBookingLockClient(lockClient as any);
  log.info({ fn: 'start', action: 'STARTUP' }, 'Redis lock client connected');

  // Also initialize Redis GEO client for nearby worker lookups
  const geoClient = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
  await geoClient.connect();
  setRedisGeoClient(geoClient as any);
  log.info({ fn: 'start', action: 'STARTUP' }, 'Redis GEO client connected for dispatch');

  // Recover any expired bookings from previous crashes
  await cleanupExpiredBookings();
  await dispatchScheduledBookings();
  setInterval(cleanupExpiredBookings, 30 * 1000);
  setInterval(dispatchScheduledBookings, 30 * 1000);

  server.listen(PORT, () => log.info({ fn: 'start', action: 'STARTUP' }, 'Booking service started', { port: PORT, websocket: true }));
};

start().catch(err => {
  log.error({ fn: 'start', action: 'STARTUP' }, 'Booking service failed to start', err);
  process.exit(1);
});
