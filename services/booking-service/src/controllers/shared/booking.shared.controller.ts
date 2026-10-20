import { Request, Response } from 'express';
import { BookingModel } from '../../models/booking.model';
import { MessageModel } from '../../models/message.model';
import { publishEvent, QueueName } from '@serveease/shared/events';
import { BookingStatus, PaymentStatus, CANCELLATION_RULES } from '@serveease/shared/types';
import { success, failure, createLogger, calculatePenalty } from '@serveease/shared/utils';
import { emitBookingStatus } from '../../utils/socket';

const log = createLogger('booking-service');

export const sosBooking = async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  const { bookingId } = req.params;
  const ctx = { fn: 'sosBooking', tag: 'bookingService_sosBooking', userId: user.phone, role: user.role, action: 'SOS' };
  log.enter(ctx, { bookingId });
  try {
    const booking = await BookingModel.findOne({ bookingId });
    if (!booking) {
      res.status(404).json(failure('Booking not found'));
      return;
    }
    if (booking.customerId !== user.phone && booking.workerId !== user.phone) {
      res.status(403).json(failure('Access denied'));
      return;
    }
    log.warn(ctx, 'SOS triggered', { bookingId, triggeredBy: user.phone });
    res.json(success(null, 'SOS alert sent to admin and emergency contacts'));
  } catch (err) {
    log.error({ ...ctx, tag: 'bookingService_sosBooking_failed' }, 'sosBooking failed', err);
    res.status(500).json(failure('Internal server error'));
  }
};

export const getBookingById = async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
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

export const cancelBooking = async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  const { bookingId } = req.params;
  const { reason } = req.body;
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

    if (booking.customerId !== user.phone && booking.workerId !== user.phone) {
      log.warn(ctx, 'Access denied — user is not party to this booking', { bookingId });
      res.status(403).json(failure('Access denied'));
      return;
    }

    const cancelledBy: 'customer' | 'worker' = user.phone === booking.customerId ? 'customer' : 'worker';

    const terminalStatuses = [
      BookingStatus.COMPLETED, BookingStatus.CANCELLED_BY_CUSTOMER,
      BookingStatus.CANCELLED_BY_WORKER, BookingStatus.EXPIRED,
    ];
    if (terminalStatuses.includes(booking.status)) {
      log.warn(ctx, 'Cancellation rejected — booking already in terminal state', { bookingId, status: booking.status });
      res.status(400).json(failure('Booking is already in a final state'));
      return;
    }

    const oldStatus = booking.status;
    const now = new Date();
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
    emitBookingStatus(req, { bookingId, oldStatus, newStatus: booking.status });

    const msg = penaltyAmount > 0
      ? `Booking cancelled. A penalty of ₹${penaltyAmount} has been charged.`
      : 'Booking cancelled successfully.';
    res.json(success({ penaltyAmount }, msg));
  } catch (err) {
    log.error({ ...ctx, tag: 'bookingService_cancelBooking_failed' }, 'cancelBooking handler failed', err);
    res.status(500).json(failure('Internal server error'));
  }
};

export const getBookingMessages = async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  const { bookingId } = req.params;
  const ctx = { fn: 'getBookingMessages', tag: 'bookingService_getBookingMessages', userId: user.phone, role: user.role, action: 'GET_BOOKING_MESSAGES' };
  log.enter(ctx, { bookingId });

  try {
    const booking = await BookingModel.findOne({ bookingId });
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

    const messages = await MessageModel.find({ bookingId }).sort({ createdAt: 1 }).lean();
    log.info(ctx, 'Messages fetched', { bookingId, count: messages.length });
    res.json(success(messages));
  } catch (err) {
    log.error({ ...ctx, tag: 'bookingService_getBookingMessages_failed' }, 'getBookingMessages handler failed', err);
    res.status(500).json(failure('Internal server error'));
  }
};
