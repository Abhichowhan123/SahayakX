import mongoose, { Schema, Document } from 'mongoose';
import {
  BookingStatus, PaymentMethod, PaymentStatus,
  ServiceCategory, IAddress,
} from '@serveease/shared/types';

export interface IBookingDocument extends Document {
  bookingId:       string;
  customerId:      string;   // phone or ObjectId ref
  workerId:        string;
  serviceCategory: ServiceCategory;
  serviceSubType?: string;
  status:          BookingStatus;

  pricing: {
    workerQuotedPrice:    number;
    customerOfferedPrice?: number;
    finalAgreedPrice:     number;
    platformFee:          number;
    tax:                  number;
    totalAmount:          number;
    currency:             string;
  };

  schedule: {
    requestedDate:      Date;
    requestedTimeSlot:  string;
    estimatedDuration:  number;
    startedAt?:         Date;
    completedAt?:       Date;
  };

  location: {
    customerAddress:  IAddress;
    workerStartCoords?: [number, number];
  };

  otp: {
    code:     string;
    verified: boolean;
  };

  cancellation?: {
    cancelledBy:   'customer' | 'worker';
    reason?:       string;
    cancelledAt:   Date;
    penaltyAmount: number;
    penaltyPaid:   boolean;
  };

  payment: {
    method:        PaymentMethod;
    status:        PaymentStatus;
    transactionId?: string;
    razorpayOrderId?: string;
    paidAt?:       Date;
  };

  reviewId?:   string;
  createdAt:   Date;
  updatedAt:   Date;
}

const BookingSchema = new Schema<IBookingDocument>({
  bookingId:       { type: String, required: true, unique: true, index: true },
  customerId:      { type: String, required: true, index: true },
  workerId:        { type: String, required: true, index: true },
  serviceCategory: { type: String, enum: Object.values(ServiceCategory), required: true },
  serviceSubType:  String,
  status:          { type: String, enum: Object.values(BookingStatus), default: BookingStatus.SEARCHING },

  pricing: {
    workerQuotedPrice:    { type: Number, required: true },
    customerOfferedPrice: Number,
    finalAgreedPrice:     { type: Number, default: 0 },
    platformFee:          { type: Number, default: 0 },
    tax:                  { type: Number, default: 0 },
    totalAmount:          { type: Number, default: 0 },
    currency:             { type: String, default: 'INR' },
  },

  schedule: {
    requestedDate:     { type: Date, required: true },
    requestedTimeSlot: { type: String, required: true },
    estimatedDuration: { type: Number, default: 1 },
    startedAt:         Date,
    completedAt:       Date,
  },

  location: {
    customerAddress: {
      label:   String,
      line1:   String,
      line2:   String,
      city:    String,
      state:   String,
      pincode: String,
      country: String,
    },
    workerStartCoords: [Number],
  },

  otp: {
    code:     { type: String, required: true },
    verified: { type: Boolean, default: false },
  },

  cancellation: {
    cancelledBy:   String,
    reason:        String,
    cancelledAt:   Date,
    penaltyAmount: { type: Number, default: 0 },
    penaltyPaid:   { type: Boolean, default: false },
  },

  payment: {
    method:          { type: String, enum: Object.values(PaymentMethod) },
    status:          { type: String, enum: Object.values(PaymentStatus), default: PaymentStatus.PENDING },
    transactionId:   String,
    razorpayOrderId: String,
    paidAt:          Date,
  },

  reviewId: String,
}, { timestamps: true });

export const BookingModel = mongoose.model<IBookingDocument>('Booking', BookingSchema);
