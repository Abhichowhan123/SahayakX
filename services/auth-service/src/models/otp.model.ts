import mongoose, { Schema, Document } from 'mongoose';

export interface IOtpDocument extends Document {
  phone:     string;
  otp:       string;
  role:      string;
  attempts:  number;
  expiresAt: Date;
  verified:  boolean;
}

const OtpSchema = new Schema<IOtpDocument>({
  phone:     { type: String, required: true, index: true },
  otp:       { type: String, required: true },
  role:      { type: String, enum: ['customer', 'worker', 'admin'], default: 'customer' },
  attempts:  { type: Number, default: 0 },
  expiresAt: { type: Date,   required: true },
  verified:  { type: Boolean, default: false },
}, { timestamps: true });

// Auto-delete expired OTPs
OtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const OtpModel = mongoose.model<IOtpDocument>('Otp', OtpSchema);
