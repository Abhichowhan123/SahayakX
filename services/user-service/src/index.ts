import express   from 'express';
import cors      from 'cors';
import helmet    from 'helmet';
import mongoose  from 'mongoose';
import dotenv    from 'dotenv';
import { userRouter } from './routes/user.routes';
import internalRoutes from './routes/internal.routes';

dotenv.config();

const app  = express();
const PORT = parseInt(process.env.PORT || '3002', 10);

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'user-service' }));

app.use('/users/me',       userRouter);
app.use('/internal/users', internalRoutes);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[User Service Error]', err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

const start = async () => {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/serveease_users');
  console.log('[User Service] MongoDB connected');
  app.listen(PORT, () => console.log(`[User Service] Running on port ${PORT}`));
};

start().catch(err => { console.error(err); process.exit(1); });
