import express  from 'express';
import cors     from 'cors';
import helmet   from 'helmet';
import mongoose from 'mongoose';
import dotenv   from 'dotenv';
import axios    from 'axios';
import { workerRouter } from './routes/worker.routes';
import internalRoutes from './routes/internal.routes';
import {
  attachMongooseLogger,
  attachRequestIdToAxios,
  createLogger,
  createRequestContextMiddleware,
} from '@serveease/shared/utils';

dotenv.config();

const app  = express();
const PORT = parseInt(process.env.PORT || '3003', 10);
const log  = createLogger('worker-service');
attachRequestIdToAxios(axios);

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(createRequestContextMiddleware('worker-service'));

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'worker-service' }));

app.use('/workers',          workerRouter);
app.use('/internal/workers', internalRoutes);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  log.error({ fn: 'globalErrorHandler', action: 'UNHANDLED_ERROR' }, 'Unhandled server error', err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

const start = async () => {
  attachMongooseLogger(mongoose.connection, 'worker-service');
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/serveease_workers');
  log.info({ fn: 'start', action: 'STARTUP' }, 'MongoDB connected');
  app.listen(PORT, () => log.info({ fn: 'start', action: 'STARTUP' }, 'Worker service started', { port: PORT }));
};

start().catch(err => {
  log.error({ fn: 'start', action: 'STARTUP' }, 'Worker service failed to start', err);
  process.exit(1);
});
