export interface SmsProvider {
  sendOtp(phoneNumber: string, otp: string, message?: string): Promise<void>;
}
