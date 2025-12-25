import { SmsProvider } from './SmsProvider';
import { LocalSmsProvider } from './LocalSmsProvider';
// import { TwilioSmsProvider } from './TwilioSmsProvider';
// import { AwsSmsProvider } from './AwsSmsProvider';

export class SmsProviderFactory {
  static getProvider(): SmsProvider {
    const provider = (process.env.SMS_PROVIDER || 'local').toLowerCase();
    switch (provider) {
      case 'local':
        return new LocalSmsProvider();
      // case 'twilio':
      //   return new TwilioSmsProvider();
      // case 'aws':
      //   return new AwsSmsProvider();
      default:
        throw new Error(`Unknown SMS provider: ${provider}`);
    }
  }
}
