import { Request, Response } from 'express';
import { UserModel }         from '../models/user.model';
import { success, failure, getPaginationParams, createLogger } from '@serveease/shared/utils';

const log = createLogger('user-service');

// ─── GET /users/me ───────────────────────────────────────────────────────────
export const getProfile = async (req: Request, res: Response): Promise<void> => {
  const { phone, role } = (req as any).user as { phone: string; role: 'customer' | 'worker' };
  const ctx = { fn: 'getProfile', tag: 'userService_getProfile', userId: phone, role, action: 'GET_PROFILE' };
  log.enter(ctx);

  try {
    let user = await UserModel.findOne({ phone });
    log.db(ctx, 'UserModel.findOne', { found: !!user });

    if (!user) {
      user = await UserModel.create({ phone, role });
      log.db(ctx, 'UserModel.create (auto-created on first login)', { role });
    }

    log.info(ctx, 'Profile fetched successfully');
    res.json(success(user, 'Profile fetched'));
  } catch (err) {
    log.error({ ...ctx, tag: 'userService_getProfile_failed' }, 'getProfile handler failed', err);
    res.status(500).json(failure('Internal server error'));
  }
};

// ─── PUT /users/me ───────────────────────────────────────────────────────────
export const updateProfile = async (req: Request, res: Response): Promise<void> => {
  const phone = (req as any).user.phone as string;
  const { fullName, email, fcmToken } = req.body;
  const ctx = { fn: 'updateProfile', tag: 'userService_updateProfile', userId: phone, action: 'UPDATE_PROFILE' };
  log.enter(ctx, { hasFullName: !!fullName, hasEmail: !!email, hasFcmToken: !!fcmToken });

  try {
    const user = await UserModel.findOneAndUpdate(
      { phone },
      { fullName, email, fcmToken },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
    log.db(ctx, 'UserModel.findOneAndUpdate', { found: !!user });

    log.info(ctx, 'Profile updated successfully');
    res.json(success(user, 'Profile updated'));
  } catch (err) {
    log.error({ ...ctx, tag: 'userService_updateProfile_failed' }, 'updateProfile handler failed', err);
    res.status(500).json(failure('Internal server error'));
  }
};

// ─── PUT /users/me/location ──────────────────────────────────────────────────
export const updateLocation = async (req: Request, res: Response): Promise<void> => {
  const phone = (req as any).user.phone as string;
  const { longitude, latitude } = req.body;
  const ctx = { fn: 'updateLocation', tag: 'userService_updateLocation', userId: phone, action: 'UPDATE_LOCATION' };
  log.enter(ctx, { longitude, latitude });

  try {
    await UserModel.findOneAndUpdate(
      { phone },
      { location: { type: 'Point', coordinates: [longitude, latitude] } },
      { upsert: true },
    );
    log.db(ctx, 'UserModel.findOneAndUpdate (location)', { longitude, latitude });

    log.info(ctx, 'Location updated successfully');
    res.json(success(null, 'Location updated'));
  } catch (err) {
    log.error({ ...ctx, tag: 'userService_updateLocation_failed' }, 'updateLocation handler failed', err);
    res.status(500).json(failure('Internal server error'));
  }
};

// ─── POST /users/me/addresses ────────────────────────────────────────────────
export const addAddress = async (req: Request, res: Response): Promise<void> => {
  const phone = (req as any).user.phone as string;
  const address = req.body;
  const ctx = { fn: 'addAddress', tag: 'userService_addAddress', userId: phone, action: 'ADD_ADDRESS' };
  log.enter(ctx);

  try {
    const user = await UserModel.findOneAndUpdate(
      { phone },
      { $push: { addresses: address } },
      { new: true, upsert: true },
    );
    log.db(ctx, 'UserModel.findOneAndUpdate ($push address)', { addressCount: user?.addresses?.length });

    log.info(ctx, 'Address added successfully');
    res.json(success(user?.addresses, 'Address added'));
  } catch (err) {
    log.error({ ...ctx, tag: 'userService_addAddress_failed' }, 'addAddress handler failed', err);
    res.status(500).json(failure('Internal server error'));
  }
};

// ─── DELETE /users/me/addresses/:id ──────────────────────────────────────────
export const deleteAddress = async (req: Request, res: Response): Promise<void> => {
  const phone  = (req as any).user.phone as string;
  const { id } = req.params;
  const ctx = { fn: 'deleteAddress', tag: 'userService_deleteAddress', userId: phone, action: 'DELETE_ADDRESS' };
  log.enter(ctx, { addressId: id });

  try {
    const user = await UserModel.findOneAndUpdate(
      { phone },
      { $pull: { addresses: { _id: id } } },
      { new: true },
    );
    log.db(ctx, 'UserModel.findOneAndUpdate ($pull address)', { addressId: id, remainingCount: user?.addresses?.length });

    log.info(ctx, 'Address removed successfully');
    res.json(success(user?.addresses, 'Address removed'));
  } catch (err) {
    log.error({ ...ctx, tag: 'userService_deleteAddress_failed' }, 'deleteAddress handler failed', err);
    res.status(500).json(failure('Internal server error'));
  }
};

// ─── POST /users/me/save-worker/:workerId ────────────────────────────────────
export const saveWorker = async (req: Request, res: Response): Promise<void> => {
  const phone        = (req as any).user.phone as string;
  const { workerId } = req.params;
  const ctx = { fn: 'saveWorker', tag: 'userService_saveWorker', userId: phone, action: 'SAVE_WORKER' };
  log.enter(ctx, { workerId });

  try {
    await UserModel.findOneAndUpdate(
      { phone },
      { $addToSet: { savedWorkers: workerId } },
    );
    log.db(ctx, 'UserModel.findOneAndUpdate ($addToSet savedWorkers)', { workerId });

    log.info(ctx, 'Worker saved to favourites');
    res.json(success(null, 'Worker saved to favourites'));
  } catch (err) {
    log.error({ ...ctx, tag: 'userService_saveWorker_failed' }, 'saveWorker handler failed', err);
    res.status(500).json(failure('Internal server error'));
  }
};

// ─── DELETE /users/me/save-worker/:workerId ──────────────────────────────────
export const unsaveWorker = async (req: Request, res: Response): Promise<void> => {
  const phone        = (req as any).user.phone as string;
  const { workerId } = req.params;
  const ctx = { fn: 'unsaveWorker', tag: 'userService_unsaveWorker', userId: phone, action: 'UNSAVE_WORKER' };
  log.enter(ctx, { workerId });

  try {
    await UserModel.findOneAndUpdate(
      { phone },
      { $pull: { savedWorkers: workerId } },
    );
    log.db(ctx, 'UserModel.findOneAndUpdate ($pull savedWorkers)', { workerId });

    log.info(ctx, 'Worker removed from favourites');
    res.json(success(null, 'Worker removed from favourites'));
  } catch (err) {
    log.error({ ...ctx, tag: 'userService_unsaveWorker_failed' }, 'unsaveWorker handler failed', err);
    res.status(500).json(failure('Internal server error'));
  }
};

// ─── GET /users/me/wallet ─────────────────────────────────────────────────────
export const getWallet = async (req: Request, res: Response): Promise<void> => {
  const phone = (req as any).user.phone as string;
  const ctx = { fn: 'getWallet', tag: 'userService_getWallet', userId: phone, action: 'GET_WALLET' };
  log.enter(ctx);

  try {
    const user = await UserModel.findOne({ phone }, 'wallet');
    log.db(ctx, 'UserModel.findOne (wallet projection)', { found: !!user });

    log.info(ctx, 'Wallet fetched successfully');
    res.json(success(user?.wallet, 'Wallet fetched'));
  } catch (err) {
    log.error({ ...ctx, tag: 'userService_getWallet_failed' }, 'getWallet handler failed', err);
    res.status(500).json(failure('Internal server error'));
  }
};

// ─── Internal: GET /users/internal/:phone ────────────────────────────────────
export const getUserByPhone = async (req: Request, res: Response): Promise<void> => {
  const { phone } = req.params;
  const ctx = { fn: 'getUserByPhone', tag: 'userService_getUserByPhone', userId: phone, action: 'GET_USER_BY_PHONE' };
  log.enter(ctx);

  try {
    const user = await UserModel.findOne({ phone });
    log.db(ctx, 'UserModel.findOne', { found: !!user });

    if (!user) {
      log.warn(ctx, 'User not found by phone (internal call)');
      res.status(404).json(failure('User not found'));
      return;
    }

    log.info(ctx, 'User fetched by phone (internal call)');
    res.json(success(user));
  } catch (err) {
    log.error({ ...ctx, tag: 'userService_getUserByPhone_failed' }, 'getUserByPhone handler failed', err);
    res.status(500).json(failure('Internal server error'));
  }
};
