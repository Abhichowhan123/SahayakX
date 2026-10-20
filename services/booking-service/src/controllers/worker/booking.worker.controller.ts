import { Request, Response } from 'express';
import { BookingModel } from '../../models/booking.model';
import { publishEvent, QueueName } from '@serveease/shared/events';
import { BookingStatus, PaymentStatus } from '@serveease/shared/types';
import { success, failure, getPaginationParams, createLogger } from '@serveease/shared/utils';
import axios from 'axios';
import { createClient } from 'redis';
import { emitBookingStatus } from '../../utils/socket';

const log = createLogger('booking-service');

const PAYMENT_SERVICE_URL = process.env.PAYMENT_SERVICE_URL || 'http://payment-service:3006';

let lockClient: ReturnType<typeof createClient> | null = null;
export const setBookingLockClient = (client: ReturnType<typeof createClient>): void => {
  lockClient = client;
};

const requireLockClient = (): ReturnType<typeof createClient> => {
  if (!lockClient) throw new Error('Redis lock client not initialized in booking-service');
  return lockClient;
};

export const acceptBooking = async (req: Request, res: Response): Promise<void> => {
  const workerId = (req as any).user.phone as string;
  const { bookingId } = req.params;
  const ctx = { fn: 'acceptBooking', tag: 'bookingService_acceptBooking', userId: workerId, role: 'worker', action: 'ACCEPT_BOOKING' };
  log.enter(ctx, { bookingId });

  try {
    const lockKey = `booking:${bookingId}:lock`;
    const lockResult = await requireLockClient().set(lockKey, workerId, { NX: true, EX: 60 });
    if (!lockResult) {
      log.warn(ctx, 'Booking already accepted by another worker', { bookingId, workerId });
      res.status(409).json(failure('Booking already taken by another worker'));
      return;
    }

    const booking = await BookingModel.findOne({ bookingId, status: BookingStatus.SEARCHING });
    log.db(ctx, 'BookingModel.findOne', { found: !!booking, status: booking?.status });

    if (!booking) {
      await requireLockClient().del(lockKey);
      log.warn(ctx, 'Booking not found or already in non-searching state', { bookingId, workerId });
      res.status(404).json(failure('Booking not found or already accepted'));
      return;
    }

    booking.status = BookingStatus.ACCEPTED;
    booking.workerId = workerId;
    await booking.save();
    log.db(ctx, 'BookingModel.save (status=ACCEPTED)', { bookingId });

    try {
      await requireLockClient().zRem('workers:online', workerId);
      log.info(ctx, 'Worker marked BUSY — removed from GEO online set', { workerId });
    } catch (geoErr) {
      log.warn(ctx, 'Failed to remove worker from GEO on accept', { workerId, error: geoErr instanceof Error ? geoErr.message : String(geoErr) });
    }

    publishEvent(QueueName.BOOKING_STATUS_CHANGED, {
      bookingId, oldStatus: BookingStatus.SEARCHING, newStatus: BookingStatus.ACCEPTED,
      customerId: booking.customerId, workerId,
    });
    emitBookingStatus(req, { bookingId, oldStatus: BookingStatus.SEARCHING, newStatus: BookingStatus.ACCEPTED });
    log.info(ctx, 'Booking accepted, event published', { bookingId, customerId: booking.customerId });

    try {
      await axios.post(`${PAYMENT_SERVICE_URL}/payments/hold`, {
        bookingId, amount: booking.pricing.totalAmount, customerId: booking.customerId,
      });
      log.info(ctx, 'Payment hold (escrow) triggered', { bookingId, amount: booking.pricing.totalAmount });
    } catch (err) {
      log.error(ctx, 'Failed to hold payment in escrow', err);
    }

    res.json(success({ bookingId, otp: booking.otp.code }, 'Booking accepted! Head to customer location. Share OTP with customer to start work.'));
  } catch (err) {
    log.error({ ...ctx, tag: 'bookingService_acceptBooking_failed' }, 'acceptBooking handler failed', err);
    res.status(500).json(failure('Internal server error'));
  }
};

