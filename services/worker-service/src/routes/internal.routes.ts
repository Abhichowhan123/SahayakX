import { Router }      from 'express';
import { WorkerModel } from '../models/worker.model';
import { VerificationStatus } from '@serveease/shared/types';
import { success, failure }   from '@serveease/shared/utils';

const router = Router();

// GET /internal/workers/stats — aggregate stats for admin dashboard
router.get('/stats', async (_req, res) => {
  const [total, verified, pending, online] = await Promise.all([
    WorkerModel.countDocuments(),
    WorkerModel.countDocuments({ 'verification.status': VerificationStatus.VERIFIED }),
    WorkerModel.countDocuments({ 'verification.status': VerificationStatus.PENDING }),
    WorkerModel.countDocuments({ isOnline: true }),
  ]);
  res.json(success({ total, verified, pending, online }, 'Worker stats'));
});

// GET /internal/workers/pending — list pending verification workers
router.get('/pending', async (req, res) => {
  const page  = parseInt((req.query.page  as string) || '1',  10);
  const limit = parseInt((req.query.limit as string) || '20', 10);
  const skip  = (page - 1) * limit;

  const [workers, total] = await Promise.all([
    WorkerModel.find(
      { 'verification.status': VerificationStatus.PENDING },
      {
        fullName: 1, phone: 1, serviceCategory: 1,
        'verification.aadhaarFrontPhoto': 1,
        'verification.aadhaarBackPhoto':  1,
        'verification.selfiePhoto':       1,
        'verification.submittedAt':       1,
        createdAt: 1,
      },
    ).skip(skip).limit(limit).sort({ 'verification.submittedAt': 1 }),
    WorkerModel.countDocuments({ 'verification.status': VerificationStatus.PENDING }),
  ]);

  res.json({
    ...success(workers, 'Pending verification workers'),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

// GET /internal/workers/:id — full worker record (for other services)
router.get('/:id', async (req, res) => {
  const worker = await WorkerModel.findById(req.params.id);
  if (!worker) { res.status(404).json(failure('Worker not found')); return; }
  res.json(success(worker));
});

// PATCH /internal/workers/:id/rating — update average rating after a review
router.patch('/:id/rating', async (req, res) => {
  const { average, totalReviews } = req.body;
  const worker = await WorkerModel.findByIdAndUpdate(
    req.params.id,
    { ratings: { average, totalReviews } },
    { new: true },
  );
  if (!worker) { res.status(404).json(failure('Worker not found')); return; }
  res.json(success({ ratings: worker.ratings }, 'Rating updated'));
});

// PATCH /internal/workers/:id/verification — admin approve or reject
router.patch('/:id/verification', async (req, res) => {
  const { status, verifiedBy, rejectionReason } = req.body;

  const update: Record<string, unknown> = {
    'verification.status': status,
  };
  if (status === VerificationStatus.VERIFIED) {
    update['verification.verifiedAt'] = new Date();
    update['verification.verifiedBy'] = verifiedBy;
  }
  if (status === VerificationStatus.REJECTED && rejectionReason) {
    update['verification.rejectionReason'] = rejectionReason;
  }

  const worker = await WorkerModel.findByIdAndUpdate(req.params.id, update, { new: true });
  if (!worker) { res.status(404).json(failure('Worker not found')); return; }

  res.json(success({
    id:     worker._id,
    status: worker.verification.status,
  }, status === VerificationStatus.VERIFIED ? 'Worker verified successfully' : 'Worker verification rejected'));
});

// PATCH /internal/workers/:id/block — admin block/unblock
router.patch('/:id/block', async (req, res) => {
  const { isBlocked, blockedReason } = req.body;
  const worker = await WorkerModel.findByIdAndUpdate(
    req.params.id,
    { isBlocked, blockedReason, isOnline: isBlocked ? false : undefined },
    { new: true },
  );
  if (!worker) { res.status(404).json(failure('Worker not found')); return; }
  res.json(success({ id: worker._id, isBlocked: worker.isBlocked }, isBlocked ? 'Worker blocked' : 'Worker unblocked'));
});

// PATCH /internal/workers/:id/wallet — credit or debit wallet (amount can be negative for deduction)
router.patch('/:id/wallet', async (req, res) => {
  const { amount } = req.body; // positive = credit, negative = debit

  const worker = await WorkerModel.findById(req.params.id);
  if (!worker) { res.status(404).json(failure('Worker not found')); return; }

  worker.wallet.balance    = Math.max(0, worker.wallet.balance + amount);
  if (amount > 0) worker.wallet.totalEarned = (worker.wallet.totalEarned || 0) + amount;
  worker.cancellationCount = amount < 0 ? worker.cancellationCount + 1 : worker.cancellationCount;

  await worker.save();
  res.json(success({ balance: worker.wallet.balance }, 'Wallet updated'));
});

export default router;
