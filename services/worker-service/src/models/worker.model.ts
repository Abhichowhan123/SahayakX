import mongoose, { Schema, Document } from 'mongoose';
import { ServiceCategory, VerificationStatus, IGeoPoint, IWallet, IPricing } from '@serveease/shared/types';

export interface IWorkerDocument extends Document {
  phone:            string;
  fullName:         string;
  email?:           string;
  profilePhoto?:    string;
  bio:              string;
  experience:       number;
  skills:           string[];
  serviceCategory:  ServiceCategory;
  serviceSubTypes:  string[];
  verification: {
    aadhaarNumber:     string;   // AES-256 encrypted
    aadhaarFrontPhoto: string;
    aadhaarBackPhoto:  string;
    selfiePhoto?:      string;
    panNumber?:        string;
    bankAccount: {
      accountNumber: string;     // AES-256 encrypted
      ifscCode:      string;
      accountHolder: string;
      upiId?:        string;
    };
    status:          VerificationStatus;
    submittedAt?:    Date;
    verifiedAt?:     Date;
    verifiedBy?:     string;
    rejectionReason?: string;
  };
  pricing:           IPricing;
  location:          IGeoPoint;
  isOnline:          boolean;
  isAvailable:       boolean;
  isBlocked:         boolean;
  blockedReason?:    string;
  ratings: {
    average:       number;
    totalReviews:  number;
  };
  wallet:             IWallet;
  cancellationCount:  number;
  penaltyDeducted:    number;
  totalJobsCompleted: number;
  fcmToken?:          string;
  createdAt:          Date;
  updatedAt:          Date;
}

const WorkerSchema = new Schema<IWorkerDocument>({
  phone:           { type: String, required: true, unique: true, index: true },
  fullName:        { type: String, default: '' },
  email:           { type: String, sparse: true },
  profilePhoto:    String,
  bio:             { type: String, default: '' },
  experience:      { type: Number, default: 0 },
  skills:          [String],
  serviceCategory: { type: String, enum: Object.values(ServiceCategory), required: true },
  serviceSubTypes: [String],

  verification: {
    aadhaarNumber:     { type: String, default: '' },
    aadhaarFrontPhoto: { type: String, default: '' },
    aadhaarBackPhoto:  { type: String, default: '' },
    selfiePhoto:       String,
    panNumber:         String,
    bankAccount: {
      accountNumber: { type: String, default: '' },
      ifscCode:      { type: String, default: '' },
      accountHolder: { type: String, default: '' },
      upiId:         String,
    },
    status:           { type: String, enum: Object.values(VerificationStatus), default: VerificationStatus.PENDING },
    submittedAt:      Date,
    verifiedAt:       Date,
    verifiedBy:       String,
    rejectionReason:  String,
  },

  pricing: {
    hourlyRate:    { type: Number, default: 0 },
    dailyRate:     Number,
    minimumHours:  { type: Number, default: 1 },
    currency:      { type: String, default: 'INR' },
    isNegotiable:  { type: Boolean, default: true },
    suggestedFares: [Number],
  },

  location: {
    type:        { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: [0, 0] },
  },

  isOnline:    { type: Boolean, default: false },
  isAvailable: { type: Boolean, default: true },
  isBlocked:   { type: Boolean, default: false },
  blockedReason: String,

  ratings: {
    average:      { type: Number, default: 0 },
    totalReviews: { type: Number, default: 0 },
  },

  wallet: {
    balance:    { type: Number, default: 0 },
    currency:   { type: String, default: 'INR' },
    totalEarned: { type: Number, default: 0 },
  },

  cancellationCount:  { type: Number, default: 0 },
  penaltyDeducted:    { type: Number, default: 0 },
  totalJobsCompleted: { type: Number, default: 0 },
  fcmToken: String,
}, { timestamps: true });

WorkerSchema.index({ location: '2dsphere' });
WorkerSchema.index({ serviceCategory: 1, 'verification.status': 1, isOnline: 1 });

export const WorkerModel = mongoose.model<IWorkerDocument>('Worker', WorkerSchema);
