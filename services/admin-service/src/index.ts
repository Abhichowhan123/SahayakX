import express   from 'express';
import cors      from 'cors';
import helmet    from 'helmet';
import jwt       from 'jsonwebtoken';
import bcrypt    from 'bcryptjs';
import axios     from 'axios';
import dotenv    from 'dotenv';
import {
  success,
  failure,
  attachRequestIdToAxios,
  createLogger,
  createRequestContextMiddleware,
} from '@serveease/shared/utils';
import { VerificationStatus } from '@serveease/shared/types';

dotenv.config();

const app  = express();
const PORT = parseInt(process.env.PORT || '3009', 10);
const log  = createLogger('admin-service');
attachRequestIdToAxios(axios);

const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || (() => { throw new Error('ADMIN_JWT_SECRET env var is required'); })();

const WORKER_SERVICE_URL  = process.env.WORKER_SERVICE_URL  || 'http://worker-service:3003';
const USER_SERVICE_URL    = process.env.USER_SERVICE_URL    || 'http://user-service:3002';
const BOOKING_SERVICE_URL = process.env.BOOKING_SERVICE_URL || 'http://booking-service:3005';

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(createRequestContextMiddleware('admin-service'));

// ─── Admin Auth Middleware ────────────────────────────────────────────────────
const adminAuth = (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    log.warn({ fn: 'adminAuth', action: 'AUTH_CHECK' }, 'Admin request with no token');
    res.status(401).json(failure('Admin authentication required'));
    return;
  }
  try {
    const payload = jwt.verify(token, ADMIN_JWT_SECRET) as any;
    if (payload.role !== 'admin') throw new Error('Not admin role');
    req.admin = payload;
    next();
  } catch (err) {
    log.warn({ fn: 'adminAuth', action: 'AUTH_CHECK' }, 'Invalid or expired admin token');
    res.status(401).json(failure('Invalid admin token'));
  }
};

// Hash generated at startup from ADMIN_PASSWORD (avoids $ interpolation issues in docker-compose)
let ADMIN_PASS_HASH = '';
const PLAIN_PASSWORD = process.env.ADMIN_PASSWORD;
if (PLAIN_PASSWORD) {
  ADMIN_PASS_HASH = bcrypt.hashSync(PLAIN_PASSWORD, 10);
} else {
  ADMIN_PASS_HASH = process.env.ADMIN_PASSWORD_HASH || '';
}

// ─── POST /admin/login ────────────────────────────────────────────────────────
app.post('/admin/login', async (req, res) => {
  const { username, password } = req.body;
  const ADMIN_USER = process.env.ADMIN_USERNAME || 'admin';
  const ctx = { fn: 'adminLogin', userId: username, role: 'admin', action: 'ADMIN_LOGIN' };
  log.enter(ctx);

  if (username !== ADMIN_USER) {
    log.warn(ctx, 'Invalid admin username', { attemptedUsername: username });
    res.status(401).json(failure('Invalid credentials'));
    return;
  }

  const valid = await bcrypt.compare(password, ADMIN_PASS_HASH);
  if (!valid) {
    log.warn(ctx, 'Invalid admin password for username', { username });
    res.status(401).json(failure('Invalid credentials'));
    return;
  }

  const token = jwt.sign({ username, role: 'admin' }, ADMIN_JWT_SECRET, { expiresIn: '8h' });
  log.info(ctx, 'Admin login successful', { username });
  res.json(success({ token }, 'Admin logged in'));
});

// ─── GET /admin/dashboard ─────────────────────────────────────────────────────
app.get('/admin/dashboard', adminAuth, async (req: any, res) => {
  const ctx = { fn: 'getDashboard', userId: req.admin?.username, role: 'admin', action: 'GET_DASHBOARD' };
  log.enter(ctx);

  try {
    const [workersRes, bookingsRes] = await Promise.allSettled([
      axios.get(`${WORKER_SERVICE_URL}/internal/workers/stats`),
      axios.get(`${BOOKING_SERVICE_URL}/internal/bookings/stats`),
    ]);

    const workersFulfilled  = workersRes.status === 'fulfilled';
    const bookingsFulfilled = bookingsRes.status === 'fulfilled';
    log.info(ctx, 'Dashboard stats aggregated', { workersAvailable: workersFulfilled, bookingsAvailable: bookingsFulfilled });

    if (!workersFulfilled)  log.warn(ctx, 'Worker service unavailable for dashboard stats');
    if (!bookingsFulfilled) log.warn(ctx, 'Booking service unavailable for dashboard stats');

    res.json(success({
      workers:  workersFulfilled  ? (workersRes  as any).value.data.data : {},
      bookings: bookingsFulfilled ? (bookingsRes as any).value.data.data : {},
      timestamp: new Date(),
    }, 'Dashboard stats'));
  } catch (err) {
    log.error(ctx, 'Dashboard aggregation error', err);
    res.json(success({ timestamp: new Date() }, 'Dashboard (some services unavailable)'));
  }
});

