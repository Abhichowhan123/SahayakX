import mongoose, { Schema, Document } from 'mongoose';
import {
  BookingStatus, PaymentMethod, PaymentStatus,
  ServiceCategory, IAddress,
} from '@serveease/shared/types';

export interface IBookingDocument extends Document {
  bookingId:       string;
  customerId:      string;   // phone or ObjectId ref
  workerId:        string; // empty initially for SEARCHING/dispatch flow
  /** Worker IDs this booking was dispatched to (wave-based notification targets). */
  dispatchedTo:    string[];
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
    expiresAt?:         Date;
    scheduledAt?:       Date;
  };

  location: {
    customerAddress:  IAddress;
    workerStartCoords?: [number, number];
  };

  
  otp: {
    code?:     string;
    hash?:     string;
    expiresAt?: Date;
    attempts?: number;
    verified:  boolean;
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
  workerId:        { type: String, required: false, default: '', index: true },
  dispatchedTo:    { type: [String], default: [], index: true },
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
    expiresAt:         Date,
    scheduledAt:       Date,
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
    // Plain 4-digit code the customer shares with the worker. Not required at
    // the schema level because bookings created by older app versions stored
    // only `hash` — making it required makes every save() of those fail.
    code:     { type: String },
    hash:     { type: String },
    expiresAt: Date,
    attempts: { type: Number, default: 0 },
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
