import { Request, Response } from 'express';
import Razorpay              from 'razorpay';
import crypto                from 'crypto';
import { TransactionModel }  from '../models/transaction.model';
import { publishEvent, QueueName } from '@serveease/shared/events';
import { success, failure, createLogger }  from '@serveease/shared/utils';
import { PaymentStatus, PLATFORM_CONFIG } from '@serveease/shared/types';
import axios                 from 'axios';

const log = createLogger('payment-service');

function getRazorpay(): Razorpay {
  const keyId     = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) throw new Error('Razorpay credentials not configured (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET)');
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

const WORKER_SERVICE_URL = process.env.WORKER_SERVICE_URL || 'http://worker-service:3003';
const USER_SERVICE_URL   = process.env.USER_SERVICE_URL   || 'http://user-service:3002';

// ─── POST /payments/order — Create Razorpay order ────────────────────────────
export const createOrder = async (req: Request, res: Response): Promise<void> => {
  const { bookingId, amount, currency = 'INR' } = req.body;
  const customerId = (req as any).user.phone as string;
  const ctx = { fn: 'createOrder', tag: 'paymentService_createOrder', userId: customerId, role: 'customer', action: 'CREATE_ORDER' };
  log.enter(ctx, { bookingId, amount, currency });

  try {
    const order = await getRazorpay().orders.create({
      amount:   Math.round(amount * 100),
      currency,
      receipt:  bookingId,
      notes:    { bookingId, customerId },
    });
    log.info(ctx, 'Razorpay order created', { orderId: order.id, amount, currency, bookingId });

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
    log.db(ctx, 'TransactionModel.create', { bookingId, amount, status: PaymentStatus.PENDING, razorpayOrderId: order.id });

    res.json(success({
      orderId:   order.id,
      amount,
      currency,
      keyId:     process.env.RAZORPAY_KEY_ID,
    }, 'Payment order created'));
  } catch (err) {
    log.error({ ...ctx, tag: 'paymentService_createOrder_failed' }, 'createOrder handler failed', err);
    res.status(500).json(failure('Internal server error'));
  }
};

// ─── POST /payments/verify — Verify Razorpay payment & hold in escrow ────────
export const verifyPayment = async (req: Request, res: Response): Promise<void> => {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature, bookingId } = req.body;
  const ctx = { fn: 'verifyPayment', tag: 'paymentService_verifyPayment', action: 'VERIFY_PAYMENT' };
  log.enter(ctx, { bookingId, razorpayOrderId });

  try {
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');

    if (expectedSignature !== razorpaySignature) {
      log.warn(ctx, 'Razorpay signature verification failed', { bookingId, razorpayOrderId });
      res.status(400).json(failure('Invalid payment signature'));
      return;
    }

    await TransactionModel.findOneAndUpdate(
      { razorpayOrderId },
      { razorpayPaymentId, razorpaySignature, status: PaymentStatus.HELD_IN_ESCROW },
    );
    log.db(ctx, 'TransactionModel.findOneAndUpdate (status=HELD_IN_ESCROW)', { bookingId, razorpayOrderId });

    log.info(ctx, 'Payment verified and held in escrow', { bookingId, razorpayPaymentId });
    res.json(success(null, 'Payment verified and held in escrow. Will be released on job completion.'));
  } catch (err) {
    log.error({ ...ctx, tag: 'paymentService_verifyPayment_failed' }, 'verifyPayment handler failed', err);
    res.status(500).json(failure('Internal server error'));
  }
};