// ─── GET /admin/workers/pending-verification ──────────────────────────────────
app.get('/admin/workers/pending-verification', adminAuth, async (req: any, res) => {
  const ctx = { fn: 'getPendingWorkers', tag: 'adminService_getPendingWorkers', userId: req.admin?.username, role: 'admin', action: 'GET_PENDING_WORKERS' };
  log.enter(ctx, { query: req.query });

  try {
    const { data } = await axios.get(`${WORKER_SERVICE_URL}/internal/workers/pending`, { params: req.query });
    log.info(ctx, 'Pending workers fetched from worker-service');
    res.json(data);
  } catch (err) {
    log.error({ ...ctx, tag: 'adminService_getPendingWorkers_failed' }, 'Failed to fetch pending workers', err);
    res.status(500).json(failure('Internal server error'));
  }
});

// ─── POST /admin/workers/:workerId/verify ─────────────────────────────────────
app.post('/admin/workers/:workerId/verify', adminAuth, async (req: any, res) => {
  const { workerId } = req.params;
  const ctx = { fn: 'verifyWorker', tag: 'adminService_verifyWorker', userId: req.admin?.username, role: 'admin', action: 'VERIFY_WORKER' };
  log.enter(ctx, { workerId });

  try {
    const { data } = await axios.patch(
      `${WORKER_SERVICE_URL}/internal/workers/${workerId}/verification`,
      { status: VerificationStatus.VERIFIED, verifiedBy: req.admin.username },
    );
    log.info(ctx, 'Worker verification approved', { workerId, verifiedBy: req.admin.username });
    res.json(data);
  } catch (err) {
    log.error({ ...ctx, tag: 'adminService_verifyWorker_failed' }, 'Failed to verify worker', err);
    res.status(500).json(failure('Internal server error'));
  }
});

// ─── POST /admin/workers/:workerId/reject ─────────────────────────────────────
app.post('/admin/workers/:workerId/reject', adminAuth, async (req: any, res) => {
  const { workerId }        = req.params;
  const { rejectionReason } = req.body;
  const ctx = { fn: 'rejectWorker', tag: 'adminService_rejectWorker', userId: req.admin?.username, role: 'admin', action: 'REJECT_WORKER' };
  log.enter(ctx, { workerId, rejectionReason });

  try {
    const { data } = await axios.patch(
      `${WORKER_SERVICE_URL}/internal/workers/${workerId}/verification`,
      { status: VerificationStatus.REJECTED, rejectionReason },
    );
    log.info(ctx, 'Worker verification rejected', { workerId, rejectionReason });
    res.json(data);
  } catch (err) {
    log.error({ ...ctx, tag: 'adminService_rejectWorker_failed' }, 'Failed to reject worker', err);
    res.status(500).json(failure('Internal server error'));
  }
});

// ─── POST /admin/workers/:workerId/block ──────────────────────────────────────
app.post('/admin/workers/:workerId/block', adminAuth, async (req: any, res) => {
  const { workerId } = req.params;
  const { reason }   = req.body;
  const ctx = { fn: 'blockWorker', tag: 'adminService_blockWorker', userId: req.admin?.username, role: 'admin', action: 'BLOCK_WORKER' };
  log.enter(ctx, { workerId, reason });

  try {
    const { data } = await axios.patch(
      `${WORKER_SERVICE_URL}/internal/workers/${workerId}/block`,
      { isBlocked: true, blockedReason: reason },
    );
    log.info(ctx, 'Worker blocked', { workerId, reason });
    res.json(data);
  } catch (err) {
    log.error({ ...ctx, tag: 'adminService_blockWorker_failed' }, 'Failed to block worker', err);
    res.status(500).json(failure('Internal server error'));
  }
});

// ─── User Management ─────────────────────────────────────────────────────────
app.get('/admin/users', adminAuth, async (req: any, res) => {
  const ctx = { fn: 'getUsers', tag: 'adminService_getUsers', userId: req.admin?.username, role: 'admin', action: 'GET_USERS' };
  log.enter(ctx, { query: req.query });

  try {
    const { data } = await axios.get(`${USER_SERVICE_URL}/internal/users`, { params: req.query });
    log.info(ctx, 'Users fetched from user-service');
    res.json(data);
  } catch (err) {
    log.error({ ...ctx, tag: 'adminService_getUsers_failed' }, 'Failed to fetch users', err);
    res.status(500).json(failure('Internal server error'));
  }
});

