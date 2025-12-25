import crypto from 'crypto';
import { SmsProviderFactory } from '../sms/SmsProviderFactory';
import { db } from '../config/database';
import { logger } from '../utils/logger';

const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 5;
const OTP_MAX_ATTEMPTS = 3;
const OTP_RATE_LIMIT_SECONDS = 60; // 1 OTP per minute per phone
const OTP_SECRET = process.env.OTP_SECRET || 'wisereels-otp-secret';

export interface OtpRecord {
  phone_number: string;
  otp_hash: string;
  expires_at: Date;
  attempts: number;
  created_at: Date;
}

export class OtpService {
  private smsProvider = SmsProviderFactory.getProvider();

  async generateAndSendOtp(phoneNumber: string): Promise<void> {
    // Rate limit: check last OTP sent
    const lastOtp = await db.queryOne<OtpRecord>(
      'SELECT * FROM otps WHERE phone_number = $1 ORDER BY created_at DESC LIMIT 1',
      [phoneNumber]
    );
    if (lastOtp && (Date.now() - new Date(lastOtp.created_at).getTime()) < OTP_RATE_LIMIT_SECONDS * 1000) {
      throw new Error('OTP recently sent. Please wait before requesting again.');
    }
    // Generate OTP
    const otp = this.generateOtp();
    const otpHash = this.hashOtp(otp);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
    // Store OTP (plain and hashed)
    await db.query(
      'INSERT INTO otps (phone_number, otp_code, otp_hash, expires_at, attempts, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
      [phoneNumber, otp, otpHash, expiresAt, 0, new Date()]
    );
    // Send OTP
    await this.smsProvider.sendOtp(phoneNumber, otp);
    logger.info(`OTP sent to ${phoneNumber}`);
  }

  async verifyOtp(phoneNumber: string, otp: string): Promise<boolean> {
    const record = await db.queryOne<OtpRecord>(
      'SELECT * FROM otps WHERE phone_number = $1 ORDER BY created_at DESC LIMIT 1',
      [phoneNumber]
    );
    if (!record) throw new Error('No OTP found for this number');
    if (record.attempts >= OTP_MAX_ATTEMPTS) throw new Error('Max OTP attempts exceeded');
    if (new Date() > new Date(record.expires_at)) throw new Error('OTP expired');
    const isValid = this.hashOtp(otp) === record.otp_hash;
    // Increment attempts
    await db.query('UPDATE otps SET attempts = attempts + 1 WHERE phone_number = $1 AND created_at = $2', [phoneNumber, record.created_at]);
    if (!isValid) throw new Error('Invalid OTP');
    return true;
  }

  private generateOtp(): string {
    return (Math.floor(100000 + Math.random() * 900000)).toString();
  }

  private hashOtp(otp: string): string {
    return crypto.createHmac('sha256', OTP_SECRET).update(otp).digest('hex');
  }
}

export const otpService = new OtpService();
