import { Request, Response }  from 'express';
import { WorkerModel }        from '../models/worker.model';
import { uploadToS3 }         from '../utils/s3';
import { encrypt, createLogger, addOnlineWorker, removeOnlineWorker, setRedisGeoClient } from '@serveease/shared/utils';
import { success, failure, getPaginationParams } from '@serveease/shared/utils';
import { VerificationStatus }   from '@serveease/shared/types';

const log = createLogger('worker-service');

// ─── GET /workers/me ─────────────────────────────────────────────────────────
export const getMyProfile = async (req: Request, res: Response): Promise<void> => {
  const phone = (req as any).user.phone as string;
  const ctx = { fn: 'getMyProfile', tag: 'workerService_getMyProfile', userId: phone, role: 'worker', action: 'GET_WORKER_PROFILE' };
  log.enter(ctx);

  try {
    let worker = await WorkerModel.findOne({ phone });
    log.db(ctx, 'WorkerModel.findOne', { found: !!worker, verificationStatus: (worker as any)?.verification?.status });

    if (!worker) {
      log.warn(ctx, 'Worker profile not found — registration incomplete');
      res.status(404).json(failure('Worker profile not found. Please complete registration.'));
      return;
    }

    const profile = worker.toObject();
    delete (profile.verification as any).aadhaarNumber;
    delete (profile.verification as any).bankAccount;

    // Include non-sensitive verification info so worker can see status and reason
    (profile as any).verification = {
      status: (worker.verification as any)?.status,
      submittedAt: (worker.verification as any)?.submittedAt,
      verifiedAt: (worker.verification as any)?.verifiedAt,
      verifiedBy: (worker.verification as any)?.verifiedBy,
      rejectionReason: (worker.verification as any)?.rejectionReason,
      aadhaarFrontPhoto: (worker.verification as any)?.aadhaarFrontPhoto,
      aadhaarBackPhoto: (worker.verification as any)?.aadhaarBackPhoto,
      selfiePhoto: (worker.verification as any)?.selfiePhoto,
    };

    log.info(ctx, 'Worker profile fetched (sensitive fields stripped)');
    res.json(success(profile));
  } catch (err) {
    log.error({ ...ctx, tag: 'workerService_getMyProfile_failed' }, 'getMyProfile handler failed', err);
    res.status(500).json(failure('Internal server error'));
  }
};

// ─── POST /workers/register ──────────────────────────────────────────────────
export const registerWorker = async (req: Request, res: Response): Promise<void> => {
  const phone = (req as any).user.phone as string;
  const {
    fullName, serviceCategory, serviceSubTypes, bio, experience, skills, pricing,
    languages, serviceArea, availability,
    location,  // { lat, lng } from mobile GPS
  } = req.body;
  const ctx = { fn: 'registerWorker', tag: 'workerService_registerWorker', userId: phone, role: 'worker', action: 'REGISTER_WORKER' };
  log.enter(ctx, { serviceCategory, serviceSubTypes });

  try {
    const exists = await WorkerModel.findOne({ phone });
    log.db(ctx, 'WorkerModel.findOne (check existing)', { exists: !!exists });

    if (exists) {
      log.warn(ctx, 'Worker already registered, duplicate registration attempt');
      res.status(409).json(failure('Worker already registered. Use update endpoints.'));
      return;
    }

    const geoLocation = location?.lat != null && location?.lng != null
      ? { type: 'Point' as const, coordinates: [location.lng, location.lat] as [number, number] }
      : undefined;

    const worker = await WorkerModel.create({
      phone, fullName, serviceCategory, serviceSubTypes, bio, experience, skills, pricing,
      languages, serviceArea, availability,
      ...(geoLocation && { location: geoLocation }),
    });
    log.db(ctx, 'WorkerModel.create', { workerId: worker._id, serviceCategory });

    log.info(ctx, 'Worker registration started successfully');
    res.status(201).json(success(worker, 'Registration started. Please submit verification documents.'));
  } catch (err) {
    log.error({ ...ctx, tag: 'workerService_registerWorker_failed' }, 'registerWorker handler failed', err);
    res.status(500).json(failure('Internal server error'));
  }
};

