import express   from 'express';
import cors      from 'cors';
import helmet    from 'helmet';
import mongoose  from 'mongoose';
import jwt       from 'jsonwebtoken';
import bcrypt    from 'bcryptjs';
import axios     from 'axios';
import dotenv    from 'dotenv';
import { success, failure } from '@serveease/shared/utils';
import { VerificationStatus } from '@serveease/shared/types';

dotenv.config();

const app  = express();
const PORT = parseInt(process.env.PORT || '3009', 10);
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'admin_secret_change_in_prod';

const WORKER_SERVICE_URL  = process.env.WORKER_SERVICE_URL  || 'http://worker-service:3003';
const USER_SERVICE_URL    = process.env.USER_SERVICE_URL    || 'http://user-service:3002';
const BOOKING_SERVICE_URL = process.env.BOOKING_SERVICE_URL || 'http://booking-service:3005';

app.use(helmet());
app.use(cors());
app.use(express.json());

// ─── Admin Auth Middleware ────────────────────────────────────────────────────
const adminAuth = (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) { res.status(401).json(failure('Admin authentication required')); return; }
  try {
    const payload = jwt.verify(token, ADMIN_JWT_SECRET) as any;
    if (payload.role !== 'admin') throw new Error();
    req.admin = payload;
    next();
  } catch {
    res.status(401).json(failure('Invalid admin token'));
  }
};

// ─── POST /admin/login ────────────────────────────────────────────────────────
app.post('/admin/login', async (req, res) => {
  const { username, password } = req.body;
  const ADMIN_USER = process.env.ADMIN_USERNAME || 'admin';
  const ADMIN_PASS = process.env.ADMIN_PASSWORD_HASH || '';

  if (username !== ADMIN_USER) {
    res.status(401).json(failure('Invalid credentials'));
    return;
  }

  const valid = await bcrypt.compare(password, ADMIN_PASS);
  if (!valid) { res.status(401).json(failure('Invalid credentials')); return; }

  const token = jwt.sign({ username, role: 'admin' }, ADMIN_JWT_SECRET, { expiresIn: '8h' });
  res.json(success({ token }, 'Admin logged in'));
});

// ─── GET /admin/dashboard ─────────────────────────────────────────────────────
app.get('/admin/dashboard', adminAuth, async (_req, res) => {
  // Aggregate stats from all services
  try {
    const [workersRes, bookingsRes] = await Promise.allSettled([
      axios.get(`${WORKER_SERVICE_URL}/internal/workers/stats`),
      axios.get(`${BOOKING_SERVICE_URL}/internal/bookings/stats`),
    ]);

    res.json(success({
      workers:  workersRes.status === 'fulfilled'  ? workersRes.value.data.data  : {},
      bookings: bookingsRes.status === 'fulfilled' ? bookingsRes.value.data.data : {},
      timestamp: new Date(),
    }, 'Dashboard stats'));
  } catch (err) {
    res.json(success({ timestamp: new Date() }, 'Dashboard (some services unavailable)'));
  }
});

// ─── GET /admin/workers/pending-verification ──────────────────────────────────
app.get('/admin/workers/pending-verification', adminAuth, async (req, res) => {
  const { data } = await axios.get(
    `${WORKER_SERVICE_URL}/internal/workers/pending`,
    { params: req.query },
  );
  res.json(data);
});

// ─── POST /admin/workers/:workerId/verify ─────────────────────────────────────
app.post('/admin/workers/:workerId/verify', adminAuth, async (req: any, res) => {
  const { workerId } = req.params;

  const { data } = await axios.patch(
    `${WORKER_SERVICE_URL}/internal/workers/${workerId}/verification`,
    { status: VerificationStatus.VERIFIED, verifiedBy: req.admin.username },
  );

  res.json(data);
});

// ─── POST /admin/workers/:workerId/reject ─────────────────────────────────────
app.post('/admin/workers/:workerId/reject', adminAuth, async (req, res) => {
  const { workerId }        = req.params;
  const { rejectionReason } = req.body;

  const { data } = await axios.patch(
    `${WORKER_SERVICE_URL}/internal/workers/${workerId}/verification`,
    { status: VerificationStatus.REJECTED, rejectionReason },
  );

  res.json(data);
});

// ─── POST /admin/workers/:workerId/block ──────────────────────────────────────
app.post('/admin/workers/:workerId/block', adminAuth, async (req, res) => {
  const { workerId }    = req.params;
  const { reason }      = req.body;

  const { data } = await axios.patch(
    `${WORKER_SERVICE_URL}/internal/workers/${workerId}/block`,
    { isBlocked: true, blockedReason: reason },
  );
  res.json(data);
});

// ─── POST /admin/users/:userId/block ─────────────────────────────────────────
app.post('/admin/users/:userId/block', adminAuth, async (req, res) => {
  const { userId }  = req.params;
  const { reason }  = req.body;

  const { data } = await axios.patch(
    `${USER_SERVICE_URL}/internal/users/${userId}/block`,
    { isBlocked: true, blockedReason: reason },
  );
  res.json(data);
});

// ─── GET /admin/bookings ──────────────────────────────────────────────────────
app.get('/admin/bookings', adminAuth, async (req, res) => {
  const { data } = await axios.get(`${BOOKING_SERVICE_URL}/internal/bookings`, { params: req.query });
  res.json(data);
});

// ─── GET /admin/bookings/disputed ────────────────────────────────────────────
app.get('/admin/bookings/disputed', adminAuth, async (req, res) => {
  const { data } = await axios.get(`${BOOKING_SERVICE_URL}/internal/bookings/disputed`);
  res.json(data);
});

// ─── POST /admin/bookings/:bookingId/resolve-dispute ─────────────────────────
app.post('/admin/bookings/:bookingId/resolve-dispute', adminAuth, async (req, res) => {
  const { data } = await axios.post(
    `${BOOKING_SERVICE_URL}/internal/bookings/${req.params.bookingId}/resolve`,
    req.body,
  );
  res.json(data);
});

// ─── POST /admin/broadcast-notification ──────────────────────────────────────
app.post('/admin/broadcast-notification', adminAuth, async (req, res) => {
  const { title, body, targetRole } = req.body;
  // Would call notification service
  res.json(success({ sent: true, title, body, targetRole }, 'Broadcast queued'));
});

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'admin-service' }));

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Admin Service Error]', err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

const start = async () => {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/serveease_admin');
  console.log('[Admin Service] MongoDB connected');
  app.listen(PORT, () => console.log(`[Admin Service] Running on port ${PORT}`));
};

start().catch(err => { console.error(err); process.exit(1); });
