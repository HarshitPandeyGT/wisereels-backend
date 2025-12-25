"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.otpService = exports.OtpService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const SmsProviderFactory_1 = require("../sms/SmsProviderFactory");
const database_1 = require("../config/database");
const logger_1 = require("../utils/logger");
const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 5;
const OTP_MAX_ATTEMPTS = 3;
const OTP_RATE_LIMIT_SECONDS = 60; // 1 OTP per minute per phone
const OTP_SECRET = process.env.OTP_SECRET || 'wisereels-otp-secret';
class OtpService {
    constructor() {
        this.smsProvider = SmsProviderFactory_1.SmsProviderFactory.getProvider();
    }
    async generateAndSendOtp(phoneNumber) {
        // Rate limit: check last OTP sent
        const lastOtp = await database_1.db.queryOne('SELECT * FROM otps WHERE phone_number = $1 ORDER BY created_at DESC LIMIT 1', [phoneNumber]);
        if (lastOtp && (Date.now() - new Date(lastOtp.created_at).getTime()) < OTP_RATE_LIMIT_SECONDS * 1000) {
            throw new Error('OTP recently sent. Please wait before requesting again.');
        }
        // Generate OTP
        const otp = this.generateOtp();
        const otpHash = this.hashOtp(otp);
        const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
        // Store OTP (hashed)
        await database_1.db.query('INSERT INTO otps (phone_number, otp_hash, expires_at, attempts, created_at) VALUES ($1, $2, $3, $4, $5)', [phoneNumber, otpHash, expiresAt, 0, new Date()]);
        // Send OTP
        await this.smsProvider.sendOtp(phoneNumber, otp);
        logger_1.logger.info(`OTP sent to ${phoneNumber}`);
    }
    async verifyOtp(phoneNumber, otp) {
        const record = await database_1.db.queryOne('SELECT * FROM otps WHERE phone_number = $1 ORDER BY created_at DESC LIMIT 1', [phoneNumber]);
        if (!record)
            throw new Error('No OTP found for this number');
        if (record.attempts >= OTP_MAX_ATTEMPTS)
            throw new Error('Max OTP attempts exceeded');
        if (new Date() > new Date(record.expires_at))
            throw new Error('OTP expired');
        const isValid = this.hashOtp(otp) === record.otp_hash;
        // Increment attempts
        await database_1.db.query('UPDATE otps SET attempts = attempts + 1 WHERE phone_number = $1 AND created_at = $2', [phoneNumber, record.created_at]);
        if (!isValid)
            throw new Error('Invalid OTP');
        return true;
    }
    generateOtp() {
        return (Math.floor(100000 + Math.random() * 900000)).toString();
    }
    hashOtp(otp) {
        return crypto_1.default.createHmac('sha256', OTP_SECRET).update(otp).digest('hex');
    }
}
exports.OtpService = OtpService;
exports.otpService = new OtpService();
