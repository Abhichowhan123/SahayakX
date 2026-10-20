import { Router }      from 'express';
import { WorkerModel } from '../models/worker.model';
import { VerificationStatus } from '@serveease/shared/types';
import { success, failure, createLogger } from '@serveease/shared/utils';

const router = Router();
const log    = createLogger('worker-service');

// GET /internal/workers — list workers for the admin panel
router.get('/', async (req, res) => {
  const ctx = { fn: 'internalListWorkers', tag: 'workerService_internalListWorkers', action: 'INTERNAL_LIST_WORKERS' };
  try {
    const page = parseInt((req.query.page as string) || '1', 10);
    const limit = parseInt((req.query.limit as string) || '50', 10);
    const skip = (page - 1) * limit;
    const { search, category, verificationStatus, isOnline, isBlocked } = req.query as any;
    const filter: any = {};
    if (search) {
      const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ phone: rx }, { fullName: rx }];
    }
    if (category) filter.serviceCategory = category;
    if (verificationStatus) filter['verification.status'] = verificationStatus;
    if (isOnline !== undefined) filter.isOnline = isOnline === 'true';
    if (isBlocked !== undefined) filter.isBlocked = isBlocked === 'true';
    const [workers, total] = await Promise.all([
      WorkerModel.find(filter)
        .select('-verification.aadhaarNumber -verification.bankAccount -verification.panNumber')
        .skip(skip).limit(limit).sort({ createdAt: -1 }),
      WorkerModel.countDocuments(filter),
    ]);
    log.db(ctx, 'WorkerModel.find + countDocuments (list)', { total, returned: workers.length, page, limit });
    res.json({
      ...success(workers, 'Workers fetched'),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    log.error({ ...ctx, tag: 'workerService_internalListWorkers_failed' }, 'Internal list workers failed', err);
    res.status(500).json(failure('Internal server error'));
  }
});

// DELETE /internal/workers/:id — permanently remove a worker account
router.delete('/:id', async (req, res) => {
  const ctx = { fn: 'internalDeleteWorker', tag: 'workerService_internalDeleteWorker', action: 'INTERNAL_DELETE_WORKER' };
  try {
    const { id } = req.params;
    const worker = await WorkerModel.findByIdAndDelete(id);
    if (!worker) {
      res.status(404).json(failure('Worker not found'));
      return;
    }
    log.info(ctx, 'Worker deleted', { workerId: id });
    res.json(success({ id, deleted: true }, 'Worker deleted'));
  } catch (err) {
    log.error({ ...ctx, tag: 'workerService_internalDeleteWorker_failed' }, 'Internal delete worker failed', err);
    res.status(500).json(failure('Internal server error'));
  }
});

// PUT /internal/workers/:id — update worker details
router.put('/:id', async (req, res) => {
  const ctx = { fn: 'internalUpdateWorker', tag: 'workerService_internalUpdateWorker', action: 'INTERNAL_UPDATE_WORKER' };
  try {
    const allowed = ['fullName', 'phone', 'email', 'serviceCategory', 'serviceArea', 'isOnline', 'isBlocked', 'blockedReason', 'fcmToken', 'location'];
    const updates: any = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (req.body.verification) {
      if (req.body.verification.status !== undefined) updates['verification.status'] = req.body.verification.status;
      if (req.body.verification.aadhaarNumber !== undefined) updates['verification.aadhaarNumber'] = req.body.verification.aadhaarNumber;
    }
    if (req.body.ratings) {
      if (req.body.ratings.average !== undefined) updates['ratings.average'] = req.body.ratings.average;
      if (req.body.ratings.totalReviews !== undefined) updates['ratings.totalReviews'] = req.body.ratings.totalReviews;
    }
    
    const worker = await WorkerModel.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!worker) { res.status(404).json(failure('Worker not found')); return; }
    log.info(ctx, 'Worker updated', { workerId: req.params.id });
    res.json(success(worker));
  } catch (err) {
    log.error({ ...ctx, tag: 'workerService_internalUpdateWorker_failed' }, 'Internal update worker failed', err);
    res.status(500).json(failure('Internal server error'));
  }
});

// GET /internal/workers/stats
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

// GET /internal/workers/pending
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
          createdAt: 1,
        },
      ).skip(skip).limit(limit).sort({ 'verification.submittedAt': 1 }),
      WorkerModel.countDocuments({ 'verification.status': VerificationStatus.PENDING }),
    ]);

    res.json({
      ...success(workers, 'Pending verification workers'),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    log.error({ ...ctx, tag: 'workerService_internalGetPendingWorkers_failed' }, 'Internal GET pending workers failed', err);
    res.status(500).json(failure('Internal server error'));
  }
});

