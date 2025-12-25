import { Response } from 'express';
import { authService } from '../services/auth.service';
import { creatorService } from '../services/creator.service';
import { jwtService } from '../config/jwt';
import { AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { otpService } from '../services/otp.service';

export const registerUser = async (req: AuthRequest, res: Response) => {
  try {
    const { phoneNumber, username, displayName, firstName, lastName, email } = req.body;
    if (!phoneNumber || !username || !displayName) {
      throw new AppError(400, 'Phone number, username, and display name are required');
    }
    // Check if user exists in main users table
    const existingUser = await authService.getUserByPhone(phoneNumber);
    if (existingUser) {
      throw new AppError(409, 'User already registered with this phone number');
    }
    // Check if username exists in main users table
    const existingUsername = await authService.getUserByUsername(username);
    if (existingUsername) {
      throw new AppError(409, 'Username already taken');
    }
    // Store in pending_registrations
    await authService.savePendingRegistration({
      phoneNumber, username, displayName, firstName, lastName, email
    });
    // Send OTP
    await otpService.generateAndSendOtp(phoneNumber);
    res.status(200).json({
      success: true,
      message: 'Registration info received. OTP sent to phone number.'
    });
  } catch (error) {
    logger.error('Registration error', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message || 'Registration failed',
    });
  }
};

export const verifyOtpAndRegister = async (req: AuthRequest, res: Response) => {
  try {
    const { phoneNumber, otp } = req.body;
    if (!phoneNumber || !otp) {
      throw new AppError(400, 'Phone number and OTP are required');
    }
    // Verify OTP
    await otpService.verifyOtp(phoneNumber, otp);
    // Get pending registration
    const pending = await authService.getPendingRegistration(phoneNumber);
    if (!pending) throw new AppError(404, 'No pending registration found');
    // Finalize user creation
    const user = await authService.registerUser(
      pending.phone_number,
      pending.username,
      pending.display_name,
      pending.first_name,
      pending.last_name,
      pending.email
    );
    // Remove from pending_registrations
    await authService.deletePendingRegistration(phoneNumber);
    // Initialize creator profile
    await creatorService.initializeCreator(user.id);
    // Generate token
    const token = await authService.generateAuthToken(user.id, 'USER');
    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: { user, token },
    });
  } catch (error) {
    logger.error('OTP verification/registration error', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message || 'OTP verification/registration failed',
    });
  }
};

export const loginUser = async (req: AuthRequest, res: Response) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      throw new AppError(400, 'Phone number is required');
    }

    const user = await authService.getUserByPhone(phoneNumber);
    if (!user) {
      throw new AppError(404, 'User not found');
    }

    const token = await authService.generateAuthToken(user.id, 'USER');

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user,
        token,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        error: error.message,
      });
    } else {
      logger.error('Login error', error);
      res.status(500).json({
        success: false,
        error: 'Login failed',
      });
    }
  }
};

export const verifyToken = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      throw new AppError(401, 'Invalid token');
    }

    const user = await authService.getUserById(req.user.userId);
    if (!user) {
      throw new AppError(404, 'User not found');
    }

    res.json({
      success: true,
      data: {
        user,
        role: req.user.role,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        error: error.message,
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Token verification failed',
      });
    }
  }
};

export const sendOtp = async (req: AuthRequest, res: Response) => {
  try {
    const { phoneNumber } = req.body;
    if (!phoneNumber) throw new AppError(400, 'Phone number is required');
    await otpService.generateAndSendOtp(phoneNumber);
    res.json({ success: true, message: 'OTP sent successfully' });
  } catch (error) {
    logger.error('Send OTP error', error);
    res.status(500).json({ success: false, error: (error as Error).message || 'Failed to send OTP' });
  }
};
