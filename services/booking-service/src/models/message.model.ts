import mongoose, { Schema, Document } from 'mongoose';
import { UserRole } from '@serveease/shared/types';

export interface IMessageDocument extends Document {
  bookingId:  string;
  senderId:   string;      // phone of the sender
  senderRole: UserRole;    // 'customer' | 'worker'
  text:       string;
  read:       boolean;
  createdAt:  Date;
  updatedAt:  Date;
}

const MessageSchema = new Schema<IMessageDocument>({
  bookingId:  { type: String, required: true, index: true },
  senderId:   { type: String, required: true, index: true },
  senderRole: { type: String, enum: Object.values(UserRole), required: true },
  text:       { type: String, required: true },
  read:       { type: Boolean, default: false },
}, { timestamps: true });

export const MessageModel = mongoose.model<IMessageDocument>('Message', MessageSchema);
