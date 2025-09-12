import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import type { UserService } from './user.service';
import type { User } from '../entities/user.entity';
import * as bcrypt from 'bcryptjs';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string): Promise<User | null> {
    try {
      const user = await this.userService.findByEmail(email);

      if (!user || !user.isActive) {
        return null;
      }

      const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
      if (!isPasswordValid) {
        return null;
      }

      return user;
    } catch (error) {
      return null;
    }
  }

  async login(
    user: User,
  ): Promise<{ access_token: string; refresh_token: string }> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: '15m', // Short-lived access token
    });

    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: '7d', // Longer-lived refresh token
      secret: process.env.JWT_REFRESH_SECRET || 'refresh-secret',
    });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

  async generateToken(user: User): Promise<string> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    return this.jwtService.sign(payload);
  }

  async refreshToken(refreshToken: string): Promise<{ access_token: string }> {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET || 'refresh-secret',
      });

      const user = await this.userService.findById(payload.sub);
      if (!user || !user.isActive) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const newAccessToken = await this.generateToken(user);
      return { access_token: newAccessToken };
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async validateJwtPayload(payload: JwtPayload): Promise<User> {
    const user = await this.userService.findById(payload.sub);

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    return user;
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.userService.findById(userId);

    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      user.passwordHash,
    );
    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    await this.userService.updateProfile(userId, {
      passwordHash: hashedNewPassword,
    });
  }

  async resetPassword(email: string): Promise<{ message: string }> {
    try {
      const user = await this.userService.findByEmail(email);

      // In a real implementation, you would:
      // 1. Generate a secure reset token
      // 2. Store it in the database with expiration
      // 3. Send email with reset link

      // For demo purposes, just return success
      return { message: 'Password reset instructions sent to email' };
    } catch (error) {
      // Don't reveal if email exists or not for security
      return { message: 'Password reset instructions sent to email' };
    }
  }

  async verifyResetToken(token: string): Promise<boolean> {
    // In a real implementation, verify the reset token from database
    // For demo, always return false
    return false;
  }

  async updatePasswordWithResetToken(
    token: string,
    newPassword: string,
  ): Promise<void> {
    const isValidToken = await this.verifyResetToken(token);
    if (!isValidToken) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    // In a real implementation:
    // 1. Find user by reset token
    // 2. Update password
    // 3. Invalidate reset token
  }
}
