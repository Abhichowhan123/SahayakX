import express   from 'express';
import cors      from 'cors';
import helmet    from 'helmet';
import mongoose  from 'mongoose';
import http      from 'http';
import { Server } from 'socket.io';
import dotenv    from 'dotenv';
import bookingRoutes from './routes/booking.routes';
import { connectRabbitMQ } from '@serveease/shared/events';

dotenv.config();

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*' } });
const PORT   = parseInt(process.env.PORT || '3005', 10);

app.use(helmet());
app.use(cors());
app.use(express.json());

// Attach io to requests for real-time updates
app.use((req: any, _res, next) => { req.io = io; next(); });

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'booking-service' }));
app.use('/bookings', bookingRoutes);

// ─── Socket.io — Real-time tracking ──────────────────────────────────────────
io.on('connection', (socket) => {
  console.log('[Socket] Client connected:', socket.id);

  socket.on('join_booking', (bookingId: string) => {
    socket.join(`booking_${bookingId}`);
  });

  socket.on('worker_location_update', ({ bookingId, lat, lng }: any) => {
    io.to(`booking_${bookingId}`).emit('worker_moved', { lat, lng });
  });

  socket.on('disconnect', () => {
    console.log('[Socket] Client disconnected:', socket.id);
  });
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Booking Service Error]', err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

const start = async () => {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/serveease_bookings');
  console.log('[Booking Service] MongoDB connected');

  await connectRabbitMQ(process.env.RABBITMQ_URL || 'amqp://localhost:5672');

  server.listen(PORT, () => console.log(`[Booking Service] Running on port ${PORT} (HTTP + WebSocket)`));
};

start().catch(err => { console.error(err); process.exit(1); });