// ─── PUT /workers/me ─────────────────────────────────────────────────────────
export const updateProfile = async (req: Request, res: Response): Promise<void> => {
  const phone = (req as any).user.phone as string;
  const { fullName, bio, experience, skills, serviceSubTypes, serviceCategory, pricing, languages, availability, serviceArea, fcmToken } = req.body;
  const ctx = { fn: 'updateProfile', tag: 'workerService_updateProfile', userId: phone, role: 'worker', action: 'UPDATE_WORKER_PROFILE' };
  log.enter(ctx);

  try {
    const update: Record<string, unknown> = { fullName, bio, experience, skills, serviceSubTypes, pricing, fcmToken };
    if (serviceCategory !== undefined) update.serviceCategory = serviceCategory;
    if (languages      !== undefined) update.languages        = languages;
    if (availability   !== undefined) update.availability     = availability;
    if (serviceArea    !== undefined) update.serviceArea      = serviceArea;

    const worker = await WorkerModel.findOneAndUpdate(
      { phone },
      update,
      { new: true },
    );
    log.db(ctx, 'WorkerModel.findOneAndUpdate', { found: !!worker });

    if (!worker) {
      log.warn(ctx, 'Worker profile not found for update — registration incomplete');
      res.status(404).json(failure('Worker profile not found. Please complete registration first.'));
      return;
    }

    log.info(ctx, 'Worker profile updated successfully');
    res.json(success(worker, 'Profile updated'));
  } catch (err) {
    log.error({ ...ctx, tag: 'workerService_updateProfile_failed' }, 'updateProfile handler failed', err);
    res.status(500).json(failure('Internal server error'));
  }
};

// ─── POST /workers/me/verify — upload Aadhaar + bank docs ───────────────────
export const submitVerification = async (req: Request, res: Response): Promise<void> => {
  const phone  = (req as any).user.phone as string;
  const files  = req.files as { [key: string]: Express.Multer.File[] };
  const { aadhaarNumber, panNumber, accountNumber, ifscCode, accountHolder, upiId } = req.body;
  const ctx = { fn: 'submitVerification', tag: 'workerService_submitVerification', userId: phone, role: 'worker', action: 'SUBMIT_VERIFICATION' };
  log.enter(ctx, { fileFields: Object.keys(files || {}) });

  try {
    const worker = await WorkerModel.findOne({ phone });
    log.db(ctx, 'WorkerModel.findOne', { found: !!worker });

    if (!worker) {
      log.warn(ctx, 'Worker profile not found for verification submission');
      res.status(404).json(failure('Register first before submitting documents'));
      return;
    }

    const uploads: Record<string, string> = {};
    for (const [field, fileArr] of Object.entries(files)) {
      const file = fileArr[0];
      try {
        uploads[field] = await uploadToS3(file.buffer, file.mimetype, `verification/${phone}`);
        log.info(ctx, 'File uploaded to S3', { field, contentType: file.mimetype });
      } catch (err) {
        log.error({ ...ctx, tag: 'workerService_submitVerification_s3Failed' }, `S3 upload failed for field: ${field}`, err);
        res.status(500).json(failure(`Failed to upload ${field}. Please try again.`));
        return;
      }
    }

    worker.verification.aadhaarNumber     = encrypt(aadhaarNumber);
    worker.verification.aadhaarFrontPhoto = uploads['aadhaarFront'] || worker.verification.aadhaarFrontPhoto;
    worker.verification.aadhaarBackPhoto  = uploads['aadhaarBack']  || worker.verification.aadhaarBackPhoto;
    worker.verification.selfiePhoto       = uploads['selfie']       || worker.verification.selfiePhoto;
    if (panNumber) worker.verification.panNumber = panNumber;
    worker.verification.bankAccount.accountNumber = encrypt(accountNumber);
    worker.verification.bankAccount.ifscCode      = ifscCode;
    worker.verification.bankAccount.accountHolder = accountHolder;
    if (upiId) worker.verification.bankAccount.upiId = upiId;
    worker.verification.status      = VerificationStatus.PENDING;
    worker.verification.submittedAt = new Date();
    worker.verification.verifiedAt  = undefined as any;
    worker.verification.verifiedBy  = undefined as any;
    worker.verification.rejectionReason = undefined as any;

    await worker.save();
    log.db(ctx, 'WorkerModel.save (verification docs saved, status=PENDING)', { submittedAt: worker.verification.submittedAt });

    log.info(ctx, 'Verification documents submitted successfully');
    res.json(success(null, 'Verification documents submitted. Admin will review within 24-48 hours.'));
  } catch (err) {
    log.error({ ...ctx, tag: 'workerService_submitVerification_failed' }, 'submitVerification handler failed', err);
    res.status(500).json(failure('Internal server error'));
  }
};

