import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import {
  RegisterDto,
  LoginDto,
  ResetPasswordDto,
  UpdatePasswordDto,
} from './dto/auth.dto';
import { ConfigService } from '@nestjs/config';
import { User } from '../users/entities/user.entity';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwt: JwtService,
    private configService: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const hashedPassword = await bcrypt.hash(dto.password, 12);
    const user = await this.usersService.create({
      ...dto,
      password: hashedPassword,
    });
    const tokens = await this.generateTokens(user.id, user.role);
    await this.usersService.updateRefreshToken(user.id, tokens.refresh_token);
    return tokens;
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user || !(await bcrypt.compare(dto.password, user.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const tokens = await this.generateTokens(user.id, user.role);
    await this.usersService.updateRefreshToken(user.id, tokens.refresh_token);
    return tokens;
  }

  async logout(userId: string) {
    return this.usersService.removeRefreshToken(userId);
  }

  async refreshTokens(userId: string, refreshToken: string) {
    const user = await this.usersService.findById(userId);
    if (!user || user.refreshToken !== refreshToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const tokens = await this.generateTokens(user.id, user.role);
    await this.usersService.updateRefreshToken(user.id, tokens.refresh_token);
    return tokens;
  }

  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      // Don't reveal that the email doesn't exist
      return {
        message:
          'If an account exists, a password reset link has been sent to your email',
      };
    }

    const resetToken = this.jwt.sign(
      { sub: user.id, type: 'password_reset' },
      {
        secret: this.configService.get('JWT_SECRET'),
        expiresIn: '1h',
      },
    );

    // TODO: Implement email sending service
    // For now, we'll just return the token
    return {
      message: 'Password reset link has been sent to your email',
      token: resetToken, // Remove this in production
    };
  }

  async updatePassword(dto: UpdatePasswordDto) {
    try {
      const payload = this.jwt.verify(dto.token, {
        secret: this.configService.get('JWT_SECRET'),
      });

      if (payload.type !== 'password_reset') {
        throw new BadRequestException('Invalid token type');
      }

      const hashedPassword = await bcrypt.hash(dto.newPassword, 12);
      await this.usersService.updatePassword(payload.sub, hashedPassword);
      await this.usersService.removeRefreshToken(payload.sub);

      return { message: 'Password updated successfully' };
    } catch (error) {
      throw new BadRequestException('Invalid or expired token');
    }
  }

  private async generateTokens(userId: string, role: string) {
    const payload = { sub: userId, role };
    const [access_token, refresh_token] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: this.configService.get('JWT_SECRET'),
        expiresIn: '15m',
      }),
      this.jwt.signAsync(payload, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
        expiresIn: '7d',
      }),
    ]);

    return { access_token, refresh_token };
  }
}