// ─── POST /payments/hold — Internal: Hold payment after worker accepts ────────
export const holdPayment = async (req: Request, res: Response): Promise<void> => {
  const { bookingId, amount, customerId } = req.body;
  const ctx = { fn: 'holdPayment', tag: 'paymentService_holdPayment', userId: customerId, action: 'HOLD_PAYMENT' };
  log.enter(ctx, { bookingId, amount });

  try {
    await TransactionModel.findOneAndUpdate(
      { bookingId },
      { status: PaymentStatus.HELD_IN_ESCROW },
      { upsert: false },
    );
    log.db(ctx, 'TransactionModel.findOneAndUpdate (status=HELD_IN_ESCROW)', { bookingId });

    log.info(ctx, 'Payment held in escrow (internal)', { bookingId, amount });
    res.json(success(null, 'Payment held in escrow'));
  } catch (err) {
    log.error({ ...ctx, tag: 'paymentService_holdPayment_failed' }, 'holdPayment handler failed', err);
    res.status(500).json(failure('Internal server error'));
  }
};

// ─── POST /payments/release — Release payment to worker after completion ──────
export const releasePayment = async (req: Request, res: Response): Promise<void> => {
  const { bookingId, workerId, finalAmount } = req.body;
  const ctx = { fn: 'releasePayment', tag: 'paymentService_releasePayment', action: 'RELEASE_PAYMENT' };
  log.enter(ctx, { bookingId, workerId, finalAmount });

  try {
    const txn = await TransactionModel.findOne({ bookingId, status: PaymentStatus.HELD_IN_ESCROW });
    log.db(ctx, 'TransactionModel.findOne (escrow)', { found: !!txn, bookingId });

    if (!txn) {
      log.warn(ctx, 'Escrow transaction not found for release', { bookingId });
      res.status(404).json(failure('Escrow transaction not found'));
      return;
    }

    const workerAmount   = Math.round(finalAmount * (1 - PLATFORM_CONFIG.commissionPercent) * 100) / 100;
    const platformAmount = finalAmount - workerAmount;

    try {
      await axios.patch(`${WORKER_SERVICE_URL}/internal/workers/${workerId}/wallet`, { amount: workerAmount });
      log.info(ctx, 'Worker wallet credited via worker-service', { workerId, workerAmount });
    } catch (err) {
      log.error(ctx, 'Failed to credit worker wallet', err);
    }

    txn.status = PaymentStatus.RELEASED;
    await txn.save();
    log.db(ctx, 'TransactionModel.save (status=RELEASED)', { bookingId });

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
    log.db(ctx, 'TransactionModel.create (platform_fee)', { bookingId, platformAmount });

    log.info(ctx, 'Payment released to worker', { bookingId, workerId, workerAmount, platformAmount });
    res.json(success({ workerAmount, platformAmount }, 'Payment released to worker'));
  } catch (err) {
    log.error({ ...ctx, tag: 'paymentService_releasePayment_failed' }, 'releasePayment handler failed', err);
    res.status(500).json(failure('Internal server error'));
  }
};

// ─── POST /payments/refund — Refund to customer ───────────────────────────────
export const refundPayment = async (req: Request, res: Response): Promise<void> => {
  const { bookingId, reason } = req.body;
  const ctx = { fn: 'refundPayment', tag: 'paymentService_refundPayment', action: 'REFUND_PAYMENT' };
  log.enter(ctx, { bookingId, reason });

  try {
    const txn = await TransactionModel.findOne({
      bookingId,
      status: { $in: [PaymentStatus.HELD_IN_ESCROW, PaymentStatus.PENDING] },
    });
    log.db(ctx, 'TransactionModel.findOne (refundable)', { found: !!txn, bookingId });

    if (!txn) {
      log.warn(ctx, 'No refundable transaction found', { bookingId });
      res.status(404).json(failure('No refundable transaction found'));
      return;
    }

    if (txn.razorpayPaymentId) {
      await getRazorpay().payments.refund(txn.razorpayPaymentId, {
        amount: Math.round(txn.amount * 100),
        notes:  { reason, bookingId },
      });
      log.info(ctx, 'Razorpay refund initiated', { bookingId, amount: txn.amount, razorpayPaymentId: txn.razorpayPaymentId });
    }

    txn.status = PaymentStatus.REFUNDED;
    await txn.save();
    log.db(ctx, 'TransactionModel.save (status=REFUNDED)', { bookingId });

    log.info(ctx, 'Refund processed successfully', { bookingId, amount: txn.amount });
    res.json(success(null, 'Refund initiated. Will reflect in 5-7 business days.'));
  } catch (err) {
    log.error({ ...ctx, tag: 'paymentService_refundPayment_failed' }, 'refundPayment handler failed', err);
    res.status(500).json(failure('Internal server error'));
  }
};