// ─── PUT /workers/me/location ─────────────────────────────────────────────────
export const updateLocation = async (req: Request, res: Response): Promise<void> => {
  const phone = (req as any).user.phone as string;
  const { longitude, latitude } = req.body;
  const ctx = { fn: 'updateLocation', tag: 'workerService_updateLocation', userId: phone, role: 'worker', action: 'UPDATE_WORKER_LOCATION' };
  log.enter(ctx, { longitude, latitude });

  try {
    await WorkerModel.findOneAndUpdate(
      { phone },
      { location: { type: 'Point', coordinates: [longitude, latitude] } },
    );
    log.db(ctx, 'WorkerModel.findOneAndUpdate (location)', { longitude, latitude });

    const worker = await WorkerModel.findOne({ phone });
    if (worker?.isOnline) {
      await addOnlineWorker(worker._id.toString(), latitude, longitude);
      log.info(ctx, 'Worker GEO position updated in Redis', { workerId: worker._id, latitude, longitude });
    }

    log.info(ctx, 'Worker location updated');
    res.json(success(null, 'Location updated'));
  } catch (err) {
    log.error({ ...ctx, tag: 'workerService_updateLocation_failed' }, 'updateLocation handler failed', err);
    res.status(500).json(failure('Internal server error'));
  }
};

// ─── PUT /workers/me/status ───────────────────────────────────────────────────
export const toggleOnline = async (req: Request, res: Response): Promise<void> => {
  const phone        = (req as any).user.phone as string;
  const { isOnline } = req.body;
  const ctx = { fn: 'toggleOnline', tag: 'workerService_toggleOnline', userId: phone, role: 'worker', action: 'TOGGLE_ONLINE' };
  log.enter(ctx, { isOnline });

  try {
    const worker = await WorkerModel.findOne({ phone });
    log.db(ctx, 'WorkerModel.findOne', { found: !!worker, verificationStatus: (worker as any)?.verification?.status });

    if (!worker) {
      log.warn(ctx, 'Worker not found on toggleOnline');
      res.status(404).json(failure('Worker not found'));
      return;
    }

    if (worker.verification.status !== VerificationStatus.VERIFIED) {
      log.warn(ctx, 'Worker tried to go online but is not verified', { verificationStatus: worker.verification.status });
      res.status(403).json(failure('Cannot go online until your account is verified by admin'));
      return;
    }

    worker.isOnline = isOnline;
    await worker.save();
    log.db(ctx, 'WorkerModel.save (isOnline toggled)', { isOnline: worker.isOnline });

    const coords = (worker.location as any)?.coordinates || [0, 0];
    const lng = coords[0];
    const lat = coords[1];
    if (isOnline) {
      await addOnlineWorker(worker._id.toString(), lat, lng);
      log.info(ctx, 'Worker added to Redis GEO online set', { workerId: worker._id, lat, lng });
    } else {
      await removeOnlineWorker(worker._id.toString());
      log.info(ctx, 'Worker removed from Redis GEO online set', { workerId: worker._id });
    }

    log.info(ctx, isOnline ? 'Worker went online' : 'Worker went offline', { isOnline: worker.isOnline });
    res.json(success({ isOnline: worker.isOnline }, isOnline ? 'You are now online' : 'You are now offline'));
  } catch (err) {
    log.error({ ...ctx, tag: 'workerService_toggleOnline_failed' }, 'toggleOnline handler failed', err);
    res.status(500).json(failure('Internal server error'));
  }
};

