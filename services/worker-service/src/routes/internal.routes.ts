import { Router }      from 'express';
import { WorkerModel } from '../models/worker.model';
import { VerificationStatus } from '@serveease/shared/types';
import { success, failure, createLogger } from '@serveease/shared/utils';

const router = Router();
const log    = createLogger('worker-service');

// GET /internal/workers/stats — aggregate stats for admin dashboard
router.get('/stats', async (_req, res) => {
  const ctx = { fn: 'internalWorkerStats', tag: 'workerService_internalWorkerStats', action: 'INTERNAL_WORKER_STATS' };
  try {
    const [total, verified, pending, online] = await Promise.all([
      WorkerModel.countDocuments(),
      WorkerModel.countDocuments({ 'verification.status': VerificationStatus.VERIFIED }),
      WorkerModel.countDocuments({ 'verification.status': VerificationStatus.PENDING }),
      WorkerModel.countDocuments({ isOnline: true }),
    ]);
    log.info(ctx, 'Worker stats fetched', { total, verified, pending, online });
    res.json(success({ total, verified, pending, online }, 'Worker stats'));
  } catch (err) {
    log.error({ ...ctx, tag: 'workerService_internalWorkerStats_failed' }, 'Internal worker stats failed', err);
    res.status(500).json(failure('Internal server error'));
  }
});

