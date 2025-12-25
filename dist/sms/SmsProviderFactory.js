"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmsProviderFactory = void 0;
const LocalSmsProvider_1 = require("./LocalSmsProvider");
// import { TwilioSmsProvider } from './TwilioSmsProvider';
// import { AwsSmsProvider } from './AwsSmsProvider';
class SmsProviderFactory {
    static getProvider() {
        const provider = (process.env.SMS_PROVIDER || 'local').toLowerCase();
        switch (provider) {
            case 'local':
                return new LocalSmsProvider_1.LocalSmsProvider();
            // case 'twilio':
            //   return new TwilioSmsProvider();
            // case 'aws':
            //   return new AwsSmsProvider();
            default:
                throw new Error(`Unknown SMS provider: ${provider}`);
        }
    }
}
exports.SmsProviderFactory = SmsProviderFactory;