// GET /internal/workers/:id
router.get('/:id', async (req, res) => {
  const ctx = { fn: 'internalGetWorker', tag: 'workerService_internalGetWorker', action: 'INTERNAL_GET_WORKER' };
  try {
    const worker = await WorkerModel.findById(req.params.id);
    if (!worker) { res.status(404).json(failure('Worker not found')); return; }
    res.json(success(worker));
  } catch (err) {
    log.error({ ...ctx, tag: 'workerService_internalGetWorker_failed' }, 'Internal GET worker failed', err);
    res.status(500).json(failure('Internal server error'));
  }
});

// PATCH /internal/workers/:id/rating
router.patch('/:id/rating', async (req, res) => {
  const ctx = { fn: 'internalUpdateRating', tag: 'workerService_internalUpdateRating', action: 'INTERNAL_UPDATE_RATING' };
  try {
    const { average, totalReviews } = req.body;
    const worker = await WorkerModel.findByIdAndUpdate(
      req.params.id,
      { ratings: { average, totalReviews } },
      { new: true },
    );
    if (!worker) { res.status(404).json(failure('Worker not found')); return; }
    res.json(success({ ratings: worker.ratings }, 'Rating updated'));
  } catch (err) {
    log.error({ ...ctx, tag: 'workerService_internalUpdateRating_failed' }, 'Internal update rating failed', err);
    res.status(500).json(failure('Internal server error'));
  }
});

// PATCH /internal/workers/:id/verification
router.patch('/:id/verification', async (req, res) => {
  const ctx = { fn: 'internalUpdateVerification', tag: 'workerService_internalUpdateVerification', action: 'INTERNAL_UPDATE_VERIFICATION' };
  try {
    const { status, verifiedBy, rejectionReason } = req.body;
    const update: Record<string, unknown> = { 'verification.status': status };
    if (status === VerificationStatus.VERIFIED) {
      update['verification.verifiedAt'] = new Date();
      update['verification.verifiedBy'] = verifiedBy;
    }
    if (status === VerificationStatus.REJECTED && rejectionReason) {
      update['verification.rejectionReason'] = rejectionReason;
    }
    const worker = await WorkerModel.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!worker) { res.status(404).json(failure('Worker not found')); return; }
    res.json(success({ id: worker._id, status: worker.verification.status }, status === VerificationStatus.VERIFIED ? 'Worker verified successfully' : 'Worker verification rejected'));
  } catch (err) {
    log.error({ ...ctx, tag: 'workerService_internalUpdateVerification_failed' }, 'Internal update verification failed', err);
    res.status(500).json(failure('Internal server error'));
  }
});

// PATCH /internal/workers/:id/block
router.patch('/:id/block', async (req, res) => {
  const ctx = { fn: 'internalBlockWorker', tag: 'workerService_internalBlockWorker', action: 'INTERNAL_BLOCK_WORKER' };
  try {
    const { isBlocked, blockedReason } = req.body;
    const worker = await WorkerModel.findByIdAndUpdate(
      req.params.id,
      { isBlocked, blockedReason, isOnline: isBlocked ? false : undefined },
      { new: true },
    );
    if (!worker) { res.status(404).json(failure('Worker not found')); return; }
    res.json(success({ id: worker._id, isBlocked: worker.isBlocked }, isBlocked ? 'Worker blocked' : 'Worker unblocked'));
  } catch (err) {
    log.error({ ...ctx, tag: 'workerService_internalBlockWorker_failed' }, 'Internal block worker failed', err);
    res.status(500).json(failure('Internal server error'));
  }
});

// PATCH /internal/workers/:id/wallet
router.patch('/:id/wallet', async (req, res) => {
  const ctx = { fn: 'internalWalletUpdate', tag: 'workerService_internalWalletUpdate', action: 'INTERNAL_WALLET_UPDATE' };
  try {
    const { amount } = req.body;
    const worker = await WorkerModel.findById(req.params.id);
    if (!worker) { res.status(404).json(failure('Worker not found')); return; }

    worker.wallet.balance = Math.max(0, worker.wallet.balance + amount);
    if (amount > 0) worker.wallet.totalEarned = (worker.wallet.totalEarned || 0) + amount;
    worker.cancellationCount = amount < 0 ? worker.cancellationCount + 1 : worker.cancellationCount;

    await worker.save();
    res.json(success({ balance: worker.wallet.balance }, 'Wallet updated'));
  } catch (err) {
    log.error({ ...ctx, tag: 'workerService_internalWalletUpdate_failed' }, 'Internal wallet update failed', err);
    res.status(500).json(failure('Internal server error'));
  }
});

export default router;
