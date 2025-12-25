import jwt from 'jsonwebtoken';

export interface JWTPayload {
  userId: string;
  email?: string;
  role: 'USER' | 'CREATOR' | 'ADMIN';
  iat?: number;
  exp?: number;
}

class JWTService {
  private secret = process.env.JWT_SECRET || 'your-secret-key';
  private expiry = process.env.JWT_EXPIRY || '7d';

  generateToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
    return jwt.sign(payload, this.secret, {
      expiresIn: this.expiry,
    } as any);
  }

  verifyToken(token: string): JWTPayload {
    return jwt.verify(token, this.secret) as JWTPayload;
  }

  decodeToken(token: string): JWTPayload | null {
    return jwt.decode(token) as JWTPayload | null;
  }
}

export const jwtService = new JWTService();
