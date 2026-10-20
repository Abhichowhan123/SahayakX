import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import {
  createBooking,
  startWork,
  getMyBookings as getCustomerBookings,
} from '../controllers/customer/booking.customer.controller';
import {
  acceptBooking,
  rejectBooking,
  workerEnRoute,
  workerArrived,
  completeWork,
  getMyBookings as getWorkerBookings,
  getAvailableBookings,
} from '../controllers/worker/booking.worker.controller';
import {
  cancelBooking,
  getBookingById,
  getBookingMessages,
  sosBooking,
} from '../controllers/shared/booking.shared.controller';

const router = Router();

router.use(authenticate);

// Customer actions
router.post('/', requireRole('customer'), createBooking);
// Customer or worker can start work (OTP verification)
router.post('/:bookingId/start', requireRole('customer', 'worker'), startWork);


// Worker actions
router.put('/:bookingId/accept', requireRole('worker'), acceptBooking);
router.put('/:bookingId/reject', requireRole('worker'), rejectBooking);
router.put('/:bookingId/en-route', requireRole('worker'), workerEnRoute);
router.put('/:bookingId/arrived', requireRole('worker'), workerArrived);
router.put('/:bookingId/complete', requireRole('worker'), completeWork);

// Both customer & worker
router.post('/:bookingId/cancel', requireRole('customer', 'worker'), cancelBooking);
router.get('/:bookingId/messages', requireRole('customer', 'worker', 'admin'), getBookingMessages);
router.post('/:bookingId/sos', requireRole('customer', 'worker'), sosBooking);

// Shared read
router.get('/', (req, res) => {
  const role = (req as any).user?.role;
  if (role === 'worker') {
    return getWorkerBookings(req, res);
  }
  return getCustomerBookings(req, res);
});


router.get('/available', requireRole('worker'), getAvailableBookings);
router.get('/:bookingId', requireRole('customer', 'worker', 'admin'), getBookingById);

export default router;
