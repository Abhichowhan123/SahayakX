import { Router }       from 'express';
import { BookingModel } from '../models/booking.model';
import { BookingStatus, PaymentStatus } from '@serveease/shared/types';
import { success, failure, getPaginationParams, createLogger } from '@serveease/shared/utils';

const router = Router();
const log    = createLogger('booking-service');

// GET /internal/bookings — all bookings (admin, with filters)
router.get('/', async (req, res) => {
  const ctx = { fn: 'internalGetBookings', tag: 'bookingService_internalGetBookings', action: 'INTERNAL_GET_BOOKINGS' };
  try {
    const { page, limit, skip } = getPaginationParams(req.query as any);
    const { status, customerId, workerId } = req.query as Record<string, string>;

    const filter: Record<string, unknown> = {};
    if (status)     filter.status     = status;
    if (customerId) filter.customerId = customerId;
    if (workerId)   filter.workerId   = workerId;

    const [bookings, total] = await Promise.all([
      BookingModel.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 }),
      BookingModel.countDocuments(filter),
    ]);

    res.json({
      ...success(bookings, 'Bookings fetched'),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    log.error({ ...ctx, tag: 'bookingService_internalGetBookings_failed' }, 'Internal GET bookings failed', err);
    res.status(500).json(failure('Internal server error'));
  }
});

// GET /internal/bookings/stats — aggregate stats for admin dashboard
router.get('/stats', async (_req, res) => {
  const ctx = { fn: 'internalBookingStats', tag: 'bookingService_internalBookingStats', action: 'INTERNAL_BOOKING_STATS' };
  try {
    const now   = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [total, todayCount, completed, disputed, totalRevenue] = await Promise.all([
      BookingModel.countDocuments(),
      BookingModel.countDocuments({ createdAt: { $gte: today } }),
      BookingModel.countDocuments({ status: BookingStatus.COMPLETED }),
      BookingModel.countDocuments({ status: BookingStatus.DISPUTED }),
      BookingModel.aggregate([
        { $match: { status: BookingStatus.COMPLETED } },
        { $group: { _id: null, total: { $sum: '$pricing.totalAmount' } } },
      ]),
    ]);

    log.info(ctx, 'Booking stats fetched', { total, todayCount, completed, disputed });
    res.json(success({
      total, todayCount, completed, disputed,
      totalRevenue: totalRevenue[0]?.total ?? 0,
    }, 'Booking stats'));
  } catch (err) {
    log.error({ ...ctx, tag: 'bookingService_internalBookingStats_failed' }, 'Internal booking stats failed', err);
    res.status(500).json(failure('Internal server error'));
  }
});

// GET /internal/bookings/disputed — list all disputed bookings
router.get('/disputed', async (req, res) => {
  const ctx = { fn: 'internalGetDisputed', tag: 'bookingService_internalGetDisputed', action: 'INTERNAL_GET_DISPUTED' };
  try {
    const { page, limit, skip } = getPaginationParams(req.query as any);

    const [bookings, total] = await Promise.all([
      BookingModel.find({ status: BookingStatus.DISPUTED }).skip(skip).limit(limit).sort({ updatedAt: -1 }),
      BookingModel.countDocuments({ status: BookingStatus.DISPUTED }),
    ]);

    res.json({
      ...success(bookings, 'Disputed bookings'),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    log.error({ ...ctx, tag: 'bookingService_internalGetDisputed_failed' }, 'Internal GET disputed failed', err);
    res.status(500).json(failure('Internal server error'));
  }
});

// POST /internal/bookings/:bookingId/resolve — admin resolves a dispute
router.post('/:bookingId/resolve', async (req, res) => {
  const { bookingId } = req.params;
  const ctx = { fn: 'internalResolveDispute', tag: 'bookingService_internalResolveDispute', action: 'INTERNAL_RESOLVE_DISPUTE' };
  try {
    const { resolution, refundCustomer, payWorker } = req.body;

    const booking = await BookingModel.findOne({ bookingId });
    if (!booking) { res.status(404).json(failure('Booking not found')); return; }

    if (booking.status !== BookingStatus.DISPUTED) {
      res.status(400).json(failure('Booking is not in disputed state'));
      return;
    }

    const newStatus = BookingStatus.COMPLETED;
    booking.status  = newStatus;

    if (resolution === 'refund_customer') {
      booking.payment.status = PaymentStatus.REFUNDED;
    } else if (resolution === 'pay_worker') {
      booking.payment.status = PaymentStatus.RELEASED;
    }

    await booking.save();
    log.info(ctx, 'Dispute resolved', { bookingId, resolution });
    res.json(success({ bookingId, resolution, newStatus, refundCustomer: refundCustomer ?? false, payWorker: payWorker ?? false }, 'Dispute resolved'));
  } catch (err) {
    log.error({ ...ctx, tag: 'bookingService_internalResolveDispute_failed' }, 'Internal resolve dispute failed', err);
    res.status(500).json(failure('Internal server error'));
  }
});

// POST /internal/bookings/:bookingId/dispute — mark booking as disputed
router.post('/:bookingId/dispute', async (req, res) => {
  const { bookingId } = req.params;
  const ctx = { fn: 'internalMarkDispute', tag: 'bookingService_internalMarkDispute', action: 'INTERNAL_MARK_DISPUTE' };
  try {
    const { reason } = req.body;

    const booking = await BookingModel.findOneAndUpdate(
      { bookingId, status: { $in: [BookingStatus.IN_PROGRESS, BookingStatus.COMPLETED] } },
      { status: BookingStatus.DISPUTED, 'payment.status': PaymentStatus.HELD_IN_ESCROW },
      { new: true },
    );
    if (!booking) { res.status(404).json(failure('Booking not found or not eligible for dispute')); return; }

    log.info(ctx, 'Booking marked as disputed', { bookingId, reason });
    res.json(success({ bookingId, status: booking.status }, 'Booking marked as disputed'));
  } catch (err) {
    log.error({ ...ctx, tag: 'bookingService_internalMarkDispute_failed' }, 'Internal mark dispute failed', err);
    res.status(500).json(failure('Internal server error'));
  }
});

export default router;
