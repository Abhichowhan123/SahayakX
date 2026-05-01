import { Request, Response, NextFunction } from 'express';
import axios from 'axios';
import { failure, createLogger } from '@serveease/shared/utils';

const log = createLogger('review-service');
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://auth-service:3001';

export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) { res.status(401).json(failure('Authentication required')); return; }
  try {
    const { data } = await axios.get(`${AUTH_SERVICE_URL}/auth/validate`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    (req as any).user = data.data;
    next();
  } catch (err) {
    log.warn({ fn: 'authenticate', tag: 'reviewService_authenticate_tokenValidationFailed', action: 'AUTH_VALIDATE' }, 'Token validation failed against auth-service', { error: err instanceof Error ? err.message : String(err) });
    res.status(401).json(failure('Invalid or expired token'));
  }
};

export const requireRole = (...roles: string[]) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as any).user;
    if (!user || !roles.includes(user.role)) {
      res.status(403).json(failure('Insufficient permissions'));
      return;
    }
    next();
  };
