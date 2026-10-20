import { Request } from 'express';

/**
 * Broadcast a booking status change to every client watching the booking.
 * The `io` instance is attached to each request in the service entrypoint.
 */
export const emitBookingStatus = (
  req: Request,
  payload: { bookingId: string; oldStatus?: string; newStatus: string },
): void => {
  const io = (req as any).io;
  if (!io) return;
  io.to(`booking_${payload.bookingId}`).emit('booking_status', payload);
};
