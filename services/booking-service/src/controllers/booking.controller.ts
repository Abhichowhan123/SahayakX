import { Request, Response }  from 'express';
import { BookingModel }        from '../models/booking.model';
import { publishEvent, QueueName } from '@serveease/shared/events';
import {
  generateBookingId, generateOTP, calculatePenalty,
  success, failure, getPaginationParams,
} from '@serveease/shared/utils';
import {
  BookingStatus, PaymentMethod, PaymentStatus,
  CANCELLATION_RULES, PLATFORM_CONFIG,
} from '@serveease/shared/types';
import axios from 'axios';

const WORKER_SERVICE_URL = process.env.WORKER_SERVICE_URL || 'http://worker-service:3003';
const PAYMENT_SERVICE_URL = process.env.PAYMENT_SERVICE_URL || 'http://payment-service:3006';

// ─── POST /bookings — Create booking request ──────────────────────────────────
export const createBooking = async (req: Request, res: Response): Promise<void> => {
  const customerId = (req as any).user.phone as string;
  const {
    workerId, serviceCategory, serviceSubType,
    requestedDate, requestedTimeSlot, estimatedDuration,
    customerAddress, paymentMethod, customerOfferedPrice,
  } = req.body;

  // Fetch worker to get quoted price
  let workerData: any;
  try {
    const { data } = await axios.get(`${WORKER_SERVICE_URL}/internal/workers/${workerId}`);
    workerData = data.data;
  } catch {
    res.status(404).json(failure('Worker not found'));
    return;
  }

  if (!workerData.isOnline || !workerData.isAvailable) {
    res.status(400).json(failure('Worker is not available right now'));
    return;
  }

  const workerQuotedPrice   = workerData.pricing.hourlyRate * estimatedDuration;
  const finalAgreedPrice    = customerOfferedPrice || workerQuotedPrice;
  const platformFee         = Math.round(finalAgreedPrice * PLATFORM_CONFIG.commissionPercent * 100) / 100;
  const tax                 = Math.round(finalAgreedPrice * PLATFORM_CONFIG.taxPercent * 100) / 100;
  const totalAmount         = finalAgreedPrice + platformFee + tax;

  const otp       = generateOTP(4);  // 4-digit OTP for job start
  const bookingId = generateBookingId();

  const booking = await BookingModel.create({
    bookingId,
    customerId,
    workerId,
    serviceCategory,
    serviceSubType,
    status: BookingStatus.SEARCHING,
    pricing: { workerQuotedPrice, customerOfferedPrice, finalAgreedPrice, platformFee, tax, totalAmount, currency: 'INR' },
    schedule: { requestedDate, requestedTimeSlot, estimatedDuration },
    location: { customerAddress },
    otp:     { code: otp, verified: false },
    payment: { method: paymentMethod, status: PaymentStatus.PENDING },
  });

  // Notify worker via queue
  publishEvent(QueueName.BOOKING_CREATED, {
    bookingId,
    customerId,
    workerId,
    serviceCategory,
    totalAmount,
    customerPhone: customerId,
    workerPhone:   workerData.phone,
  });

  // Auto-expire if worker doesn't accept in 2 minutes
  setTimeout(async () => {
    const b = await BookingModel.findOne({ bookingId });
    if (b && b.status === BookingStatus.SEARCHING) {
      b.status = BookingStatus.EXPIRED;
      await b.save();
      publishEvent(QueueName.BOOKING_STATUS_CHANGED, {
        bookingId, oldStatus: BookingStatus.SEARCHING, newStatus: BookingStatus.EXPIRED,
        customerId, workerId,
      });
    }
  }, CANCELLATION_RULES.workerAcceptanceTimeoutSeconds * 1000);

  res.status(201).json(success({ bookingId, totalAmount, otp: '****' }, 'Booking request sent to worker'));
};

