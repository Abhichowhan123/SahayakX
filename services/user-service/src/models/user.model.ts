import mongoose, { Schema, Document } from 'mongoose';
import { IAddress, IGeoPoint, IWallet } from '@serveease/shared/types';

export interface IUserDocument extends Document {
  phone:              string;
  fullName:           string;
  email?:             string;
  profilePhoto?:      string;
  addresses:          IAddress[];
  location:           IGeoPoint;
  savedWorkers:       mongoose.Types.ObjectId[];
  wallet:             IWallet;
  cancellationCount:  number;
  penaltyPaid:        number;
  totalBookings:      number;
  isBlocked:          boolean;
  blockedReason?:     string;
  fcmToken?:          string;
  createdAt:          Date;
  updatedAt:          Date;
}

const AddressSchema = new Schema<IAddress>({
  label:   { type: String, required: true },
  line1:   { type: String, required: true },
  line2:   String,
  city:    { type: String, required: true },
  state:   { type: String, required: true },
  pincode: { type: String, required: true },
  country: { type: String, default: 'India' },
}, { _id: true });

const UserSchema = new Schema<IUserDocument>({
  phone:        { type: String, required: true, unique: true, index: true },
  fullName:     { type: String, default: '' },
  email:        { type: String, sparse: true },
  profilePhoto: String,
  addresses:    [AddressSchema],
  location:     {
    type:        { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: [0, 0] },
  },
  savedWorkers:       [{ type: Schema.Types.ObjectId }],
  wallet:             {
    balance:    { type: Number, default: 0 },
    currency:   { type: String, default: 'INR' },
    totalSpent: { type: Number, default: 0 },
  },
  cancellationCount: { type: Number, default: 0 },
  penaltyPaid:       { type: Number, default: 0 },
  totalBookings:     { type: Number, default: 0 },
  isBlocked:         { type: Boolean, default: false },
  blockedReason:     String,
  fcmToken:          String,
}, { timestamps: true });

UserSchema.index({ location: '2dsphere' });

export const UserModel = mongoose.model<IUserDocument>('User', UserSchema);
