import { Request, Response }  from 'express';
import { BookingModel }        from '../models/booking.model';
import { publishEvent, QueueName } from '@serveease/shared/events';
import {
  generateBookingId, generateOTP, calculatePenalty,
  success, failure, getPaginationParams, createLogger,
  findNearbyWorkers,
} from '@serveease/shared/utils';
import {
  BookingStatus, PaymentStatus,
  CANCELLATION_RULES, PLATFORM_CONFIG,
} from '@serveease/shared/types';
import axios from 'axios';
import { createClient } from 'redis';

const log = createLogger('booking-service');

const WORKER_SERVICE_URL  = process.env.WORKER_SERVICE_URL  || 'http://worker-service:3003';
const PAYMENT_SERVICE_URL = process.env.PAYMENT_SERVICE_URL || 'http://payment-service:3006';

let lockClient: ReturnType<typeof createClient> | null = null;
export const setBookingLockClient = (client: ReturnType<typeof createClient>): void => {
  lockClient = client;
};

const requireLockClient = (): ReturnType<typeof createClient> => {
  if (!lockClient) throw new Error('Redis lock client not initialized in booking-service');
  return lockClient;
};

// ─── POST /bookings — Create booking request ──────────────────────────────────
export const createBooking = async (req: Request, res: Response): Promise<void> => {
  const customerId = (req as any).user.phone as string;
  const {
    serviceCategory, serviceSubType,
    requestedDate, requestedTimeSlot, estimatedDuration,
    customerAddress, paymentMethod, customerOfferedPrice,
    location,  // { lat, lng }
  } = req.body;
  const ctx = { fn: 'createBooking', tag: 'bookingService_createBooking', userId: customerId, role: 'customer', action: 'CREATE_BOOKING' };
  log.enter(ctx, { serviceCategory, serviceSubType, estimatedDuration });

  try {
    const otp       = generateOTP(4);
    const bookingId = generateBookingId();

    const workerQuotedPrice = 0;
    const finalAgreedPrice  = customerOfferedPrice || workerQuotedPrice;
    const platformFee       = Math.round(finalAgreedPrice * PLATFORM_CONFIG.commissionPercent * 100) / 100;
    const tax               = Math.round(finalAgreedPrice * PLATFORM_CONFIG.taxPercent * 100) / 100;
    const totalAmount       = finalAgreedPrice + platformFee + tax;

    const geoLocation = location?.lat != null && location?.lng != null
      ? { type: 'Point' as const, coordinates: [location.lng, location.lat] as [number, number] }
      : undefined;

    await BookingModel.create({
      bookingId, customerId, workerId: '', serviceCategory, serviceSubType,
      status: BookingStatus.SEARCHING, dispatchedTo: [],
      pricing: { workerQuotedPrice, customerOfferedPrice, finalAgreedPrice, platformFee, tax, totalAmount, currency: 'INR' },
      schedule: { requestedDate, requestedTimeSlot, estimatedDuration, expiresAt: new Date(Date.now() + CANCELLATION_RULES.workerAcceptanceTimeoutSeconds * 1000) },
      location: { customerAddress, ...(geoLocation && { geo: geoLocation }) },
      otp:     { code: otp, verified: false },
      payment: { method: paymentMethod, status: PaymentStatus.PENDING },
    });
    log.db(ctx, 'BookingModel.create', { bookingId, totalAmount, status: BookingStatus.SEARCHING });

    // NOTE: BOOKING_CREATED event no longer sends a worker SMS here because no
    // worker is assigned at creation time (workerPhone would be empty). Workers
    // are notified via the BOOKING_DISPATCHED event in dispatchWave instead.
    log.info(ctx, 'Booking created; worker notified via BOOKING_DISPATCHED event', { bookingId, totalAmount });

    // Dispatch to nearby workers in waves
    await dispatchWave(bookingId, location);

    // Auto-expire if no worker accepts in time
    setTimeout(async () => {
      try {
        const b = await BookingModel.findOne({ bookingId });
        if (b && b.status === BookingStatus.SEARCHING) {
          b.status = BookingStatus.EXPIRED;
          await b.save();
          log.info({ fn: 'createBooking:autoExpire', tag: 'bookingService_autoExpire', action: 'AUTO_EXPIRE' }, 'Booking auto-expired', { bookingId });
          publishEvent(QueueName.BOOKING_STATUS_CHANGED, {
            bookingId, oldStatus: BookingStatus.SEARCHING, newStatus: BookingStatus.EXPIRED,
            customerId, workerId: '',
          });
        }
      } catch (err) {
        log.error({ fn: 'createBooking:autoExpire', tag: 'bookingService_autoExpire_failed', action: 'AUTO_EXPIRE' }, 'Auto-expire failed', err);
      }
    }, CANCELLATION_RULES.workerAcceptanceTimeoutSeconds * 1000);

    res.status(201).json(success({ bookingId, totalAmount, otp: '****' }, 'Booking request sent. Waiting for nearby workers to accept.'));
  } catch (err) {
    log.error({ ...ctx, tag: 'bookingService_createBooking_failed' }, 'createBooking handler failed', err);
    res.status(500).json(failure('Internal server error'));
  }
};