// ─── PUT /bookings/:bookingId/accept — Worker accepts ────────────────────────
export const acceptBooking = async (req: Request, res: Response): Promise<void> => {
  const workerId  = (req as any).user.phone as string;
  const { bookingId } = req.params;

  const booking = await BookingModel.findOne({ bookingId, workerId });
  if (!booking) { res.status(404).json(failure('Booking not found')); return; }
  if (booking.status !== BookingStatus.SEARCHING) {
    res.status(400).json(failure(`Cannot accept. Booking is ${booking.status}`));
    return;
  }

  booking.status = BookingStatus.ACCEPTED;
  await booking.save();

  publishEvent(QueueName.BOOKING_STATUS_CHANGED, {
    bookingId, oldStatus: BookingStatus.SEARCHING, newStatus: BookingStatus.ACCEPTED,
    customerId: booking.customerId, workerId,
  });

  // Trigger payment hold (escrow)
  try {
    await axios.post(`${PAYMENT_SERVICE_URL}/payments/hold`, {
      bookingId, amount: booking.pricing.totalAmount, customerId: booking.customerId,
    });
  } catch (err) {
    console.error('[Booking] Failed to hold payment:', err);
  }

  res.json(success({ bookingId, otp: booking.otp.code }, 'Booking accepted! Head to customer location. Share OTP with customer to start work.'));
};

// ─── PUT /bookings/:bookingId/en-route ────────────────────────────────────────
export const workerEnRoute = async (req: Request, res: Response): Promise<void> => {
  const workerId  = (req as any).user.phone as string;
  const { bookingId } = req.params;

  const booking = await BookingModel.findOne({ bookingId, workerId, status: BookingStatus.ACCEPTED });
  if (!booking) { res.status(404).json(failure('Booking not found or not in accepted state')); return; }

  booking.status = BookingStatus.WORKER_EN_ROUTE;
  await booking.save();

  publishEvent(QueueName.BOOKING_STATUS_CHANGED, {
    bookingId, oldStatus: BookingStatus.ACCEPTED, newStatus: BookingStatus.WORKER_EN_ROUTE,
    customerId: booking.customerId, workerId,
  });

  res.json(success(null, 'Customer notified that you are on the way'));
};

// ─── POST /bookings/:bookingId/start — Customer enters OTP to start ──────────
export const startWork = async (req: Request, res: Response): Promise<void> => {
  const customerId    = (req as any).user.phone as string;
  const { bookingId } = req.params;
  const { otp }       = req.body;

  const booking = await BookingModel.findOne({ bookingId, customerId });
  if (!booking) { res.status(404).json(failure('Booking not found')); return; }
  if (booking.status !== BookingStatus.WORKER_EN_ROUTE && booking.status !== BookingStatus.ACCEPTED) {
    res.status(400).json(failure(`Cannot start. Status is ${booking.status}`));
    return;
  }

  if (booking.otp.code !== otp) {
    res.status(400).json(failure('Incorrect OTP'));
    return;
  }

  booking.otp.verified    = true;
  booking.status          = BookingStatus.IN_PROGRESS;
  booking.schedule.startedAt = new Date();
  await booking.save();

  publishEvent(QueueName.BOOKING_STATUS_CHANGED, {
    bookingId, oldStatus: BookingStatus.WORKER_EN_ROUTE, newStatus: BookingStatus.IN_PROGRESS,
    customerId, workerId: booking.workerId,
  });

  res.json(success(null, 'Work started! Timer is running.'));
};

// ─── PUT /bookings/:bookingId/complete — Worker marks job done ───────────────
export const completeWork = async (req: Request, res: Response): Promise<void> => {
  const workerId      = (req as any).user.phone as string;
  const { bookingId } = req.params;

  const booking = await BookingModel.findOne({ bookingId, workerId, status: BookingStatus.IN_PROGRESS });
  if (!booking) { res.status(404).json(failure('Booking not found')); return; }

  booking.status              = BookingStatus.COMPLETED;
  booking.schedule.completedAt = new Date();
  await booking.save();

  publishEvent(QueueName.BOOKING_STATUS_CHANGED, {
    bookingId, oldStatus: BookingStatus.IN_PROGRESS, newStatus: BookingStatus.COMPLETED,
    customerId: booking.customerId, workerId,
  });

  // Release payment from escrow to worker
  publishEvent(QueueName.PAYMENT_PROCESSED, {
    bookingId,
    transactionId: '',
    amount:        booking.pricing.finalAgreedPrice,
    status:        PaymentStatus.RELEASED,
    workerId,
    customerId:    booking.customerId,
  });

  res.json(success(null, 'Job marked complete. Payment will be released to your wallet.'));
};

