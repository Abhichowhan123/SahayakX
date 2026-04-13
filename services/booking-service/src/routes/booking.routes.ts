import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import {
  createBooking, acceptBooking, workerEnRoute, startWork,
  completeWork, cancelBooking, getMyBookings, getBookingById,
} from '../controllers/booking.controller';

const router = Router();

router.use(authenticate);

// Customer actions
router.post('/',                        requireRole('customer'),          createBooking);
router.post('/:bookingId/start',        requireRole('customer'),          startWork);

// Worker actions
router.put('/:bookingId/accept',        requireRole('worker'),            acceptBooking);
router.put('/:bookingId/en-route',      requireRole('worker'),            workerEnRoute);
router.put('/:bookingId/complete',      requireRole('worker'),            completeWork);

// Both customer & worker
router.post('/:bookingId/cancel',       requireRole('customer', 'worker'), cancelBooking);

// Shared read
router.get('/',                         requireRole('customer', 'worker'), getMyBookings);
router.get('/:bookingId',               requireRole('customer', 'worker', 'admin'), getBookingById);

export default router;