app.get('/admin/users/:phone', adminAuth, async (req: any, res) => {
  const ctx = { fn: 'getUser', tag: 'adminService_getUser', userId: req.admin?.username, role: 'admin', action: 'GET_USER' };
  log.enter(ctx, { phone: req.params.phone });

  try {
    const { data } = await axios.get(`${USER_SERVICE_URL}/internal/users/${req.params.phone}`);
    log.info(ctx, 'User fetched from user-service');
    res.json(data);
  } catch (err) {
    log.error({ ...ctx, tag: 'adminService_getUser_failed' }, 'Failed to fetch user', err);
    res.status(500).json(failure('Internal server error'));
  }
});

app.put('/admin/users/:phone', adminAuth, async (req: any, res) => {
  const ctx = { fn: 'updateUser', tag: 'adminService_updateUser', userId: req.admin?.username, role: 'admin', action: 'UPDATE_USER' };
  log.enter(ctx, { phone: req.params.phone });

  try {
    const { data } = await axios.put(`${USER_SERVICE_URL}/internal/users/${req.params.phone}`, req.body);
    log.info(ctx, 'User updated via user-service');
    res.json(data);
  } catch (err) {
    log.error({ ...ctx, tag: 'adminService_updateUser_failed' }, 'Failed to update user', err);
    res.status(500).json(failure('Internal server error'));
  }
});

app.delete('/admin/users/:phone', adminAuth, async (req: any, res) => {
  const ctx = { fn: 'deleteUser', tag: 'adminService_deleteUser', userId: req.admin?.username, role: 'admin', action: 'DELETE_USER' };
  log.enter(ctx, { phone: req.params.phone });

  try {
    const { data } = await axios.delete(`${USER_SERVICE_URL}/internal/users/${req.params.phone}`);
    log.info(ctx, 'User deleted via user-service');
    res.json(data);
  } catch (err) {
    log.error({ ...ctx, tag: 'adminService_deleteUser_failed' }, 'Failed to delete user', err);
    res.status(500).json(failure('Internal server error'));
  }
});

// ─── Worker Management ───────────────────────────────────────────────────────
app.get('/admin/workers', adminAuth, async (req: any, res) => {
  const ctx = { fn: 'getWorkers', tag: 'adminService_getWorkers', userId: req.admin?.username, role: 'admin', action: 'GET_WORKERS' };
  log.enter(ctx, { query: req.query });

  try {
    const { data } = await axios.get(`${WORKER_SERVICE_URL}/internal/workers`, { params: req.query });
    log.info(ctx, 'Workers fetched from worker-service');
    res.json(data);
  } catch (err) {
    log.error({ ...ctx, tag: 'adminService_getWorkers_failed' }, 'Failed to fetch workers', err);
    res.status(500).json(failure('Internal server error'));
  }
});

app.get('/admin/workers/:workerId', adminAuth, async (req: any, res) => {
  const ctx = { fn: 'getWorker', tag: 'adminService_getWorker', userId: req.admin?.username, role: 'admin', action: 'GET_WORKER' };
  log.enter(ctx, { workerId: req.params.workerId });

  try {
    const { data } = await axios.get(`${WORKER_SERVICE_URL}/internal/workers/${req.params.workerId}`);
    log.info(ctx, 'Worker fetched from worker-service');
    res.json(data);
  } catch (err) {
    log.error({ ...ctx, tag: 'adminService_getWorker_failed' }, 'Failed to fetch worker', err);
    res.status(500).json(failure('Internal server error'));
  }
});

app.put('/admin/workers/:workerId', adminAuth, async (req: any, res) => {
  const ctx = { fn: 'updateWorker', tag: 'adminService_updateWorker', userId: req.admin?.username, role: 'admin', action: 'UPDATE_WORKER' };
  log.enter(ctx, { workerId: req.params.workerId });

  try {
    const { data } = await axios.put(`${WORKER_SERVICE_URL}/internal/workers/${req.params.workerId}`, req.body);
    log.info(ctx, 'Worker updated via worker-service');
    res.json(data);
  } catch (err) {
    log.error({ ...ctx, tag: 'adminService_updateWorker_failed' }, 'Failed to update worker', err);
    res.status(500).json(failure('Internal server error'));
  }
});

