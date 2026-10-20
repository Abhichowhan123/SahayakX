import { Request, Response } from 'express';
import { BookingModel } from '../../models/booking.model';
import { publishEvent, QueueName } from '@serveease/shared/events';
import {
  generateBookingId, generateOTP,
  success, failure, getPaginationParams, createLogger,
} from '@serveease/shared/utils';
import {
  BookingStatus, PaymentStatus,
  CANCELLATION_RULES, PLATFORM_CONFIG,
} from '@serveease/shared/types';
import { createClient } from 'redis';
import { dispatchWave as sharedDispatchWave } from '../../utils/dispatch';
import { emitBookingStatus } from '../../utils/socket';


const log = createLogger('booking-service');

let lockClient: ReturnType<typeof createClient> | null = null;
export const setBookingLockClient = (client: ReturnType<typeof createClient>): void => {
  lockClient = client;
};

export const dispatchWave = sharedDispatchWave;

export const createBooking = async (req: Request, res: Response): Promise<void> => {
  const customerId = (req as any).user.phone as string;
  const {
    serviceCategory, serviceSubType,
    requestedDate, requestedTimeSlot, estimatedDuration,
    customerAddress, paymentMethod, customerOfferedPrice,
    location,
  } = req.body;
  const ctx = { fn: 'createBooking', tag: 'bookingService_createBooking', userId: customerId, role: 'customer', action: 'CREATE_BOOKING' };
  log.enter(ctx, { serviceCategory, serviceSubType, estimatedDuration });

  try {
    const otp = generateOTP(4);
    const bookingId = generateBookingId();

    const workerQuotedPrice = 0;
    const finalAgreedPrice = customerOfferedPrice || workerQuotedPrice;
    const platformFee = Math.round(finalAgreedPrice * PLATFORM_CONFIG.commissionPercent * 100) / 100;
    const tax = Math.round(finalAgreedPrice * PLATFORM_CONFIG.taxPercent * 100) / 100;
    const totalAmount = finalAgreedPrice + platformFee + tax;

    const geoLocation = location?.lat != null && location?.lng != null
      ? { type: 'Point' as const, coordinates: [location.lng, location.lat] as [number, number] }
      : undefined;

    await BookingModel.create({
      bookingId, customerId, workerId: '', serviceCategory, serviceSubType,
      status: BookingStatus.SEARCHING, dispatchedTo: [],
      pricing: { workerQuotedPrice, customerOfferedPrice, finalAgreedPrice, platformFee, tax, totalAmount, currency: 'INR' },
      schedule: { requestedDate, requestedTimeSlot, estimatedDuration, expiresAt: new Date(Date.now() + CANCELLATION_RULES.workerAcceptanceTimeoutSeconds * 1000) },
      location: { customerAddress, ...(geoLocation && { geo: geoLocation }) },
      otp: { code: otp, verified: false },
      payment: { method: paymentMethod, status: PaymentStatus.PENDING },
    });
    log.db(ctx, 'BookingModel.create', { bookingId, totalAmount, status: BookingStatus.SEARCHING });

    log.info(ctx, 'Booking created; worker notified via BOOKING_DISPATCHED event', { bookingId, totalAmount });
    await dispatchWave(bookingId, location);

    res.status(201).json(success({ bookingId, totalAmount, otp: '****' }, 'Booking request sent. Waiting for nearby workers to accept.'));
  } catch (err) {
    log.error({ ...ctx, tag: 'bookingService_createBooking_failed' }, 'createBooking handler failed', err);
    res.status(500).json(failure('Internal server error'));
  }
};

export const startWork = async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  const userId = user.phone as string;
  const { bookingId } = req.params;
  const { otp } = req.body;
  const ctx = { fn: 'startWork', tag: 'bookingService_startWork', userId, role: user.role, action: 'START_WORK' };
  log.enter(ctx, { bookingId });

  try {
    const booking = await BookingModel.findOne({ bookingId });
    log.db(ctx, 'BookingModel.findOne', { found: !!booking, status: booking?.status });

    if (!booking) {
      log.warn(ctx, 'Booking not found', { bookingId });
      res.status(404).json(failure('Booking not found'));
      return;
    }

    if (user.role === 'customer' && booking.customerId !== userId) {
      res.status(403).json(failure('Access denied'));
      return;
    }
    if (user.role === 'worker' && booking.workerId !== userId) {
      res.status(403).json(failure('Access denied'));
      return;
    }

    if (booking.status !== BookingStatus.WORKER_EN_ROUTE && booking.status !== BookingStatus.ACCEPTED && booking.status !== BookingStatus.ARRIVED) {
      log.warn(ctx, 'Cannot start work in current status', { bookingId, status: booking.status });
      res.status(400).json(failure(`Cannot start. Status is ${booking.status}`));
      return;
    }
    if (booking.otp.code !== otp) {
      log.warn(ctx, 'Incorrect OTP provided to start work', { bookingId });
      res.status(400).json(failure('Incorrect OTP'));
      return;
    }

    const oldStatus = booking.status;
    booking.otp.verified = true;
    booking.status = BookingStatus.IN_PROGRESS;
    booking.schedule.startedAt = new Date();
    await booking.save();
    log.db(ctx, 'BookingModel.save (status=IN_PROGRESS, otp.verified=true)', { bookingId });

    publishEvent(QueueName.BOOKING_STATUS_CHANGED, {
      bookingId, oldStatus, newStatus: BookingStatus.IN_PROGRESS,
      customerId: booking.customerId, workerId: booking.workerId,
    });
    emitBookingStatus(req, { bookingId, oldStatus, newStatus: BookingStatus.IN_PROGRESS });
    log.info(ctx, 'Work started, OTP verified', { bookingId, workerId: booking.workerId });

    res.json(success(null, 'Work started! Timer is running.'));
  } catch (err) {
    log.error({ ...ctx, tag: 'bookingService_startWork_failed' }, 'startWork handler failed', err);
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
    const filter: Record<string, unknown> = { customerId: user.phone };
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
