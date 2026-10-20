import crypto from 'crypto';
import { createClient, RedisClientType } from 'redis';

let geoClient: RedisClientType | null = null;

export const setRedisGeoClient = (client: RedisClientType): void => {
  geoClient = client;
};

const requireGeoClient = (): RedisClientType => {
  if (!geoClient) throw new Error('Redis geo client not initialized. Call setRedisGeoClient first.');
  return geoClient;
};

export const addOnlineWorker = async (workerId: string, lat: number, lng: number): Promise<void> => {
  const client = requireGeoClient();
  await client.geoAdd('workers:online', { longitude: lng, latitude: lat, member: workerId });
};

export const removeOnlineWorker = async (workerId: string): Promise<void> => {
  const client = requireGeoClient();
  await client.zRem('workers:online', workerId);
};

export const findNearbyWorkers = async (
  lat: number,
  lng: number,
  radiusKm: number,
  limit = 10,
): Promise<string[]> => {
  const client = requireGeoClient();
  const members = await (client as any).geoSearch(
    'workers:online',
    { longitude: lng, latitude: lat },
    { radius: radiusKm, unit: 'km' },
    { SORT: 'ASC', COUNT: limit },
  );
  return members as string[];
};

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
  const random    = Array.from({ length: 4 }, () => crypto.randomInt(0, 36).toString(36).toUpperCase()).join('');
  return `SRV-${timestamp}-${random}`;
};

// ─── Encryption (for Aadhaar/bank details) ───────────────────────────────────

const ALGORITHM = 'aes-256-gcm';

let cachedKey: Buffer | null = null;

// Resolved lazily so importing this module never fails — services that never
// encrypt/decrypt don't need ENCRYPTION_KEY to boot.
const getKey = (): Buffer => {
  if (cachedKey) return cachedKey;
  const secret = process.env.ENCRYPTION_KEY;
  if (!secret) {
    throw new Error('ENCRYPTION_KEY env var is required');
  }
  cachedKey = crypto.scryptSync(secret, 'salt', 32);
  return cachedKey;
};

export const encrypt = (text: string): string => {
  const iv         = crypto.randomBytes(16);
  const cipher     = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted  = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const authTag    = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
};

export const decrypt = (encryptedText: string): string => {
  const [ivHex, authTagHex, encryptedHex] = encryptedText.split(':');
  const iv        = Buffer.from(ivHex, 'hex');
  const authTag   = Buffer.from(authTagHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');
  const decipher  = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
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