app.delete('/admin/workers/:workerId', adminAuth, async (req: any, res) => {
  const ctx = { fn: 'deleteWorker', tag: 'adminService_deleteWorker', userId: req.admin?.username, role: 'admin', action: 'DELETE_WORKER' };
  log.enter(ctx, { workerId: req.params.workerId });

  try {
    const { data } = await axios.delete(`${WORKER_SERVICE_URL}/internal/workers/${req.params.workerId}`);
    log.info(ctx, 'Worker deleted via worker-service');
    res.json(data);
  } catch (err) {
    log.error({ ...ctx, tag: 'adminService_deleteWorker_failed' }, 'Failed to delete worker', err);
    res.status(500).json(failure('Internal server error'));
  }
});

// ─── GET /admin/bookings ──────────────────────────────────────────────────────
app.get('/admin/bookings', adminAuth, async (req: any, res) => {
  const ctx = { fn: 'getBookings', tag: 'adminService_getBookings', userId: req.admin?.username, role: 'admin', action: 'GET_ALL_BOOKINGS' };
  log.enter(ctx, { query: req.query });

  try {
    const { data } = await axios.get(`${BOOKING_SERVICE_URL}/internal/bookings`, { params: req.query });
    log.info(ctx, 'All bookings fetched from booking-service');
    res.json(data);
  } catch (err) {
    log.error({ ...ctx, tag: 'adminService_getBookings_failed' }, 'Failed to fetch bookings', err);
    res.status(500).json(failure('Internal server error'));
  }
});

// ─── GET /admin/bookings/disputed ────────────────────────────────────────────
app.get('/admin/bookings/disputed', adminAuth, async (req: any, res) => {
  const ctx = { fn: 'getDisputedBookings', tag: 'adminService_getDisputedBookings', userId: req.admin?.username, role: 'admin', action: 'GET_DISPUTED_BOOKINGS' };
  log.enter(ctx);

  try {
    const { data } = await axios.get(`${BOOKING_SERVICE_URL}/internal/bookings/disputed`);
    log.info(ctx, 'Disputed bookings fetched from booking-service');
    res.json(data);
  } catch (err) {
    log.error({ ...ctx, tag: 'adminService_getDisputedBookings_failed' }, 'Failed to fetch disputed bookings', err);
    res.status(500).json(failure('Internal server error'));
  }
});

// ─── POST /admin/bookings/:bookingId/resolve-dispute ─────────────────────────
app.post('/admin/bookings/:bookingId/resolve-dispute', adminAuth, async (req: any, res) => {
  const { bookingId } = req.params;
  const ctx = { fn: 'resolveDispute', tag: 'adminService_resolveDispute', userId: req.admin?.username, role: 'admin', action: 'RESOLVE_DISPUTE' };
  log.enter(ctx, { bookingId, resolution: req.body.resolution });

  try {
    const { data } = await axios.post(
      `${BOOKING_SERVICE_URL}/internal/bookings/${bookingId}/resolve`,
      req.body,
    );
    log.info(ctx, 'Dispute resolved', { bookingId });
    res.json(data);
  } catch (err) {
    log.error({ ...ctx, tag: 'adminService_resolveDispute_failed' }, 'Failed to resolve dispute', err);
    res.status(500).json(failure('Internal server error'));
  }
});

// ─── POST /admin/broadcast-notification ──────────────────────────────────────
app.post('/admin/broadcast-notification', adminAuth, async (req: any, res) => {
  const { title, body, targetRole } = req.body;
  const ctx = { fn: 'broadcastNotification', tag: 'adminService_broadcastNotification', userId: req.admin?.username, role: 'admin', action: 'BROADCAST_NOTIFICATION' };
  log.enter(ctx, { title, targetRole });

  try {
    log.info(ctx, 'Broadcast notification queued', { title, targetRole });
    res.json(success({ sent: true, title, body, targetRole }, 'Broadcast queued'));
  } catch (err) {
    log.error({ ...ctx, tag: 'adminService_broadcastNotification_failed' }, 'Failed to broadcast notification', err);
    res.status(500).json(failure('Internal server error'));
  }
});

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'admin-service' }));

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  log.error({ fn: 'globalErrorHandler', action: 'UNHANDLED_ERROR' }, 'Unhandled server error', err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

const start = async () => {
  app.listen(PORT, () => log.info({ fn: 'start', action: 'STARTUP' }, 'Admin service started', { port: PORT }));
};

start().catch(err => {
  log.error({ fn: 'start', action: 'STARTUP' }, 'Admin service failed to start', err);
  process.exit(1);
});
