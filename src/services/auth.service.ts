import { db } from '../config/database';
import { jwtService } from '../config/jwt';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

export interface User {
  id: string;
  phone_number: string;
  username: string;
  email?: string;
  display_name: string;
  profile_picture_url?: string;
  account_status: 'ACTIVE' | 'SUSPENDED' | 'DELETED';
  account_created_at: Date;
}

class AuthService {
  async savePendingRegistration({ phoneNumber, username, displayName, firstName, lastName, email }: any): Promise<void> {
    await db.query(
      `INSERT INTO pending_registrations (phone_number, username, display_name, first_name, last_name, email, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (phone_number) DO UPDATE SET username = $2, display_name = $3, first_name = $4, last_name = $5, email = $6, created_at = $7`,
      [phoneNumber, username, displayName, firstName, lastName, email, new Date()]
    );
  }

  async getPendingRegistration(phoneNumber: string): Promise<any | null> {
    return db.queryOne(
      `SELECT * FROM pending_registrations WHERE phone_number = $1`,
      [phoneNumber]
    );
  }

  async deletePendingRegistration(phoneNumber: string): Promise<void> {
    await db.query(
      `DELETE FROM pending_registrations WHERE phone_number = $1`,
      [phoneNumber]
    );
  }

  async registerUser(phoneNumber: string, username: string, displayName: string, firstName?: string, lastName?: string, email?: string): Promise<User> {
    // Check for unique username
    const existingUsername = await db.queryOne<User>(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );
    if (existingUsername) {
      throw new Error('Username already taken');
    }
    const userId = uuidv4();
    const now = new Date();
    const query = `
      INSERT INTO users (
        id, phone_number, username, display_name, first_name, last_name, email, account_status, account_created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;
    try {
      const user = await db.queryOne<User>(query, [
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

      if (!user) throw new Error('User creation failed');

      // Initialize wallet
      await this.initializeWallet(userId);

      logger.info(`User registered: ${userId}`);
      return user;
    } catch (error) {
      logger.error('User registration failed', error);
      throw error;
    }
  }

  async getUserByPhone(phoneNumber: string): Promise<User | null> {
    const query = `SELECT * FROM users WHERE phone_number = $1`;
    return db.queryOne<User>(query, [phoneNumber]);
  }

  async getUserById(userId: string): Promise<User | null> {
    const query = `SELECT * FROM users WHERE id = $1`;
    return db.queryOne<User>(query, [userId]);
  }

  async getUserByUsername(username: string): Promise<User | null> {
    const query = `SELECT * FROM users WHERE username = $1`;
    return db.queryOne<User>(query, [username]);
  }

  async generateAuthToken(userId: string, role: string = 'USER'): Promise<string> {
    return jwtService.generateToken({
      userId,
      role: role as 'USER' | 'CREATOR' | 'ADMIN',
    });
  }

  private async initializeWallet(userId: string): Promise<void> {
    const query = `
      INSERT INTO wallet (user_id, pending_points, available_points, total_earned, total_redeemed, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6)
    `;

    await db.query(query, [
      userId,
      0,
      0,
      0,
      0,
      new Date(),
    ]);
  }
}

export const authService = new AuthService();
