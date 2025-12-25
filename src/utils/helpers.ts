import crypto from 'crypto';

export const generateHash = (data: string): string => {
  return crypto.createHash('sha256').update(data).digest('hex');
};

export const generateRefreshToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

export const maskPhoneNumber = (phoneNumber: string): string => {
  return phoneNumber.slice(0, -4).padEnd(phoneNumber.length, '*');
};

export const maskUPI = (upiId: string): string => {
  const [username, provider] = upiId.split('@');
  return `${username.substring(0, 2)}****@${provider}`;
};

export const calculatePoints = (
  watchDurationSeconds: number,
  ratePerTenMinutes: number
): number => {
  // Points = (watch_duration / 600) * rate
  return Math.floor((watchDurationSeconds / 600) * ratePerTenMinutes);
};

export const getDateAfterDays = (days: number): Date => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
};

export const isPointsExpired = (expiresAt: Date): boolean => {
  return new Date() > expiresAt;
};