// ─── POST /bookings/:bookingId/cancel — Cancel with penalty logic ─────────────
export const cancelBooking = async (req: Request, res: Response): Promise<void> => {
  const user        = (req as any).user;
  const { bookingId } = req.params;
  const { reason }  = req.body;

  const booking = await BookingModel.findOne({ bookingId });
  if (!booking) { res.status(404).json(failure('Booking not found')); return; }

  const cancelledBy: 'customer' | 'worker' =
    user.phone === booking.customerId ? 'customer' : 'worker';

  const terminalStatuses = [BookingStatus.COMPLETED, BookingStatus.CANCELLED_BY_CUSTOMER,
    BookingStatus.CANCELLED_BY_WORKER, BookingStatus.EXPIRED];
  if (terminalStatuses.includes(booking.status)) {
    res.status(400).json(failure('Booking is already in a final state'));
    return;
  }

  // Determine penalty
  const now             = new Date();
  const bookingAge      = (now.getTime() - booking.createdAt.getTime()) / 60000; // minutes
  const freeWindow      = cancelledBy === 'worker'
    ? CANCELLATION_RULES.workerFreeWindowMinutes
    : CANCELLATION_RULES.customerFreeWindowMinutes;

  let penaltyAmount = 0;
  if (booking.status !== BookingStatus.SEARCHING && bookingAge > freeWindow) {
    penaltyAmount = calculatePenalty(booking.pricing.totalAmount, CANCELLATION_RULES.penaltyPercent);
  }

  booking.status = cancelledBy === 'customer'
    ? BookingStatus.CANCELLED_BY_CUSTOMER
    : BookingStatus.CANCELLED_BY_WORKER;

  booking.cancellation = {
    cancelledBy,
    reason,
    cancelledAt:   now,
    penaltyAmount,
    penaltyPaid:   false,
  };
  await booking.save();

  if (penaltyAmount > 0) {
    publishEvent(QueueName.PENALTY_CHARGED, {
      bookingId,
      cancelledBy,
      userId:        user.phone,
      penaltyAmount,
    });
  }

  publishEvent(QueueName.BOOKING_STATUS_CHANGED, {
    bookingId,
    oldStatus: booking.status,
    newStatus: booking.status,
    customerId: booking.customerId,
    workerId:   booking.workerId,
  });

  const msg = penaltyAmount > 0
    ? `Booking cancelled. A penalty of ₹${penaltyAmount} has been charged.`
    : 'Booking cancelled successfully.';

  res.json(success({ penaltyAmount }, msg));
};

// ─── GET /bookings — List user's bookings ────────────────────────────────────
export const getMyBookings = async (req: Request, res: Response): Promise<void> => {
  const user           = (req as any).user;
  const { page, limit, skip } = getPaginationParams(req.query as any);
  const { status }     = req.query;

  const filter: Record<string, unknown> = user.role === 'customer'
    ? { customerId: user.phone }
    : { workerId:   user.phone };

  if (status) filter.status = status;

  const [bookings, total] = await Promise.all([
    BookingModel.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 }),
    BookingModel.countDocuments(filter),
  ]);

  res.json({
    ...success(bookings, 'Bookings fetched'),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
};

// ─── GET /bookings/:bookingId ─────────────────────────────────────────────────
export const getBookingById = async (req: Request, res: Response): Promise<void> => {
  const user        = (req as any).user;
  const { bookingId } = req.params;

  const booking = await BookingModel.findOne({ bookingId });
  if (!booking) { res.status(404).json(failure('Booking not found')); return; }

  // Security: only involved parties can see booking details
  if (booking.customerId !== user.phone && booking.workerId !== user.phone && user.role !== 'admin') {
    res.status(403).json(failure('Access denied'));
    return;
  }

  res.json(success(booking));
};
