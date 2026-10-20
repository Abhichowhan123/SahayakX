import { Router }    from 'express';
import { UserModel } from '../models/user.model';
import { success, failure, createLogger } from '@serveease/shared/utils';

const router = Router();
const log    = createLogger('user-service');

// GET /internal/users — list users for the admin panel
router.get('/', async (req, res) => {
  const ctx = { fn: 'internalListUsers', tag: 'userService_internalListUsers', action: 'INTERNAL_LIST_USERS' };
  try {
    const page = parseInt((req.query.page as string) || '1', 10);
    const limit = parseInt((req.query.limit as string) || '50', 10);
    const skip = (page - 1) * limit;
    const { search, role, isBlocked } = req.query as any;
    const filter: any = {};
    if (search) {
      const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ phone: rx }, { fullName: rx }];
    }
    if (role) filter.role = role;
    if (isBlocked !== undefined) filter.isBlocked = isBlocked === 'true';
    const [users, total] = await Promise.all([
      UserModel.find(filter).select('-fcmToken').skip(skip).limit(limit).sort({ createdAt: -1 }),
      UserModel.countDocuments(filter),
    ]);
    log.db(ctx, 'UserModel.find + countDocuments (list)', { total, returned: users.length, page, limit });
    res.json({
      ...success(users, 'Users fetched'),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    log.error({ ...ctx, tag: 'userService_internalListUsers_failed' }, 'Internal list users failed', err);
    res.status(500).json(failure('Internal server error'));
  }
});

// DELETE /internal/users/:phone — permanently remove a user account
router.delete('/:phone', async (req, res) => {
  const ctx = { fn: 'internalDeleteUser', tag: 'userService_internalDeleteUser', action: 'INTERNAL_DELETE_USER' };
  try {
    const { phone } = req.params;
    const user = await UserModel.findOneAndDelete({ phone });
    if (!user) {
      res.status(404).json(failure('User not found'));
      return;
    }
    log.info(ctx, 'User deleted', { phone });
    res.json(success({ phone, deleted: true }, 'User deleted'));
  } catch (err) {
    log.error({ ...ctx, tag: 'userService_internalDeleteUser_failed' }, 'Internal delete user failed', err);
    res.status(500).json(failure('Internal server error'));
  }
});

// PUT /internal/users/:phone — update user details
router.put('/:phone', async (req, res) => {
  const ctx = { fn: 'internalUpdateUser', tag: 'userService_internalUpdateUser', action: 'INTERNAL_UPDATE_USER' };
  try {
    const allowed = ['fullName', 'email', 'role', 'isBlocked', 'blockedReason', 'fcmToken'];
    const updates: any = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (req.body.wallet?.balance !== undefined) updates['wallet.balance'] = req.body.wallet.balance;
    if (req.body.wallet?.totalSpent !== undefined) updates['wallet.totalSpent'] = req.body.wallet.totalSpent;
    if (req.body.wallet?.totalEarned !== undefined) updates['wallet.totalEarned'] = req.body.wallet.totalEarned;
    
    const user = await UserModel.findOneAndUpdate({ phone: req.params.phone }, updates, { new: true });
    if (!user) { res.status(404).json(failure('User not found')); return; }
    log.info(ctx, 'User updated', { phone: req.params.phone });
    res.json(success(user));
  } catch (err) {
    log.error({ ...ctx, tag: 'userService_internalUpdateUser_failed' }, 'Internal update user failed', err);
    res.status(500).json(failure('Internal server error'));
  }
});

// GET /internal/users/stats — aggregate stats for admin dashboard
router.get('/stats', async (_req, res) => {
  const ctx = { fn: 'internalUserStats', tag: 'userService_internalUserStats', action: 'INTERNAL_USER_STATS' };
  try {
    const [total, blocked, activeToday] = await Promise.all([
      UserModel.countDocuments(),
      UserModel.countDocuments({ isBlocked: true }),
      UserModel.countDocuments({
        updatedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      }),
    ]);
    log.info(ctx, 'User stats fetched', { total, blocked, activeToday });
    res.json(success({ total, blocked, activeToday }, 'User stats'));
  } catch (err) {
    log.error({ ...ctx, tag: 'userService_internalUserStats_failed' }, 'Internal user stats failed', err);
    res.status(500).json(failure('Internal server error'));
  }
});

// GET /internal/users/:phone — fetch full user record by phone
router.get('/:phone', async (req, res) => {
  const ctx = { fn: 'internalGetUser', tag: 'userService_internalGetUser', action: 'INTERNAL_GET_USER' };
  try {
    const user = await UserModel.findOne({ phone: req.params.phone });
    if (!user) { res.status(404).json(failure('User not found')); return; }
    res.json(success(user));
  } catch (err) {
    log.error({ ...ctx, tag: 'userService_internalGetUser_failed' }, 'Internal GET user failed', err);
    res.status(500).json(failure('Internal server error'));
  }
});

// PATCH /internal/users/:phone/block — admin block/unblock
router.patch('/:phone/block', async (req, res) => {
  const ctx = { fn: 'internalBlockUser', tag: 'userService_internalBlockUser', action: 'INTERNAL_BLOCK_USER' };
  try {
    const { isBlocked, blockedReason } = req.body;
    const user = await UserModel.findOneAndUpdate(
      { phone: req.params.phone },
      { isBlocked, blockedReason },
      { new: true },
    );
    if (!user) { res.status(404).json(failure('User not found')); return; }
    log.info(ctx, isBlocked ? 'User blocked' : 'User unblocked', { phone: req.params.phone });
    res.json(success({ isBlocked: user.isBlocked }, isBlocked ? 'User blocked' : 'User unblocked'));
  } catch (err) {
    log.error({ ...ctx, tag: 'userService_internalBlockUser_failed' }, 'Internal block user failed', err);
    res.status(500).json(failure('Internal server error'));
  }
});

// PATCH /internal/users/:phone/wallet — credit or debit wallet
router.patch('/:phone/wallet', async (req, res) => {
  const ctx = { fn: 'internalWalletUpdate', tag: 'userService_internalWalletUpdate', action: 'INTERNAL_WALLET_UPDATE' };
  try {
    const { amount } = req.body;
    const user = await UserModel.findOne({ phone: req.params.phone });
    if (!user) { res.status(404).json(failure('User not found')); return; }

    user.wallet.balance = Math.max(0, user.wallet.balance + amount);
    if (amount < 0) {
      user.wallet.totalSpent = (user.wallet.totalSpent || 0) + Math.abs(amount);
    }
    await user.save();
    log.info(ctx, 'User wallet updated', { phone: req.params.phone, amount, newBalance: user.wallet.balance });
    res.json(success({ balance: user.wallet.balance }, 'Wallet updated'));
  } catch (err) {
    log.error({ ...ctx, tag: 'userService_internalWalletUpdate_failed' }, 'Internal wallet update failed', err);
    res.status(500).json(failure('Internal server error'));
  }
});

export default router;