// ─── Dispatch booking to nearby workers (wave-based) ──────────────────────────
export const dispatchWave = async (bookingId: string, location?: { lat: number; lng: number }): Promise<void> => {
  const ctx = { fn: 'dispatchWave', tag: 'bookingService_dispatchWave', action: 'DISPATCH_WAVE' };
  log.enter(ctx, { bookingId, location });

  try {
    const booking = await BookingModel.findOne({ bookingId });
    if (!booking) {
      log.warn(ctx, 'Booking not found for dispatch', { bookingId });
      return;
    }

    const lat = location?.lat || 28.6139;
    const lng = location?.lng || 77.2090;
    const radiusKm = 5;
    const waveSize = 8;

    const nearbyWorkerIds = await findNearbyWorkers(lat, lng, radiusKm, waveSize);
    log.info(ctx, 'Nearby workers found via Redis GEO', { bookingId, count: nearbyWorkerIds.length, workerIds: nearbyWorkerIds });

    if (nearbyWorkerIds.length === 0) {
      const booking = await BookingModel.findOne({ bookingId });
      if (booking && booking.status === BookingStatus.SEARCHING) {
        booking.status = BookingStatus.EXPIRED;
        await booking.save();
        publishEvent(QueueName.BOOKING_STATUS_CHANGED, {
          bookingId, oldStatus: BookingStatus.SEARCHING, newStatus: BookingStatus.EXPIRED,
          customerId: booking.customerId, workerId: '',
        });
      }
      log.warn(ctx, 'No nearby workers available, booking expired', { bookingId });
      return;
    }

    publishEvent(QueueName.BOOKING_DISPATCHED, {
      bookingId, customerId: booking.customerId, workerIds: nearbyWorkerIds,
      customerPhone: booking.customerId, serviceCategory: booking.serviceCategory,
      lat, lng, radiusKm,
    });

    // Persist the dispatched worker IDs so workers can discover this request
    // even if the push/SMS notification doesn't reach them.
    booking.dispatchedTo = nearbyWorkerIds;
    await booking.save();
    log.db(ctx, 'BookingModel.save (dispatchedTo persisted)', { bookingId, dispatchedTo: nearbyWorkerIds });

    log.info(ctx, 'BOOKING_DISPATCHED event published', { bookingId, workerCount: nearbyWorkerIds.length, workerIds: nearbyWorkerIds });
  } catch (err) {
    log.error({ ...ctx, tag: 'bookingService_dispatchWave_failed' }, 'dispatchWave failed', err);
  }
};

// ─── PUT /bookings/:bookingId/accept — Worker accepts ────────────────────────
export const acceptBooking = async (req: Request, res: Response): Promise<void> => {
  const workerId      = (req as any).user.phone as string;
  const { bookingId } = req.params;
  const ctx = { fn: 'acceptBooking', tag: 'bookingService_acceptBooking', userId: workerId, role: 'worker', action: 'ACCEPT_BOOKING' };
  log.enter(ctx, { bookingId });

  try {
    // Atomic lock: first worker to set the key wins the booking
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
      // Release lock since booking is gone
      await requireLockClient().del(lockKey);
      log.warn(ctx, 'Booking not found or already in non-searching state', { bookingId, workerId });
      res.status(404).json(failure('Booking not found or already accepted'));
      return;
    }

    booking.status = BookingStatus.ACCEPTED;
    booking.workerId = workerId;
    await booking.save();
    log.db(ctx, 'BookingModel.save (status=ACCEPTED)', { bookingId });

    // Mark worker BUSY — remove from Redis GEO so they are not dispatched again
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

// ─── PUT /bookings/:bookingId/en-route ────────────────────────────────────────
export const workerEnRoute = async (req: Request, res: Response): Promise<void> => {
  const workerId      = (req as any).user.phone as string;
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
    log.info(ctx, 'Worker en-route, customer notified', { bookingId, customerId: booking.customerId });

    res.json(success(null, 'Customer notified that you are on the way'));
  } catch (err) {
    log.error({ ...ctx, tag: 'bookingService_workerEnRoute_failed' }, 'workerEnRoute handler failed', err);
    res.status(500).json(failure('Internal server error'));
  }
};

