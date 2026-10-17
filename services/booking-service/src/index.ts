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
} from '@serveease/shared/utils';
import { setBookingLockClient } from './controllers/booking.controller';

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

const start = async () => {
  attachMongooseLogger(mongoose.connection, 'booking-service');
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/serveease_bookings');
  log.info({ fn: 'start', action: 'STARTUP' }, 'MongoDB connected');

  await connectRabbitMQ(process.env.RABBITMQ_URL || 'amqp://localhost:5672');

  const lockClient = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
  await lockClient.connect();
  setBookingLockClient(lockClient as any);
  log.info({ fn: 'start', action: 'STARTUP' }, 'Redis lock client connected');

  server.listen(PORT, () => log.info({ fn: 'start', action: 'STARTUP' }, 'Booking service started', { port: PORT, websocket: true }));
};

start().catch(err => {
  log.error({ fn: 'start', action: 'STARTUP' }, 'Booking service failed to start', err);
  process.exit(1);
});
