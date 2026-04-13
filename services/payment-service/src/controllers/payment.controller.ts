import { Request, Response } from 'express';
import Razorpay              from 'razorpay';
import crypto                from 'crypto';
import { TransactionModel }  from '../models/transaction.model';
import { publishEvent, QueueName } from '@serveease/shared/events';
import { success, failure }  from '@serveease/shared/utils';
import { PaymentStatus, PLATFORM_CONFIG } from '@serveease/shared/types';
import axios                 from 'axios';

const razorpay = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID     || '',
  key_secret: process.env.RAZORPAY_KEY_SECRET || '',
});

const WORKER_SERVICE_URL = process.env.WORKER_SERVICE_URL || 'http://worker-service:3003';
const USER_SERVICE_URL   = process.env.USER_SERVICE_URL   || 'http://user-service:3002';

// ─── POST /payments/order — Create Razorpay order ────────────────────────────
export const createOrder = async (req: Request, res: Response): Promise<void> => {
  const { bookingId, amount, currency = 'INR' } = req.body;
  const customerId = (req as any).user.phone as string;

  const order = await razorpay.orders.create({
    amount:   Math.round(amount * 100), // Razorpay takes paise
    currency,
    receipt:  bookingId,
    notes:    { bookingId, customerId },
  });

  await TransactionModel.create({
    transactionId:   `TXN-${Date.now()}`,
    bookingId,
    fromUserId:      customerId,
    type:            'booking_payment',
    amount,
    currency,
    method:          req.body.paymentMethod || 'card',
    status:          PaymentStatus.PENDING,
    razorpayOrderId: order.id,
    description:     `Payment for booking ${bookingId}`,
  });

  res.json(success({
    orderId:   order.id,
    amount,
    currency,
    keyId:     process.env.RAZORPAY_KEY_ID,
  }, 'Payment order created'));
};

// ─── POST /payments/verify — Verify Razorpay payment & hold in escrow ────────
export const verifyPayment = async (req: Request, res: Response): Promise<void> => {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature, bookingId } = req.body;

  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');

  if (expectedSignature !== razorpaySignature) {
    res.status(400).json(failure('Invalid payment signature'));
    return;
  }

  await TransactionModel.findOneAndUpdate(
    { razorpayOrderId },
    {
      razorpayPaymentId,
      razorpaySignature,
      status: PaymentStatus.HELD_IN_ESCROW,
    },
  );

  res.json(success(null, 'Payment verified and held in escrow. Will be released on job completion.'));
};

// ─── POST /payments/hold — Internal: Hold payment after worker accepts ────────
export const holdPayment = async (req: Request, res: Response): Promise<void> => {
  const { bookingId, amount, customerId } = req.body;

  await TransactionModel.findOneAndUpdate(
    { bookingId },
    { status: PaymentStatus.HELD_IN_ESCROW },
    { upsert: false },
  );

  res.json(success(null, 'Payment held in escrow'));
};

// ─── POST /payments/release — Release payment to worker after completion ──────
export const releasePayment = async (req: Request, res: Response): Promise<void> => {
  const { bookingId, workerId, finalAmount } = req.body;

  const txn = await TransactionModel.findOne({ bookingId, status: PaymentStatus.HELD_IN_ESCROW });
  if (!txn) { res.status(404).json(failure('Escrow transaction not found')); return; }

  const workerAmount    = Math.round(finalAmount * (1 - PLATFORM_CONFIG.commissionPercent) * 100) / 100;
  const platformAmount  = finalAmount - workerAmount;

  // Credit worker wallet
  await axios.patch(`${WORKER_SERVICE_URL}/internal/workers/${workerId}/wallet`, {
    amount: workerAmount,
  }).catch(err => console.error('[Payment] Failed to credit worker:', err));

  txn.status = PaymentStatus.RELEASED;
  await txn.save();

  // Record platform fee transaction
  await TransactionModel.create({
    transactionId: `FEE-${Date.now()}`,
    bookingId,
    fromUserId:    workerId,
    type:          'platform_fee',
    amount:        platformAmount,
    currency:      'INR',
    method:        txn.method,
    status:        PaymentStatus.RELEASED,
    description:   `Platform fee for booking ${bookingId}`,
  });

  res.json(success({ workerAmount, platformAmount }, 'Payment released to worker'));
};

// ─── POST /payments/refund — Refund to customer ───────────────────────────────
export const refundPayment = async (req: Request, res: Response): Promise<void> => {
  const { bookingId, reason } = req.body;

  const txn = await TransactionModel.findOne({
    bookingId,
    status: { $in: [PaymentStatus.HELD_IN_ESCROW, PaymentStatus.PENDING] },
  });
  if (!txn) { res.status(404).json(failure('No refundable transaction found')); return; }

  if (txn.razorpayPaymentId) {
    await razorpay.payments.refund(txn.razorpayPaymentId, {
      amount: Math.round(txn.amount * 100),
      notes:  { reason, bookingId },
    });
  }

  txn.status = PaymentStatus.REFUNDED;
  await txn.save();

  res.json(success(null, 'Refund initiated. Will reflect in 5-7 business days.'));
};

// ─── POST /payments/penalty — Charge cancellation penalty ────────────────────
export const chargePenalty = async (req: Request, res: Response): Promise<void> => {
  const { bookingId, userId, penaltyAmount, cancelledBy } = req.body;

  await TransactionModel.create({
    transactionId: `PEN-${Date.now()}`,
    bookingId,
    fromUserId:    userId,
    type:          'penalty',
    amount:        penaltyAmount,
    currency:      'INR',
    method:        'wallet',
    status:        PaymentStatus.PENDING,
    description:   `Cancellation penalty for booking ${bookingId}`,
    metadata:      { cancelledBy },
  });

  // Deduct from user wallet
  const serviceUrl = cancelledBy === 'worker' ? WORKER_SERVICE_URL : USER_SERVICE_URL;
  await axios.patch(`${serviceUrl}/internal/${cancelledBy === 'worker' ? 'workers' : 'users'}/${userId}/wallet`, {
    amount: -penaltyAmount,
  }).catch(err => console.error('[Payment] Failed to deduct penalty:', err));

  publishEvent(QueueName.NOTIFICATION_SEND, {
    userId,
    title:   'Cancellation Penalty',
    body:    `₹${penaltyAmount} penalty deducted for cancelling booking ${bookingId}`,
    type:    'penalty',
  });

  res.json(success({ penaltyAmount }, 'Penalty charged'));
};

// ─── GET /payments/history — Transaction history ──────────────────────────────
export const getHistory = async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).user.phone as string;
  const txns   = await TransactionModel.find({ fromUserId: userId }).sort({ createdAt: -1 }).limit(50);
  res.json(success(txns, 'Transaction history'));
};

// ─── POST /payments/wallet/topup — Add money to wallet ────────────────────────
export const walletTopup = async (req: Request, res: Response): Promise<void> => {
  const userId   = (req as any).user.phone as string;
  const { amount } = req.body;

  const order = await razorpay.orders.create({
    amount:   Math.round(amount * 100),
    currency: 'INR',
    receipt:  `wallet_${userId}_${Date.now()}`,
  });

  res.json(success({ orderId: order.id, amount, keyId: process.env.RAZORPAY_KEY_ID }, 'Wallet topup order created'));
};
