import { BookingModel } from '../models/booking.model';
import { publishEvent, QueueName } from '@serveease/shared/events';
import { BookingStatus } from '@serveease/shared/types';
import { createLogger, findNearbyWorkers } from '@serveease/shared/utils';

const log = createLogger('booking-service');

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
      // No worker is online nearby yet — keep the booking in SEARCHING so the
      // customer can still see it and cancel it. The booking expires on its
      // own once the acceptance window (schedule.expiresAt) has passed.
      log.warn(ctx, 'No nearby workers available, booking stays open until it expires', { bookingId });
      return;
    }

    publishEvent(QueueName.BOOKING_DISPATCHED, {
      bookingId, customerId: booking.customerId, workerIds: nearbyWorkerIds,
      customerPhone: booking.customerId, serviceCategory: booking.serviceCategory,
      lat, lng, radiusKm,
    });

    booking.dispatchedTo = nearbyWorkerIds;
    await booking.save();
    log.db(ctx, 'BookingModel.save (dispatchedTo persisted)', { bookingId, dispatchedTo: nearbyWorkerIds });

    log.info(ctx, 'BOOKING_DISPATCHED event published', { bookingId, workerCount: nearbyWorkerIds.length, workerIds: nearbyWorkerIds });
  } catch (err) {
    log.error({ ...ctx, tag: 'bookingService_dispatchWave_failed' }, 'dispatchWave failed', err);
  }
};
