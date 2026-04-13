import { Request, Response } from 'express';
import { UserModel }         from '../models/user.model';
import { success, failure, getPaginationParams } from '@serveease/shared/utils';

// ─── GET /users/me ───────────────────────────────────────────────────────────
export const getProfile = async (req: Request, res: Response): Promise<void> => {
  const phone = (req as any).user.phone as string;

  let user = await UserModel.findOne({ phone });
  if (!user) {
    // Auto-create profile on first login
    user = await UserModel.create({ phone });
  }

  res.json(success(user, 'Profile fetched'));
};

// ─── PUT /users/me ───────────────────────────────────────────────────────────
export const updateProfile = async (req: Request, res: Response): Promise<void> => {
  const phone = (req as any).user.phone as string;
  const { fullName, email, fcmToken } = req.body;

  const user = await UserModel.findOneAndUpdate(
    { phone },
    { fullName, email, fcmToken },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );

  res.json(success(user, 'Profile updated'));
};

// ─── PUT /users/me/location ──────────────────────────────────────────────────
export const updateLocation = async (req: Request, res: Response): Promise<void> => {
  const phone = (req as any).user.phone as string;
  const { longitude, latitude } = req.body;

  await UserModel.findOneAndUpdate(
    { phone },
    { location: { type: 'Point', coordinates: [longitude, latitude] } },
    { upsert: true },
  );

  res.json(success(null, 'Location updated'));
};

// ─── POST /users/me/addresses ────────────────────────────────────────────────
export const addAddress = async (req: Request, res: Response): Promise<void> => {
  const phone = (req as any).user.phone as string;
  const address = req.body;

  const user = await UserModel.findOneAndUpdate(
    { phone },
    { $push: { addresses: address } },
    { new: true, upsert: true },
  );

  res.json(success(user?.addresses, 'Address added'));
};

// ─── DELETE /users/me/addresses/:id ──────────────────────────────────────────
export const deleteAddress = async (req: Request, res: Response): Promise<void> => {
  const phone     = (req as any).user.phone as string;
  const { id }    = req.params;

  const user = await UserModel.findOneAndUpdate(
    { phone },
    { $pull: { addresses: { _id: id } } },
    { new: true },
  );

  res.json(success(user?.addresses, 'Address removed'));
};

// ─── POST /users/me/save-worker/:workerId ────────────────────────────────────
export const saveWorker = async (req: Request, res: Response): Promise<void> => {
  const phone      = (req as any).user.phone as string;
  const { workerId } = req.params;

  await UserModel.findOneAndUpdate(
    { phone },
    { $addToSet: { savedWorkers: workerId } },
  );

  res.json(success(null, 'Worker saved to favourites'));
};

// ─── DELETE /users/me/save-worker/:workerId ──────────────────────────────────
export const unsaveWorker = async (req: Request, res: Response): Promise<void> => {
  const phone      = (req as any).user.phone as string;
  const { workerId } = req.params;

  await UserModel.findOneAndUpdate(
    { phone },
    { $pull: { savedWorkers: workerId } },
  );

  res.json(success(null, 'Worker removed from favourites'));
};

// ─── GET /users/me/wallet ─────────────────────────────────────────────────────
export const getWallet = async (req: Request, res: Response): Promise<void> => {
  const phone = (req as any).user.phone as string;
  const user  = await UserModel.findOne({ phone }, 'wallet');
  res.json(success(user?.wallet, 'Wallet fetched'));
};

// ─── Internal: GET /users/internal/:phone ────────────────────────────────────
export const getUserByPhone = async (req: Request, res: Response): Promise<void> => {
  const { phone } = req.params;
  const user = await UserModel.findOne({ phone });
  if (!user) {
    res.status(404).json(failure('User not found'));
    return;
  }
  res.json(success(user));
};
