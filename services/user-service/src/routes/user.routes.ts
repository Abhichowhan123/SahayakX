import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import {
  getProfile, updateProfile, updateLocation,
  addAddress, deleteAddress, saveWorker, unsaveWorker,
  getWallet,
} from '../controllers/user.controller';

const router = Router();

router.use(authenticate);

router.get('/',                          requireRole('customer'), getProfile);
router.put('/',                          requireRole('customer'), updateProfile);
router.put('/location',                  requireRole('customer'), updateLocation);
router.post('/addresses',                requireRole('customer'), addAddress);
router.delete('/addresses/:id',          requireRole('customer'), deleteAddress);
router.post('/save-worker/:workerId',    requireRole('customer'), saveWorker);
router.delete('/save-worker/:workerId',  requireRole('customer'), unsaveWorker);
router.get('/wallet',                    requireRole('customer'), getWallet);

export { router as userRouter };
