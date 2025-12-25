"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.jwtService = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
class JWTService {
    constructor() {
        this.secret = process.env.JWT_SECRET || 'your-secret-key';
        this.expiry = process.env.JWT_EXPIRY || '7d';
    }
    generateToken(payload) {
        return jsonwebtoken_1.default.sign(payload, this.secret, {
            expiresIn: this.expiry,
        });
    }
    verifyToken(token) {
        return jsonwebtoken_1.default.verify(token, this.secret);
    }
    decodeToken(token) {
        return jsonwebtoken_1.default.decode(token);
    }
}
exports.jwtService = new JWTService();
