"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isPointsExpired = exports.getDateAfterDays = exports.calculatePoints = exports.maskUPI = exports.maskPhoneNumber = exports.generateRefreshToken = exports.generateHash = void 0;
const crypto_1 = __importDefault(require("crypto"));
const generateHash = (data) => {
    return crypto_1.default.createHash('sha256').update(data).digest('hex');
};
exports.generateHash = generateHash;
const generateRefreshToken = () => {
    return crypto_1.default.randomBytes(32).toString('hex');
};
exports.generateRefreshToken = generateRefreshToken;
const maskPhoneNumber = (phoneNumber) => {
    return phoneNumber.slice(0, -4).padEnd(phoneNumber.length, '*');
};
exports.maskPhoneNumber = maskPhoneNumber;
const maskUPI = (upiId) => {
    const [username, provider] = upiId.split('@');
    return `${username.substring(0, 2)}****@${provider}`;
};
exports.maskUPI = maskUPI;
const calculatePoints = (watchDurationSeconds, ratePerTenMinutes) => {
    // Points = (watch_duration / 600) * rate
    return Math.floor((watchDurationSeconds / 600) * ratePerTenMinutes);
};
exports.calculatePoints = calculatePoints;
const getDateAfterDays = (days) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date;
};
exports.getDateAfterDays = getDateAfterDays;
const isPointsExpired = (expiresAt) => {
    return new Date() > expiresAt;
};
exports.isPointsExpired = isPointsExpired;
