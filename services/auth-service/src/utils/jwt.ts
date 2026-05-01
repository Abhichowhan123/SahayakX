import jwt from 'jsonwebtoken';
import { config } from '../config';

export interface IJwtPayload {
  userId: string;
  role:   string;
  phone:  string;
}

export const signToken = (payload: IJwtPayload): string =>
  jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresIn } as jwt.SignOptions);

export const verifyToken = (token: string): IJwtPayload | null => {
  try {
    return jwt.verify(token, config.jwtSecret) as IJwtPayload;
  } catch {
    return null;
  }
};