// GET /internal/workers/pending — list pending verification workers
router.get('/pending', async (req, res) => {
  const ctx = { fn: 'internalGetPendingWorkers', tag: 'workerService_internalGetPendingWorkers', action: 'INTERNAL_GET_PENDING_WORKERS' };
  try {
    const page  = parseInt((req.query.page  as string) || '1',  10);
    const limit = parseInt((req.query.limit as string) || '20', 10);
    const skip  = (page - 1) * limit;

    const [workers, total] = await Promise.all([
      WorkerModel.find(
        { 'verification.status': VerificationStatus.PENDING },
        {
          fullName: 1,
          phone: 1,
          serviceCategory: 1,
          serviceArea: 1,
          'verification.aadhaarNumber': 1,
          'verification.aadhaarFrontPhoto': 1,
          'verification.aadhaarBackPhoto':  1,
          'verification.selfiePhoto':       1,
          'verification.submittedAt':       1,
          'verification.verifiedBy':        1,
          'verification.verifiedAt':        1,
          'verification.rejectionReason':   1,
          createdAt: 1,
        },
      ).skip(skip).limit(limit).sort({ 'verification.submittedAt': 1 }),
      WorkerModel.countDocuments({ 'verification.status': VerificationStatus.PENDING }),
    ]);
    log.db(ctx, 'WorkerModel.find (pending)', { total, returned: workers.length, page, limit });

    res.json({
      ...success(workers, 'Pending verification workers'),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    log.error({ ...ctx, tag: 'workerService_internalGetPendingWorkers_failed' }, 'Internal GET pending workers failed', err);
    res.status(500).json(failure('Internal server error'));
  }
});

// GET /internal/workers/:id — full worker record (for other services)
router.get('/:id', async (req, res) => {
  const ctx = { fn: 'internalGetWorker', tag: 'workerService_internalGetWorker', action: 'INTERNAL_GET_WORKER' };
  try {
    const worker = await WorkerModel.findById(req.params.id);
    log.db(ctx, 'WorkerModel.findById', { found: !!worker, workerId: req.params.id });
    if (!worker) { res.status(404).json(failure('Worker not found')); return; }
    res.json(success(worker));
  } catch (err) {
    log.error({ ...ctx, tag: 'workerService_internalGetWorker_failed' }, 'Internal GET worker failed', err);
    res.status(500).json(failure('Internal server error'));
  }
});

// PATCH /internal/workers/:id/rating — update average rating after a review
router.patch('/:id/rating', async (req, res) => {
  const ctx = { fn: 'internalUpdateRating', tag: 'workerService_internalUpdateRating', action: 'INTERNAL_UPDATE_RATING' };
  try {
    const { average, totalReviews } = req.body;
    const worker = await WorkerModel.findByIdAndUpdate(
      req.params.id,
      { ratings: { average, totalReviews } },
      { new: true },
    );
    log.db(ctx, 'WorkerModel.findByIdAndUpdate (rating)', { found: !!worker, workerId: req.params.id, average, totalReviews });
    if (!worker) { res.status(404).json(failure('Worker not found')); return; }
    log.info(ctx, 'Worker rating updated', { workerId: req.params.id, average, totalReviews });
    res.json(success({ ratings: worker.ratings }, 'Rating updated'));
  } catch (err) {
    log.error({ ...ctx, tag: 'workerService_internalUpdateRating_failed' }, 'Internal update rating failed', err);
    res.status(500).json(failure('Internal server error'));
  }
});

// PATCH /internal/workers/:id/verification — admin approve or reject
router.patch('/:id/verification', async (req, res) => {
  const ctx = { fn: 'internalUpdateVerification', tag: 'workerService_internalUpdateVerification', action: 'INTERNAL_UPDATE_VERIFICATION' };
  try {
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
    log.db(ctx, 'WorkerModel.findByIdAndUpdate (verification)', { found: !!worker, workerId: req.params.id, status });
    if (!worker) { res.status(404).json(failure('Worker not found')); return; }

    log.info(ctx, status === VerificationStatus.VERIFIED ? 'Worker verified' : 'Worker verification rejected', { workerId: req.params.id, status });
    res.json(success({
      id:     worker._id,
      status: worker.verification.status,
    }, status === VerificationStatus.VERIFIED ? 'Worker verified successfully' : 'Worker verification rejected'));
  } catch (err) {
    log.error({ ...ctx, tag: 'workerService_internalUpdateVerification_failed' }, 'Internal update verification failed', err);
    res.status(500).json(failure('Internal server error'));
  }
});

// PATCH /internal/workers/:id/block — admin block/unblock
router.patch('/:id/block', async (req, res) => {
  const ctx = { fn: 'internalBlockWorker', tag: 'workerService_internalBlockWorker', action: 'INTERNAL_BLOCK_WORKER' };
  try {
    const { isBlocked, blockedReason } = req.body;
    const worker = await WorkerModel.findByIdAndUpdate(
      req.params.id,
      { isBlocked, blockedReason, isOnline: isBlocked ? false : undefined },
      { new: true },
    );
    log.db(ctx, 'WorkerModel.findByIdAndUpdate (block)', { found: !!worker, workerId: req.params.id, isBlocked });
    if (!worker) { res.status(404).json(failure('Worker not found')); return; }
    log.info(ctx, isBlocked ? 'Worker blocked' : 'Worker unblocked', { workerId: req.params.id, isBlocked });
    res.json(success({ id: worker._id, isBlocked: worker.isBlocked }, isBlocked ? 'Worker blocked' : 'Worker unblocked'));
  } catch (err) {
    log.error({ ...ctx, tag: 'workerService_internalBlockWorker_failed' }, 'Internal block worker failed', err);
    res.status(500).json(failure('Internal server error'));
  }
});

// PATCH /internal/workers/:id/wallet — credit or debit wallet (amount can be negative for deduction)
router.patch('/:id/wallet', async (req, res) => {
  const ctx = { fn: 'internalWalletUpdate', tag: 'workerService_internalWalletUpdate', action: 'INTERNAL_WALLET_UPDATE' };
  try {
    const { amount } = req.body; // positive = credit, negative = debit

    const worker = await WorkerModel.findById(req.params.id);
    log.db(ctx, 'WorkerModel.findById (wallet)', { found: !!worker, workerId: req.params.id });
    if (!worker) { res.status(404).json(failure('Worker not found')); return; }

    worker.wallet.balance    = Math.max(0, worker.wallet.balance + amount);
    if (amount > 0) worker.wallet.totalEarned = (worker.wallet.totalEarned || 0) + amount;
    worker.cancellationCount = amount < 0 ? worker.cancellationCount + 1 : worker.cancellationCount;

    await worker.save();
    log.db(ctx, 'WorkerModel.save (wallet)', { workerId: req.params.id, amount, newBalance: worker.wallet.balance });
    log.info(ctx, 'Worker wallet updated', { workerId: req.params.id, amount, newBalance: worker.wallet.balance });
    res.json(success({ balance: worker.wallet.balance }, 'Wallet updated'));
  } catch (err) {
    log.error({ ...ctx, tag: 'workerService_internalWalletUpdate_failed' }, 'Internal wallet update failed', err);
    res.status(500).json(failure('Internal server error'));
  }
});

export default router;
