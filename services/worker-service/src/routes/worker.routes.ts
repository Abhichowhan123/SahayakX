import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { upload } from '../utils/s3';
import {
  getMyProfile, registerWorker, updateProfile,
  submitVerification, updateLocation, toggleOnline,
  getWorkersByCategory, getWorkerById,
} from '../controllers/worker.controller';

const router = Router();

// Public routes
router.get('/',    getWorkersByCategory);
router.get('/:id', getWorkerById);

// Authenticated worker routes
router.post('/register',    authenticate, requireRole('worker'), registerWorker);
router.get('/me',           authenticate, requireRole('worker'), getMyProfile);
router.put('/me',           authenticate, requireRole('worker'), updateProfile);
router.put('/me/location',  authenticate, requireRole('worker'), updateLocation);
router.put('/me/status',    authenticate, requireRole('worker'), toggleOnline);
router.post('/me/verify',
  authenticate,
  requireRole('worker'),
  upload.fields([
    { name: 'aadhaarFront', maxCount: 1 },
    { name: 'aadhaarBack',  maxCount: 1 },
    { name: 'selfie',       maxCount: 1 },
  ]),
  submitVerification,
);

export { router as workerRouter };
