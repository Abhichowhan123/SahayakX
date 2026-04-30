import { Request, Response }  from 'express';
import { WorkerModel }        from '../models/worker.model';
import { uploadToS3 }         from '../utils/s3';
import { encrypt }            from '@serveease/shared/utils';
import { success, failure, getPaginationParams } from '@serveease/shared/utils';
import { ServiceCategory, VerificationStatus }   from '@serveease/shared/types';

// ─── GET /workers/me ─────────────────────────────────────────────────────────
export const getMyProfile = async (req: Request, res: Response): Promise<void> => {
  const phone  = (req as any).user.phone as string;
  let worker   = await WorkerModel.findOne({ phone });
  if (!worker) {
    res.status(404).json(failure('Worker profile not found. Please complete registration.'));
    return;
  }
  // Never expose encrypted sensitive fields
  const profile = worker.toObject();
  delete (profile.verification as any).aadhaarNumber;
  delete (profile.verification as any).bankAccount;
  res.json(success(profile));
};

// ─── POST /workers/register ──────────────────────────────────────────────────
export const registerWorker = async (req: Request, res: Response): Promise<void> => {
  const phone = (req as any).user.phone as string;
  const { fullName, serviceCategory, serviceSubTypes, bio, experience, skills, pricing } = req.body;

  const exists = await WorkerModel.findOne({ phone });
  if (exists) {
    res.status(409).json(failure('Worker already registered. Use update endpoints.'));
    return;
  }

  const worker = await WorkerModel.create({
    phone, fullName, serviceCategory, serviceSubTypes, bio, experience, skills, pricing,
  });

  res.status(201).json(success(worker, 'Registration started. Please submit verification documents.'));
};

// ─── PUT /workers/me ─────────────────────────────────────────────────────────
export const updateProfile = async (req: Request, res: Response): Promise<void> => {
  const phone = (req as any).user.phone as string;
  const { fullName, bio, experience, skills, serviceSubTypes, pricing, fcmToken } = req.body;

  const worker = await WorkerModel.findOneAndUpdate(
    { phone },
    { fullName, bio, experience, skills, serviceSubTypes, pricing, fcmToken },
    { new: true },
  );

  res.json(success(worker, 'Profile updated'));
};

// ─── POST /workers/me/verify — upload Aadhaar + bank docs ───────────────────
export const submitVerification = async (req: Request, res: Response): Promise<void> => {
  const phone  = (req as any).user.phone as string;
  const files  = req.files as { [key: string]: Express.Multer.File[] };
  const { aadhaarNumber, panNumber, accountNumber, ifscCode, accountHolder, upiId } = req.body;

  const worker = await WorkerModel.findOne({ phone });
  if (!worker) {
    res.status(404).json(failure('Register first before submitting documents'));
    return;
  }

  // Upload files to S3
  const uploads: Record<string, string> = {};
  for (const [field, fileArr] of Object.entries(files)) {
    const file = fileArr[0];
    uploads[field] = await uploadToS3(file.buffer, file.mimetype, `verification/${phone}`);
  }

  // Encrypt sensitive data
  worker.verification.aadhaarNumber     = encrypt(aadhaarNumber);
  worker.verification.aadhaarFrontPhoto = uploads['aadhaarFront'] || worker.verification.aadhaarFrontPhoto;
  worker.verification.aadhaarBackPhoto  = uploads['aadhaarBack']  || worker.verification.aadhaarBackPhoto;
  worker.verification.selfiePhoto       = uploads['selfie']       || worker.verification.selfiePhoto;
  if (panNumber)       worker.verification.panNumber              = panNumber;
  worker.verification.bankAccount.accountNumber = encrypt(accountNumber);
  worker.verification.bankAccount.ifscCode      = ifscCode;
  worker.verification.bankAccount.accountHolder = accountHolder;
  if (upiId) worker.verification.bankAccount.upiId = upiId;
  worker.verification.status      = VerificationStatus.PENDING;
  worker.verification.submittedAt = new Date();

  await worker.save();

  res.json(success(null, 'Verification documents submitted. Admin will review within 24-48 hours.'));
};

// ─── PUT /workers/me/location ─────────────────────────────────────────────────
export const updateLocation = async (req: Request, res: Response): Promise<void> => {
  const phone = (req as any).user.phone as string;
  const { longitude, latitude } = req.body;

  await WorkerModel.findOneAndUpdate(
    { phone },
    { location: { type: 'Point', coordinates: [longitude, latitude] } },
  );
  res.json(success(null, 'Location updated'));
};

// ─── PUT /workers/me/status ───────────────────────────────────────────────────
export const toggleOnline = async (req: Request, res: Response): Promise<void> => {
  const phone     = (req as any).user.phone as string;
  const { isOnline } = req.body;

  const worker = await WorkerModel.findOne({ phone });
  if (!worker) { res.status(404).json(failure('Worker not found')); return; }

  if (worker.verification.status !== VerificationStatus.VERIFIED) {
    res.status(403).json(failure('Cannot go online until your account is verified by admin'));
    return;
  }

  worker.isOnline = isOnline;
  await worker.save();

  res.json(success({ isOnline: worker.isOnline }, isOnline ? 'You are now online' : 'You are now offline'));
};

// ─── GET /workers — browse workers by category ───────────────────────────────
export const getWorkersByCategory = async (req: Request, res: Response): Promise<void> => {
  const { category, subType, lat, lng, maxDistanceKm = '15', minRating = '0' } = req.query as Record<string, string>;
  const { page, limit, skip } = getPaginationParams(req.query as any);

  const filter: Record<string, unknown> = {
    serviceCategory:           category,
    'verification.status':     VerificationStatus.VERIFIED,
    isOnline:                  true,
    isAvailable:               true,
    isBlocked:                 false,
    'ratings.average':         { $gte: parseFloat(minRating) },
  };

  if (subType)         filter['serviceSubTypes'] = subType;

  // Geo-based if coordinates provided — use $geoWithin so skip/pagination works
  if (lat && lng) {
    const radiusRadians = (parseFloat(maxDistanceKm) * 1000) / 6378137; // metres → radians
    (filter as any).location = {
      $geoWithin: {
        $centerSphere: [[parseFloat(lng), parseFloat(lat)], radiusRadians],
      },
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

  res.json({
    ...success(workers, 'Workers fetched'),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
};

// ─── GET /workers/:id ─────────────────────────────────────────────────────────
export const getWorkerById = async (req: Request, res: Response): Promise<void> => {
  const worker = await WorkerModel.findById(req.params.id, {
    'verification.aadhaarNumber': 0,
    'verification.bankAccount':   0,
    'verification.panNumber':     0,
  });
  if (!worker) { res.status(404).json(failure('Worker not found')); return; }
  res.json(success(worker));
};

// ─── Internal: GET /internal/workers/:id ─────────────────────────────────────
export const getWorkerByIdInternal = async (req: Request, res: Response): Promise<void> => {
  const worker = await WorkerModel.findById(req.params.id);
  if (!worker) { res.status(404).json(failure('Worker not found')); return; }
  res.json(success(worker));
};
