import express         from 'express';
import cors            from 'cors';
import helmet          from 'helmet';
import mongoose        from 'mongoose';
import { createClient } from 'redis';
import { config }      from './config';
import authRoutes      from './routes/auth.routes';
import { setRedisClient } from './controllers/auth.controller';

const app = express();

app.set('trust proxy', 1);
app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'auth-service' }));

// Routes
app.use('/auth', authRoutes);

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Auth Service Error]', err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

const start = async () => {
  // MongoDB
  await mongoose.connect(config.mongoUri);
  console.log('[Auth Service] MongoDB connected');

  // Redis
  const redis = createClient({ url: config.redisUrl });
  await redis.connect();
  setRedisClient(redis);
  console.log('[Auth Service] Redis connected');

  app.listen(config.port, () => {
    console.log(`[Auth Service] Running on port ${config.port}`);
  });
};

start().catch((err) => {
  console.error('[Auth Service] Startup failed:', err);
  process.exit(1);
});
