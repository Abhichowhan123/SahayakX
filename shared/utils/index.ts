import crypto from 'crypto';

export {
  createLogger,
  createRequestContextMiddleware,
  getRequestLogContext,
  attachRequestIdToAxios,
} from './logger';
export type { ServiceLogger, LogCtx } from './logger';

// ─── OTP ─────────────────────────────────────────────────────────────────────

export const generateOTP = (length = 6): string =>
  Array.from({ length }, () => crypto.randomInt(0, 10)).join('');

export const generateBookingId = (): string => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random    = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `SRV-${timestamp}-${random}`;
};

// ─── Encryption (for Aadhaar/bank details) ───────────────────────────────────

const ALGORITHM  = 'aes-256-gcm';
const SECRET_KEY = process.env.ENCRYPTION_KEY || (
  process.env.NODE_ENV === 'production'
    ? (() => { throw new Error('ENCRYPTION_KEY env var is required in production'); })()
    : 'serveease_default_key_32chars!!'
);
const KEY        = crypto.scryptSync(SECRET_KEY, 'salt', 32);

export const encrypt = (text: string): string => {
  const iv         = crypto.randomBytes(16);
  const cipher     = crypto.createCipheriv(ALGORITHM, KEY, iv);
  const encrypted  = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const authTag    = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
};

export const decrypt = (encryptedText: string): string => {
  const [ivHex, authTagHex, encryptedHex] = encryptedText.split(':');
  const iv        = Buffer.from(ivHex, 'hex');
  const authTag   = Buffer.from(authTagHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');
  const decipher  = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
};

// ─── Penalty Calculation ─────────────────────────────────────────────────────

export const calculatePenalty = (totalAmount: number, percent = 0.10): number =>
  Math.round(totalAmount * percent * 100) / 100;

// ─── Distance (Haversine formula) ────────────────────────────────────────────

export const getDistanceKm = (
  [lon1, lat1]: [number, number],
  [lon2, lat2]: [number, number],
): number => {
  const R    = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// ─── Pagination ───────────────────────────────────────────────────────────────

export const getPaginationParams = (query: Record<string, string | undefined>) => ({
  page:  Math.max(1, parseInt(query.page  || '1',  10)),
  limit: Math.min(50, parseInt(query.limit || '10', 10)),
  skip:  (Math.max(1, parseInt(query.page || '1', 10)) - 1) *
          Math.min(50, parseInt(query.limit || '10', 10)),
});

// ─── Connection lifecycle logger ─────────────────────────────────────────────
// Attaches Mongoose connection events so app logs mirror what MongoDB itself logs
// (e.g. "Received first command on ingress connection since session start or auth handshake")

interface EventEmitterLike { on(event: string, listener: (...args: any[]) => void): any; }

const connLog = (level: string, service: string, event: string, extra?: object) =>
  console.log(JSON.stringify({ ts: new Date().toISOString(), eventId: crypto.randomUUID(), level, service, event, ...extra }));

export const attachMongooseLogger = (conn: EventEmitterLike, service: string): void => {
  conn.on('connecting',    () => connLog('info',  service, 'MONGO_CONNECTING'));
  conn.on('connected',     () => connLog('info',  service, 'MONGO_CONNECTED'));
  conn.on('open',          () => connLog('info',  service, 'MONGO_CONNECTION_OPEN'));
  conn.on('disconnecting', () => connLog('warn',  service, 'MONGO_DISCONNECTING'));
  conn.on('disconnected',  () => connLog('warn',  service, 'MONGO_DISCONNECTED'));
  conn.on('close',         () => connLog('warn',  service, 'MONGO_CONNECTION_CLOSED'));
  conn.on('reconnected',   () => connLog('info',  service, 'MONGO_RECONNECTED'));
  conn.on('error',   (err) => connLog('error', service, 'MONGO_ERROR', { error: err?.message }));
};

// ─── Response helpers ─────────────────────────────────────────────────────────

export const success = <T>(data: T, message = 'Success') => ({
  success: true, message, data,
});

export const failure = (message: string, error?: string) => ({
  success: false, message, error,
});
