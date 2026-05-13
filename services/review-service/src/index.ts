import express   from 'express';
import cors      from 'cors';
import helmet    from 'helmet';
import mongoose, { Schema, Document } from 'mongoose';
import axios     from 'axios';
import dotenv    from 'dotenv';
import { authenticate, requireRole } from './middleware/auth.middleware';
import {
  success,
  failure,
  attachMongooseLogger,
  attachRequestIdToAxios,
  createLogger,
  createRequestContextMiddleware,
}  from '@serveease/shared/utils';

dotenv.config();

const app  = express();
const PORT = parseInt(process.env.PORT || '3008', 10);
const log  = createLogger('review-service');
attachRequestIdToAxios(axios);

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(createRequestContextMiddleware('review-service'));

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
  const ctx = { fn: 'submitReview', tag: 'reviewService_submitReview', userId: customerId, role: 'customer', action: 'SUBMIT_REVIEW' };
  log.enter(ctx, { bookingId, workerId, rating });

  try {
    const existing = await ReviewModel.findOne({ bookingId });
    log.db(ctx, 'ReviewModel.findOne (duplicate check)', { exists: !!existing });

    if (existing) {
      log.warn(ctx, 'Duplicate review attempt', { bookingId });
      res.status(409).json(failure('Review already submitted for this booking'));
      return;
    }

    const review = await ReviewModel.create({ bookingId, workerId, customerId, rating, comment, photos });
    log.db(ctx, 'ReviewModel.create', { reviewId: review._id, rating });

    // Update worker's average rating
    const stats = await ReviewModel.aggregate([
      { $match: { workerId } },
      { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]);
    log.db(ctx, 'ReviewModel.aggregate (rating stats)', { workerId, avg: stats[0]?.avg, count: stats[0]?.count });

    if (stats.length > 0) {
      const newAverage = Math.round(stats[0].avg * 10) / 10;
      try {
        await axios.patch(`${WORKER_SERVICE_URL}/internal/workers/${workerId}/rating`, {
          average: newAverage,
          totalReviews: stats[0].count,
        });
        log.info(ctx, 'Worker average rating updated via worker-service', { workerId, newAverage, totalReviews: stats[0].count });
      } catch (err) {
        log.error({ ...ctx, tag: 'reviewService_submitReview_ratingUpdateFailed' }, 'Failed to update worker rating in worker-service', err);
      }
    }

    log.info(ctx, 'Review submitted successfully', { bookingId, workerId, rating });
    res.status(201).json(success(review, 'Review submitted. Thank you!'));
  } catch (err) {
    log.error({ ...ctx, tag: 'reviewService_submitReview_failed' }, 'submitReview handler failed', err);
    res.status(500).json(failure('Internal server error'));
  }
});

// ─── GET /reviews/worker/:workerId ────────────────────────────────────────────
app.get('/reviews/worker/:workerId', async (req, res) => {
  const { workerId } = req.params;
  const page  = parseInt((req.query.page  as string) || '1', 10);
  const limit = parseInt((req.query.limit as string) || '10', 10);
  const ctx   = { fn: 'getWorkerReviews', tag: 'reviewService_getWorkerReviews', action: 'GET_WORKER_REVIEWS' };
  log.enter(ctx, { workerId, page, limit });

  try {
    const [reviews, total] = await Promise.all([
      ReviewModel.find({ workerId, isPublic: true })
        .skip((page - 1) * limit).limit(limit).sort({ createdAt: -1 }),
      ReviewModel.countDocuments({ workerId, isPublic: true }),
    ]);
    log.db(ctx, 'ReviewModel.find + countDocuments', { workerId, returned: reviews.length, total, page });

    log.info(ctx, 'Worker reviews fetched', { workerId, total, page });
    res.json({ ...success(reviews), pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    log.error({ ...ctx, tag: 'reviewService_getWorkerReviews_failed' }, 'getWorkerReviews handler failed', err);
    res.status(500).json(failure('Internal server error'));
  }
});

// ─── POST /reviews/:id/reply — Worker replies to review ──────────────────────
app.post('/reviews/:id/reply', authenticate, requireRole('worker'), async (req, res) => {
  const workerId  = (req as any).user.phone as string;
  const { reply } = req.body;
  const reviewId  = req.params.id;
  const ctx       = { fn: 'replyToReview', tag: 'reviewService_replyToReview', userId: workerId, role: 'worker', action: 'REPLY_TO_REVIEW' };
  log.enter(ctx, { reviewId });

  try {
    const review = await ReviewModel.findOneAndUpdate(
      { _id: reviewId, workerId },
      { workerReply: reply },
      { new: true },
    );
    log.db(ctx, 'ReviewModel.findOneAndUpdate (reply)', { found: !!review, reviewId });

    if (!review) {
      log.warn(ctx, 'Review not found or worker is not the owner', { reviewId, workerId });
      res.status(404).json(failure('Review not found'));
      return;
    }

    log.info(ctx, 'Worker reply added to review', { reviewId });
    res.json(success(review, 'Reply added'));
  } catch (err) {
    log.error({ ...ctx, tag: 'reviewService_replyToReview_failed' }, 'replyToReview handler failed', err);
    res.status(500).json(failure('Internal server error'));
  }
});

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'review-service' }));

const start = async () => {
  attachMongooseLogger(mongoose.connection, 'review-service');
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/serveease_reviews');
  log.info({ fn: 'start', action: 'STARTUP' }, 'MongoDB connected');
  app.listen(PORT, () => log.info({ fn: 'start', action: 'STARTUP' }, 'Review service started', { port: PORT }));
};

start().catch(err => {
  log.error({ fn: 'start', action: 'STARTUP' }, 'Review service failed to start', err);
  process.exit(1);
});