export const workerEnRoute = async (req: Request, res: Response): Promise<void> => {
  const workerId = (req as any).user.phone as string;
  const { bookingId } = req.params;
  const ctx = { fn: 'workerEnRoute', tag: 'bookingService_workerEnRoute', userId: workerId, role: 'worker', action: 'WORKER_EN_ROUTE' };
  log.enter(ctx, { bookingId });

  try {
    const booking = await BookingModel.findOne({ bookingId, workerId, status: BookingStatus.ACCEPTED });
    log.db(ctx, 'BookingModel.findOne', { found: !!booking });

    if (!booking) {
      log.warn(ctx, 'Booking not found or not in ACCEPTED state', { bookingId });
      res.status(404).json(failure('Booking not found or not in accepted state'));
      return;
    }

    booking.status = BookingStatus.WORKER_EN_ROUTE;
    await booking.save();
    log.db(ctx, 'BookingModel.save (status=WORKER_EN_ROUTE)', { bookingId });

    publishEvent(QueueName.BOOKING_STATUS_CHANGED, {
      bookingId, oldStatus: BookingStatus.ACCEPTED, newStatus: BookingStatus.WORKER_EN_ROUTE,
      customerId: booking.customerId, workerId,
    });
    emitBookingStatus(req, { bookingId, oldStatus: BookingStatus.ACCEPTED, newStatus: BookingStatus.WORKER_EN_ROUTE });
    log.info(ctx, 'Worker en-route, customer notified', { bookingId, customerId: booking.customerId });

    res.json(success(null, 'Customer notified that you are on the way'));
  } catch (err) {
    log.error({ ...ctx, tag: 'bookingService_workerEnRoute_failed' }, 'workerEnRoute handler failed', err);
    res.status(500).json(failure('Internal server error'));
  }
};

export const workerArrived = async (req: Request, res: Response): Promise<void> => {
  const workerId = (req as any).user.phone as string;
  const { bookingId } = req.params;
  const ctx = { fn: 'workerArrived', tag: 'bookingService_workerArrived', userId: workerId, role: 'worker', action: 'WORKER_ARRIVED' };
  log.enter(ctx, { bookingId });
  try {
    const booking = await BookingModel.findOne({ bookingId, workerId, status: BookingStatus.WORKER_EN_ROUTE });
    if (!booking) {
      res.status(404).json(failure('Booking not found or not en-route'));
      return;
    }
    booking.status = BookingStatus.ARRIVED;
    await booking.save();
    publishEvent(QueueName.BOOKING_STATUS_CHANGED, {
      bookingId, oldStatus: BookingStatus.WORKER_EN_ROUTE,
      newStatus: BookingStatus.ARRIVED,
      customerId: booking.customerId,
      workerId,
    });
    emitBookingStatus(req, { bookingId, oldStatus: BookingStatus.WORKER_EN_ROUTE, newStatus: BookingStatus.ARRIVED });
    res.json(success(null, 'Marked arrived'));
  } catch (err) {
    log.error({ ...ctx, tag: 'bookingService_workerArrived_failed' }, 'workerArrived failed', err);
    res.status(500).json(failure('Internal server error'));
  }
};

export const completeWork = async (req: Request, res: Response): Promise<void> => {
  const workerId = (req as any).user.phone as string;
  const { bookingId } = req.params;
  const ctx = { fn: 'completeWork', tag: 'bookingService_completeWork', userId: workerId, role: 'worker', action: 'COMPLETE_WORK' };
  log.enter(ctx, { bookingId });

  try {
    const booking = await BookingModel.findOne({ bookingId, workerId, status: BookingStatus.IN_PROGRESS });
    log.db(ctx, 'BookingModel.findOne', { found: !!booking });

    if (!booking) {
      log.warn(ctx, 'Booking not found or not IN_PROGRESS', { bookingId });
      res.status(404).json(failure('Booking not found'));
      return;
    }

    booking.status = BookingStatus.COMPLETED;
    booking.schedule.completedAt = new Date();
    await booking.save();
    log.db(ctx, 'BookingModel.save (status=COMPLETED)', { bookingId, completedAt: booking.schedule.completedAt });

    publishEvent(QueueName.BOOKING_STATUS_CHANGED, {
      bookingId, oldStatus: BookingStatus.IN_PROGRESS, newStatus: BookingStatus.COMPLETED,
      customerId: booking.customerId, workerId,
    });
    emitBookingStatus(req, { bookingId, oldStatus: BookingStatus.IN_PROGRESS, newStatus: BookingStatus.COMPLETED });
    publishEvent(QueueName.PAYMENT_PROCESSED, {
      bookingId, transactionId: '',
      amount: booking.pricing.finalAgreedPrice,
      status: PaymentStatus.RELEASED,
      workerId, customerId: booking.customerId,
    });
    log.info(ctx, 'Job completed, payment release event published', {
      bookingId, finalAgreedPrice: booking.pricing.finalAgreedPrice, customerId: booking.customerId,
    });

    res.json(success(null, 'Job marked complete. Payment will be released to your wallet.'));
  } catch (err) {
    log.error({ ...ctx, tag: 'bookingService_completeWork_failed' }, 'completeWork handler failed', err);
    res.status(500).json(failure('Internal server error'));
  }
};

