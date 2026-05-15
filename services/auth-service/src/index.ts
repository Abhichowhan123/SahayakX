import express         from 'express';
import cors            from 'cors';
import helmet          from 'helmet';
import mongoose        from 'mongoose';
import { createClient } from 'redis';
import { config }      from './config';
import authRoutes      from './routes/auth.routes';
import { setRedisClient } from './controllers/auth.controller';
import { attachMongooseLogger, createLogger, createRequestContextMiddleware } from '@serveease/shared/utils';

const app = express();
const log = createLogger('auth-service');

app.set('trust proxy', 1);
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(createRequestContextMiddleware('auth-service'));

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'auth-service' }));

// Routes
app.use('/auth', authRoutes);

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  log.error({ fn: 'globalErrorHandler', action: 'UNHANDLED_ERROR' }, 'Unhandled server error', err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

const start = async () => {
  attachMongooseLogger(mongoose.connection, 'auth-service');
  await mongoose.connect(config.mongoUri);
  log.info({ fn: 'start', action: 'STARTUP' }, 'MongoDB connected');

  // Redis
  const redis = createClient({ url: config.redisUrl });
  await redis.connect();
  setRedisClient(redis);
  log.info({ fn: 'start', action: 'STARTUP' }, 'Redis connected');

  app.listen(config.port, () => {
    log.info({ fn: 'start', action: 'STARTUP' }, 'Auth service started', { port: config.port });
  });
};

start().catch((err) => {
  log.error({ fn: 'start', action: 'STARTUP' }, 'Auth service failed to start', err);
  process.exit(1);
});
