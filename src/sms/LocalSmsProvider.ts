import axios from 'axios';
import { SmsProvider } from './SmsProvider';

export class LocalSmsProvider implements SmsProvider {
  async sendOtp(phoneNumber: string, otp: string, message?: string): Promise<void> {
    // Example: Fast2SMS/2Factor/MSG91 style API (replace with real API details)
    const apiKey = process.env.LOCAL_SMS_API_KEY;
    const senderId = process.env.LOCAL_SMS_SENDER_ID || 'WISERL';
    const text = message || `Your WiseReels OTP is ${otp}`;
    // Example endpoint (replace with actual):
    const url = process.env.LOCAL_SMS_API_URL || 'https://api.example.com/send';
    try {
      await axios.post(url, {
        api_key: apiKey,
        sender_id: senderId,
        to: phoneNumber,
        message: text,
        template_id: process.env.LOCAL_SMS_TEMPLATE_ID,
      });
    } catch (err) {
      throw new Error('Failed to send OTP via Local SMS provider');
    }
  }
}