// ─── GET /workers — browse workers by category ───────────────────────────────
export const getWorkersByCategory = async (req: Request, res: Response): Promise<void> => {
  const { category, subType, lat, lng, maxDistanceKm = '15', minRating = '0' } = req.query as Record<string, string>;
  const { page, limit, skip } = getPaginationParams(req.query as any);
  const ctx = { fn: 'getWorkersByCategory', tag: 'workerService_getWorkersByCategory', action: 'GET_WORKERS_BY_CATEGORY' };
  log.enter(ctx, { category, subType, lat, lng, maxDistanceKm, minRating, page, limit });

  try {
    const filter: Record<string, unknown> = {
      serviceCategory:           category,
      'verification.status':     VerificationStatus.VERIFIED,
      isOnline:                  true,
      isAvailable:               true,
      isBlocked:                 false,
      'ratings.average':         { $gte: parseFloat(minRating) },
    };

    if (subType) filter['serviceSubTypes'] = subType;

    if (lat && lng) {
      const radiusRadians = (parseFloat(maxDistanceKm) * 1000) / 6378137;
      (filter as any).location = {
        $geoWithin: { $centerSphere: [[parseFloat(lng), parseFloat(lat)], radiusRadians] },
      };
    }

    const projection = {
      'verification.aadhaarNumber': 0,
      'verification.bankAccount':   0,
      'verification.panNumber':     0,
    };

    const [workers, total] = await Promise.all([
      WorkerModel.find(filter, projection).skip(skip).limit(limit).sort({ 'ratings.average': -1 }),
      WorkerModel.countDocuments(filter),
    ]);
    log.db(ctx, 'WorkerModel.find + countDocuments', { total, returned: workers.length, category, page, limit });

    res.json({
      ...success(workers, 'Workers fetched'),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    log.error({ ...ctx, tag: 'workerService_getWorkersByCategory_failed' }, 'getWorkersByCategory handler failed', err);
    res.status(500).json(failure('Internal server error'));
  }
};
 
// ─── GET /workers/:id ─────────────────────────────────────────────────────────
export const getWorkerById = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const ctx = { fn: 'getWorkerById', tag: 'workerService_getWorkerById', action: 'GET_WORKER_BY_ID' };
  log.enter(ctx, { workerId: id });

  try {
    const worker = await WorkerModel.findById(id, {
      'verification.aadhaarNumber': 0,
      'verification.bankAccount':   0,
      'verification.panNumber':     0,
    });
    log.db(ctx, 'WorkerModel.findById', { found: !!worker });

    if (!worker) {
      log.warn(ctx, 'Worker not found by id', { workerId: id });
      res.status(404).json(failure('Worker not found'));
      return;
    }

    log.info(ctx, 'Worker fetched by id');
    res.json(success(worker));
  } catch (err) {
    log.error({ ...ctx, tag: 'workerService_getWorkerById_failed' }, 'getWorkerById handler failed', err);
    res.status(500).json(failure('Internal server error'));
  }
};

// ─── Internal: GET /internal/workers/:id ─────────────────────────────────────
export const getWorkerByIdInternal = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const ctx = { fn: 'getWorkerByIdInternal', tag: 'workerService_getWorkerByIdInternal', action: 'GET_WORKER_BY_ID_INTERNAL' };
  log.enter(ctx, { workerId: id });

  try {
    const worker = await WorkerModel.findById(id);
    log.db(ctx, 'WorkerModel.findById (internal, full fields)', { found: !!worker });

    if (!worker) {
      log.warn(ctx, 'Worker not found by id (internal call)', { workerId: id });
      res.status(404).json(failure('Worker not found'));
      return;
    }

    log.info(ctx, 'Worker fetched (internal call)');
    res.json(success(worker));
  } catch (err) {
    log.error({ ...ctx, tag: 'workerService_getWorkerByIdInternal_failed' }, 'getWorkerByIdInternal handler failed', err);
    res.status(500).json(failure('Internal server error'));
  }
};