// ─── POST /payments/penalty — Charge cancellation penalty ────────────────────
export const chargePenalty = async (req: Request, res: Response): Promise<void> => {
  const { bookingId, userId, penaltyAmount, cancelledBy } = req.body;
  const ctx = { fn: 'chargePenalty', tag: 'paymentService_chargePenalty', userId, action: 'CHARGE_PENALTY' };
  log.enter(ctx, { bookingId, penaltyAmount, cancelledBy });

  try {
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
    log.db(ctx, 'TransactionModel.create (penalty)', { bookingId, penaltyAmount, cancelledBy });

    const serviceUrl = cancelledBy === 'worker' ? WORKER_SERVICE_URL : USER_SERVICE_URL;
    try {
      await axios.patch(`${serviceUrl}/internal/${cancelledBy === 'worker' ? 'workers' : 'users'}/${userId}/wallet`, {
        amount: -penaltyAmount,
      });
      log.info(ctx, 'Penalty deducted from wallet', { userId, penaltyAmount, cancelledBy });
    } catch (err) {
      log.error(ctx, 'Failed to deduct penalty from wallet', err);
    }

    publishEvent(QueueName.NOTIFICATION_SEND, {
      userId,
      title:   'Cancellation Penalty',
      body:    `₹${penaltyAmount} penalty deducted for cancelling booking ${bookingId}`,
      type:    'penalty',
    });
    log.info(ctx, 'NOTIFICATION_SEND event published for penalty', { bookingId, penaltyAmount });

    res.json(success({ penaltyAmount }, 'Penalty charged'));
  } catch (err) {
    log.error({ ...ctx, tag: 'paymentService_chargePenalty_failed' }, 'chargePenalty handler failed', err);
    res.status(500).json(failure('Internal server error'));
  }
};

// ─── GET /payments/history — Transaction history ──────────────────────────────
export const getHistory = async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).user.phone as string;
  const ctx = { fn: 'getHistory', tag: 'paymentService_getHistory', userId, action: 'GET_PAYMENT_HISTORY' };
  log.enter(ctx);

  try {
    const txns = await TransactionModel.find({ fromUserId: userId }).sort({ createdAt: -1 }).limit(50);
    log.db(ctx, 'TransactionModel.find', { count: txns.length });

    log.info(ctx, 'Transaction history fetched', { count: txns.length });
    res.json(success(txns, 'Transaction history'));
  } catch (err) {
    log.error({ ...ctx, tag: 'paymentService_getHistory_failed' }, 'getHistory handler failed', err);
    res.status(500).json(failure('Internal server error'));
  }
};

// ─── POST /payments/wallet/topup — Add money to wallet ────────────────────────
export const walletTopup = async (req: Request, res: Response): Promise<void> => {
  const userId     = (req as any).user.phone as string;
  const { amount } = req.body;
  const ctx = { fn: 'walletTopup', tag: 'paymentService_walletTopup', userId, action: 'WALLET_TOPUP' };
  log.enter(ctx, { amount });

  try {
    const order = await getRazorpay().orders.create({
      amount:   Math.round(amount * 100),
      currency: 'INR',
      receipt:  `wallet_${userId}_${Date.now()}`,
    });
    log.info(ctx, 'Razorpay wallet topup order created', { orderId: order.id, amount });

    res.json(success({ orderId: order.id, amount, keyId: process.env.RAZORPAY_KEY_ID }, 'Wallet topup order created'));
  } catch (err) {
    log.error({ ...ctx, tag: 'paymentService_walletTopup_failed' }, 'walletTopup handler failed', err);
    res.status(500).json(failure('Internal server error'));
  }
};
