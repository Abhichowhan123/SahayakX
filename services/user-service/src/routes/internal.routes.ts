import { Router }    from 'express';
import { UserModel } from '../models/user.model';
import { success, failure } from '@serveease/shared/utils';

const router = Router();

// GET /internal/users/:phone — fetch full user record by phone
router.get('/:phone', async (req, res) => {
  const user = await UserModel.findOne({ phone: req.params.phone });
  if (!user) { res.status(404).json(failure('User not found')); return; }
  res.json(success(user));
});

// PATCH /internal/users/:phone/block — admin block/unblock
router.patch('/:phone/block', async (req, res) => {
  const { isBlocked, blockedReason } = req.body;
  const user = await UserModel.findOneAndUpdate(
    { phone: req.params.phone },
    { isBlocked, blockedReason },
    { new: true },
  );
  if (!user) { res.status(404).json(failure('User not found')); return; }
  res.json(success({ isBlocked: user.isBlocked }, isBlocked ? 'User blocked' : 'User unblocked'));
});

// PATCH /internal/users/:phone/wallet — credit or debit wallet
router.patch('/:phone/wallet', async (req, res) => {
  const { amount } = req.body; // positive = credit, negative = debit
  const user = await UserModel.findOne({ phone: req.params.phone });
  if (!user) { res.status(404).json(failure('User not found')); return; }

  user.wallet.balance = Math.max(0, user.wallet.balance + amount);
  if (amount < 0) {
    user.wallet.totalSpent = (user.wallet.totalSpent || 0) + Math.abs(amount);
  }
  await user.save();
  res.json(success({ balance: user.wallet.balance }, 'Wallet updated'));
});

// GET /internal/users/stats — aggregate stats for admin dashboard
router.get('/stats', async (_req, res) => {
  const [total, blocked, activeToday] = await Promise.all([
    UserModel.countDocuments(),
    UserModel.countDocuments({ isBlocked: true }),
    UserModel.countDocuments({
      updatedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    }),
  ]);
  res.json(success({ total, blocked, activeToday }, 'User stats'));
});

export default router;
