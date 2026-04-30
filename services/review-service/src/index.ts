import express   from 'express';
import cors      from 'cors';
import helmet    from 'helmet';
import mongoose, { Schema, Document } from 'mongoose';
import axios     from 'axios';
import dotenv    from 'dotenv';
import { authenticate, requireRole } from './middleware/auth.middleware';
import { success, failure }  from '@serveease/shared/utils';

dotenv.config();

const app  = express();
const PORT = parseInt(process.env.PORT || '3008', 10);

app.use(helmet());
app.use(cors());
app.use(express.json());

// ─── Review Model ─────────────────────────────────────────────────────────────
interface IReviewDocument extends Document {
  bookingId:   string;
  workerId:    string;
  customerId:  string;
  rating:      number;          // 1-5
  comment:     string;
  photos?:     string[];
  isPublic:    boolean;
  workerReply?: string;
  createdAt:   Date;
}

const ReviewSchema = new Schema<IReviewDocument>({
  bookingId:   { type: String, required: true, unique: true },
  workerId:    { type: String, required: true, index: true },
  customerId:  { type: String, required: true },
  rating:      { type: Number, required: true, min: 1, max: 5 },
  comment:     { type: String, default: '' },
  photos:      [String],
  isPublic:    { type: Boolean, default: true },
  workerReply: String,
}, { timestamps: true });

const ReviewModel = mongoose.model<IReviewDocument>('Review', ReviewSchema);

const WORKER_SERVICE_URL = process.env.WORKER_SERVICE_URL || 'http://worker-service:3003';

// ─── POST /reviews — Submit review ────────────────────────────────────────────
app.post('/reviews', authenticate, requireRole('customer'), async (req, res) => {
  const customerId = (req as any).user.phone as string;
  const { bookingId, workerId, rating, comment, photos } = req.body;

  const existing = await ReviewModel.findOne({ bookingId });
  if (existing) { res.status(409).json(failure('Review already submitted for this booking')); return; }

  const review = await ReviewModel.create({ bookingId, workerId, customerId, rating, comment, photos });

  // Update worker's average rating
  const stats = await ReviewModel.aggregate([
    { $match: { workerId } },
    { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);

  if (stats.length > 0) {
    await axios.patch(`${WORKER_SERVICE_URL}/internal/workers/${workerId}/rating`, {
      average: Math.round(stats[0].avg * 10) / 10,
      totalReviews: stats[0].count,
    }).catch(err => console.error('[Review] Failed to update worker rating:', err));
  }

  res.status(201).json(success(review, 'Review submitted. Thank you!'));
});

// ─── GET /reviews/worker/:workerId ────────────────────────────────────────────
app.get('/reviews/worker/:workerId', async (req, res) => {
  const { workerId } = req.params;
  const page  = parseInt((req.query.page  as string) || '1', 10);
  const limit = parseInt((req.query.limit as string) || '10', 10);

  const [reviews, total] = await Promise.all([
    ReviewModel.find({ workerId, isPublic: true })
      .skip((page - 1) * limit).limit(limit).sort({ createdAt: -1 }),
    ReviewModel.countDocuments({ workerId, isPublic: true }),
  ]);

  res.json({ ...success(reviews), pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
});

// ─── POST /reviews/:id/reply — Worker replies to review ──────────────────────
app.post('/reviews/:id/reply', authenticate, requireRole('worker'), async (req, res) => {
  const workerId = (req as any).user.phone as string;
  const { reply } = req.body;

  const review = await ReviewModel.findOneAndUpdate(
    { _id: req.params.id, workerId },
    { workerReply: reply },
    { new: true },
  );
  if (!review) { res.status(404).json(failure('Review not found')); return; }

  res.json(success(review, 'Reply added'));
});

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'review-service' }));

const start = async () => {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/serveease_reviews');
  console.log('[Review Service] MongoDB connected');
  app.listen(PORT, () => console.log(`[Review Service] Running on port ${PORT}`));
};

start().catch(err => { console.error(err); process.exit(1); });
