"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authService = void 0;
const database_1 = require("../config/database");
const jwt_1 = require("../config/jwt");
const uuid_1 = require("uuid");
const logger_1 = require("../utils/logger");
class AuthService {
    async savePendingRegistration({ phoneNumber, username, displayName, firstName, lastName, email }) {
        await database_1.db.query(`INSERT INTO pending_registrations (phone_number, username, display_name, first_name, last_name, email, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (phone_number) DO UPDATE SET username = $2, display_name = $3, first_name = $4, last_name = $5, email = $6, created_at = $7`, [phoneNumber, username, displayName, firstName, lastName, email, new Date()]);
    }
    async getPendingRegistration(phoneNumber) {
        return database_1.db.queryOne(`SELECT * FROM pending_registrations WHERE phone_number = $1`, [phoneNumber]);
    }
    async deletePendingRegistration(phoneNumber) {
        await database_1.db.query(`DELETE FROM pending_registrations WHERE phone_number = $1`, [phoneNumber]);
    }
    async registerUser(phoneNumber, username, displayName, firstName, lastName, email) {
        // Check for unique username
        const existingUsername = await database_1.db.queryOne('SELECT * FROM users WHERE username = $1', [username]);
        if (existingUsername) {
            throw new Error('Username already taken');
        }
        const userId = (0, uuid_1.v4)();
        const now = new Date();
        const query = `
      INSERT INTO users (
        id, phone_number, username, display_name, first_name, last_name, email, account_status, account_created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;
        try {
            const user = await database_1.db.queryOne(query, [
                userId,
                phoneNumber,
                username,
                displayName,
                firstName,
                lastName,
                email,
                'ACTIVE',
                now,
                now,
            ]);
            if (!user)
                throw new Error('User creation failed');
            // Initialize wallet
            await this.initializeWallet(userId);
            logger_1.logger.info(`User registered: ${userId}`);
            return user;
        }
        catch (error) {
            logger_1.logger.error('User registration failed', error);
            throw error;
        }
    }
    async getUserByPhone(phoneNumber) {
        const query = `SELECT * FROM users WHERE phone_number = $1`;
        return database_1.db.queryOne(query, [phoneNumber]);
    }
    async getUserById(userId) {
        const query = `SELECT * FROM users WHERE id = $1`;
        return database_1.db.queryOne(query, [userId]);
    }
    async getUserByUsername(username) {
        const query = `SELECT * FROM users WHERE username = $1`;
        return database_1.db.queryOne(query, [username]);
    }
    async generateAuthToken(userId, role = 'USER') {
        return jwt_1.jwtService.generateToken({
            userId,
            role: role,
        });
    }
    async initializeWallet(userId) {
        const query = `
      INSERT INTO wallet (user_id, pending_points, available_points, total_earned, total_redeemed, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6)
    `;
        await database_1.db.query(query, [
            userId,
            0,
            0,
            0,
            0,
            new Date(),
        ]);
    }
}
exports.authService = new AuthService();