// ─── POST /bookings/:bookingId/start — Customer enters OTP to start ──────────
export const startWork = async (req: Request, res: Response): Promise<void> => {
  const customerId    = (req as any).user.phone as string;
  const { bookingId } = req.params;
  const { otp }       = req.body;
  const ctx = { fn: 'startWork', tag: 'bookingService_startWork', userId: customerId, role: 'customer', action: 'START_WORK' };
  log.enter(ctx, { bookingId });

  try {
    const booking = await BookingModel.findOne({ bookingId, customerId });
    log.db(ctx, 'BookingModel.findOne', { found: !!booking, status: booking?.status });

    if (!booking) {
      log.warn(ctx, 'Booking not found', { bookingId });
      res.status(404).json(failure('Booking not found'));
      return;
    }
    if (booking.status !== BookingStatus.WORKER_EN_ROUTE && booking.status !== BookingStatus.ACCEPTED) {
      log.warn(ctx, 'Cannot start work in current status', { bookingId, status: booking.status });
      res.status(400).json(failure(`Cannot start. Status is ${booking.status}`));
      return;
    }
    if (booking.otp.code !== otp) {
      log.warn(ctx, 'Incorrect OTP provided to start work', { bookingId });
      res.status(400).json(failure('Incorrect OTP'));
      return;
    }

    const oldStatus            = booking.status;
    booking.otp.verified       = true;
    booking.status             = BookingStatus.IN_PROGRESS;
    booking.schedule.startedAt = new Date();
    await booking.save();
    log.db(ctx, 'BookingModel.save (status=IN_PROGRESS, otp.verified=true)', { bookingId });

    publishEvent(QueueName.BOOKING_STATUS_CHANGED, {
      bookingId, oldStatus, newStatus: BookingStatus.IN_PROGRESS,
      customerId, workerId: booking.workerId,
    });
    log.info(ctx, 'Work started, OTP verified', { bookingId, workerId: booking.workerId });

    res.json(success(null, 'Work started! Timer is running.'));
  } catch (err) {
    log.error({ ...ctx, tag: 'bookingService_startWork_failed' }, 'startWork handler failed', err);
    res.status(500).json(failure('Internal server error'));
  }
};

