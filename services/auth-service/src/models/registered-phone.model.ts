import mongoose, { Schema, Document } from 'mongoose';

export interface IRegisteredPhoneDocument extends Document {
  phone: string;
  role:  'customer' | 'worker';
}

const RegisteredPhoneSchema = new Schema<IRegisteredPhoneDocument>({
  phone: { type: String, required: true, unique: true, index: true },
  role:  { type: String, enum: ['customer', 'worker'], required: true },
}, { timestamps: true });

export const RegisteredPhoneModel = mongoose.model<IRegisteredPhoneDocument>(
  'RegisteredPhone',
  RegisteredPhoneSchema,
);