export const rejectBooking = async (req: Request, res: Response): Promise<void> => {
  const workerId = (req as any).user.phone as string;
  const { bookingId } = req.params;
  const ctx = { fn: 'rejectBooking', tag: 'bookingService_rejectBooking', userId: workerId, role: 'worker', action: 'REJECT_BOOKING' };
  log.enter(ctx, { bookingId });
  try {
    const booking = await BookingModel.findOne({ bookingId, status: BookingStatus.SEARCHING });
    if (!booking) {
      res.status(404).json(failure('Booking not found or already accepted'));
      return;
    }
    booking.status = BookingStatus.REJECTED;
    await booking.save();
    publishEvent(QueueName.BOOKING_STATUS_CHANGED, {
      bookingId, oldStatus: BookingStatus.SEARCHING,
      newStatus: BookingStatus.REJECTED,
      customerId: booking.customerId,
    });
    emitBookingStatus(req, { bookingId, oldStatus: BookingStatus.SEARCHING, newStatus: BookingStatus.REJECTED });
    res.json(success(null, 'Booking rejected'));
  } catch (err) {
    log.error({ ...ctx, tag: 'bookingService_rejectBooking_failed' }, 'rejectBooking failed', err);
    res.status(500).json(failure('Internal server error'));
  }
};

export const getMyBookings = async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  const { page, limit, skip } = getPaginationParams(req.query as any);
  const { status } = req.query;
  const ctx = { fn: 'getMyBookings', tag: 'bookingService_getMyBookings', userId: user.phone, role: user.role, action: 'GET_MY_BOOKINGS' };
  log.enter(ctx, { page, limit, status });

  try {
    const filter: Record<string, unknown> = { workerId: user.phone };
    if (status) filter.status = status;

    const [bookings, total] = await Promise.all([
      BookingModel.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 }),
      BookingModel.countDocuments(filter),
    ]);
    log.db(ctx, 'BookingModel.find + countDocuments', { total, returned: bookings.length, page, limit });

    res.json({
      ...success(bookings, 'Bookings fetched'),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    log.error({ ...ctx, tag: 'getMyBookings_failed' }, 'getMyBookings handler failed', err);
    res.status(500).json(failure('Internal server error'));
  }
};

export const getAvailableBookings = async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  const { page, limit, skip } = getPaginationParams(req.query as any);
  const { category } = req.query;
  const ctx = { fn: 'getAvailableBookings', tag: 'bookingService_getAvailableBookings', userId: user.phone, role: user.role, action: 'GET_AVAILABLE_BOOKINGS' };
  log.enter(ctx, { page, limit, category });

  if (user.role !== 'worker') {
    res.status(403).json(failure('Only workers can view available booking requests'));
    return;
  }

  try {
    const filter: Record<string, unknown> = {
      status: BookingStatus.SEARCHING,
      workerId: '',
    };
    if (category) filter.serviceCategory = category;

    const [bookings, total] = await Promise.all([
      BookingModel.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 }),
      BookingModel.countDocuments(filter),
    ]);
    log.db(ctx, 'BookingModel.find + countDocuments (available)', { total, returned: bookings.length, page, limit, category });

    res.json({
      ...success(bookings, 'Available booking requests fetched'),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    log.error({ ...ctx, tag: 'getAvailableBookings_failed' }, 'getAvailableBookings handler failed', err);
    res.status(500).json(failure('Internal server error'));
  }
};