// ─── PUT /bookings/:bookingId/complete — Worker marks job done ───────────────
export const completeWork = async (req: Request, res: Response): Promise<void> => {
  const workerId      = (req as any).user.phone as string;
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

    booking.status               = BookingStatus.COMPLETED;
    booking.schedule.completedAt = new Date();
    await booking.save();
    log.db(ctx, 'BookingModel.save (status=COMPLETED)', { bookingId, completedAt: booking.schedule.completedAt });

    publishEvent(QueueName.BOOKING_STATUS_CHANGED, {
      bookingId, oldStatus: BookingStatus.IN_PROGRESS, newStatus: BookingStatus.COMPLETED,
      customerId: booking.customerId, workerId,
    });
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

// ─── POST /bookings/:bookingId/cancel — Cancel with penalty logic ─────────────
export const cancelBooking = async (req: Request, res: Response): Promise<void> => {
  const user          = (req as any).user;
  const { bookingId } = req.params;
  const { reason }    = req.body;
  const ctx = { fn: 'cancelBooking', tag: 'bookingService_cancelBooking', userId: user.phone, role: user.role, action: 'CANCEL_BOOKING' };
  log.enter(ctx, { bookingId, reason });

  try {
    const booking = await BookingModel.findOne({ bookingId });
    log.db(ctx, 'BookingModel.findOne', { found: !!booking, status: booking?.status });

    if (!booking) {
      log.warn(ctx, 'Booking not found for cancellation', { bookingId });
      res.status(404).json(failure('Booking not found'));
      return;
    }

    const cancelledBy: 'customer' | 'worker' =
      user.phone === booking.customerId ? 'customer' : 'worker';

    const terminalStatuses = [
      BookingStatus.COMPLETED, BookingStatus.CANCELLED_BY_CUSTOMER,
      BookingStatus.CANCELLED_BY_WORKER, BookingStatus.EXPIRED,
    ];
    if (terminalStatuses.includes(booking.status)) {
      log.warn(ctx, 'Cancellation rejected — booking already in terminal state', { bookingId, status: booking.status });
      res.status(400).json(failure('Booking is already in a final state'));
      return;
    }

    const oldStatus  = booking.status;
    const now        = new Date();
    const bookingAge = (now.getTime() - booking.createdAt.getTime()) / 60000;
    const freeWindow = cancelledBy === 'worker'
      ? CANCELLATION_RULES.workerFreeWindowMinutes
      : CANCELLATION_RULES.customerFreeWindowMinutes;

    let penaltyAmount = 0;
    if (booking.status !== BookingStatus.SEARCHING && bookingAge > freeWindow) {
      penaltyAmount = calculatePenalty(booking.pricing.totalAmount, CANCELLATION_RULES.penaltyPercent);
    }
    log.info(ctx, 'Cancellation penalty calculated', { cancelledBy, bookingAge, freeWindow, penaltyAmount });

    booking.status = cancelledBy === 'customer'
      ? BookingStatus.CANCELLED_BY_CUSTOMER
      : BookingStatus.CANCELLED_BY_WORKER;
    booking.cancellation = { cancelledBy, reason, cancelledAt: now, penaltyAmount, penaltyPaid: false };
    await booking.save();
    log.db(ctx, 'BookingModel.save (cancelled)', { bookingId, newStatus: booking.status, penaltyAmount });

    if (penaltyAmount > 0) {
      publishEvent(QueueName.PENALTY_CHARGED, { bookingId, cancelledBy, userId: user.phone, penaltyAmount });
      log.info(ctx, 'PENALTY_CHARGED event published', { bookingId, penaltyAmount, cancelledBy });
    }

    publishEvent(QueueName.BOOKING_STATUS_CHANGED, {
      bookingId, oldStatus, newStatus: booking.status,
      customerId: booking.customerId, workerId: booking.workerId,
    });

    const msg = penaltyAmount > 0
      ? `Booking cancelled. A penalty of ₹${penaltyAmount} has been charged.`
      : 'Booking cancelled successfully.';
    res.json(success({ penaltyAmount }, msg));
  } catch (err) {
    log.error({ ...ctx, tag: 'bookingService_cancelBooking_failed' }, 'cancelBooking handler failed', err);
    res.status(500).json(failure('Internal server error'));
  }
};

// ─── GET /bookings — List user's bookings ────────────────────────────────────
export const getMyBookings = async (req: Request, res: Response): Promise<void> => {
  const user               = (req as any).user;
  const { page, limit, skip } = getPaginationParams(req.query as any);
  const { status }         = req.query;
  const ctx = { fn: 'getMyBookings', tag: 'bookingService_getMyBookings', userId: user.phone, role: user.role, action: 'GET_MY_BOOKINGS' };
  log.enter(ctx, { page, limit, status });

  try {
    const filter: Record<string, unknown> = user.role === 'customer'
      ? { customerId: user.phone }
      : { workerId:   user.phone };
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

// ─── GET /bookings/available — Available booking requests for workers ──────────
// Returns SEARCHING bookings (not yet accepted) that a worker can browse and
// accept. Optional ?category= filter matches the worker's service category.
export const getAvailableBookings = async (req: Request, res: Response): Promise<void> => {
  const user               = (req as any).user;
  const { page, limit, skip } = getPaginationParams(req.query as any);
  const { category }       = req.query;
  const ctx = { fn: 'getAvailableBookings', tag: 'bookingService_getAvailableBookings', userId: user.phone, role: user.role, action: 'GET_AVAILABLE_BOOKINGS' };
  log.enter(ctx, { page, limit, category });

  if (user.role !== 'worker') {
    res.status(403).json(failure('Only workers can view available booking requests'));
    return;
  }

  try {
    const filter: Record<string, unknown> = {
      status:   BookingStatus.SEARCHING,
      workerId: '', // not yet accepted by any worker
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

// ─── GET /bookings/:bookingId ─────────────────────────────────────────────────
export const getBookingById = async (req: Request, res: Response): Promise<void> => {
  const user          = (req as any).user;
  const { bookingId } = req.params;
  const ctx = { fn: 'getBookingById', tag: 'bookingService_getBookingById', userId: user.phone, role: user.role, action: 'GET_BOOKING' };
  log.enter(ctx, { bookingId });

  try {
    const booking = await BookingModel.findOne({ bookingId });
    log.db(ctx, 'BookingModel.findOne', { found: !!booking, status: booking?.status });

    if (!booking) {
      log.warn(ctx, 'Booking not found', { bookingId });
      res.status(404).json(failure('Booking not found'));
      return;
    }

    if (booking.customerId !== user.phone && booking.workerId !== user.phone && user.role !== 'admin') {
      log.warn(ctx, 'Access denied — user is not party to this booking', { bookingId });
      res.status(403).json(failure('Access denied'));
      return;
    }

    log.info(ctx, 'Booking fetched', { bookingId, status: booking.status });
    res.json(success(booking));
  } catch (err) {
    log.error({ ...ctx, tag: 'bookingService_getBookingById_failed' }, 'getBookingById handler failed', err);
    res.status(500).json(failure('Internal server error'));
  }
};
