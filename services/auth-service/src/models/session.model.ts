import mongoose, { Schema, Document } from 'mongoose';

export interface ISessionDocument extends Document {
  userId:    string;
  role:      string;
  token:     string;
  deviceId?: string;
  platform?: string;
  fcmToken?: string;
  isActive:  boolean;
  expiresAt: Date;
  lastSeen:  Date;
}

const SessionSchema = new Schema<ISessionDocument>({
  userId:    { type: String, required: true, index: true },
  role:      { type: String, required: true },
  token:     { type: String, required: true },
  deviceId:  { type: String },
  platform:  { type: String, enum: ['ios', 'android', 'web'] },
  fcmToken:  { type: String },
  isActive:  { type: Boolean, default: true },
  expiresAt: { type: Date, required: true },
  lastSeen:  { type: Date, default: Date.now },
}, { timestamps: true });

SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const SessionModel = mongoose.model<ISessionDocument>('Session', SessionSchema);
