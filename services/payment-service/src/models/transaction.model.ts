import mongoose, { Schema, Document } from 'mongoose';
import { PaymentMethod, PaymentStatus } from '@serveease/shared/types';

export type TransactionType = 'booking_payment' | 'penalty' | 'refund' | 'wallet_topup' | 'withdrawal' | 'platform_fee';

export interface ITransactionDocument extends Document {
  transactionId:    string;
  bookingId?:       string;
  fromUserId:       string;
  toUserId?:        string;
  type:             TransactionType;
  amount:           number;
  currency:         string;
  method:           PaymentMethod;
  status:           PaymentStatus;
  razorpayOrderId?:    string;
  razorpayPaymentId?:  string;
  razorpaySignature?:  string;
  description:      string;
  metadata?:        Record<string, unknown>;
  createdAt:        Date;
  updatedAt:        Date;
}

const TransactionSchema = new Schema<ITransactionDocument>({
  transactionId:   { type: String, required: true, unique: true },
  bookingId:       { type: String, index: true },
  fromUserId:      { type: String, required: true, index: true },
  toUserId:        String,
  type:            { type: String, required: true },
  amount:          { type: Number, required: true },
  currency:        { type: String, default: 'INR' },
  method:          { type: String, enum: Object.values(PaymentMethod) },
  status:          { type: String, enum: Object.values(PaymentStatus), default: PaymentStatus.PENDING },
  razorpayOrderId:   String,
  razorpayPaymentId: String,
  razorpaySignature: String,
  description:       { type: String, required: true },
  metadata:          Schema.Types.Mixed,
}, { timestamps: true });

export const TransactionModel = mongoose.model<ITransactionDocument>('Transaction', TransactionSchema);
