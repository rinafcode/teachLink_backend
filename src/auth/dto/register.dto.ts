import {
  IsEmail,
  IsString,
  IsNotEmpty,
  MinLength,
  MaxLength,
  Matches,
  IsOptional,
  IsUrl,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

/**
 * Defines the user registration payload.
 *
 * Passwords must satisfy complexity requirements (uppercase, lowercase,
 * digit, and special character) to meet the platform's security policy.
 */
export class RegisterDto {
  /**
   * Unique username displayed across the platform.
   * Only letters, numbers, underscores, and hyphens are allowed.
   */
  @ApiProperty({
    example: 'technocrat42',
    description: 'Unique username (3–30 chars, letters / numbers / _ / -)',
  })
  @IsString({ message: 'Username must be a string' })
  @IsNotEmpty({ message: 'Username is required' })
  @MinLength(3, { message: 'Username must be at least 3 characters long' })
  @MaxLength(30, { message: 'Username cannot exceed 30 characters' })
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message: 'Username can only contain letters, numbers, underscores, and hyphens',
  })
  @Transform(({ value }) => value?.trim())
  username: string;

  /**
   * Email address used for login and notifications.
   * Normalised to lowercase automatically.
   */
  @ApiProperty({ example: 'user@teachlink.xyz' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @MaxLength(255, { message: 'Email must not exceed 255 characters' })
  @Transform(({ value }) => value?.toLowerCase().trim())
  email: string;

  /**
   * Account password.
   * Must be 8–100 characters and include at least one uppercase letter,
   * one lowercase letter, one digit, and one special character (@$!%*?&).
   */
  @ApiProperty({
    example: 'Secure@123',
    description: 'Password (8–100 chars, must include upper, lower, digit, special char)',
  })
  @IsString({ message: 'Password must be a string' })
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @MaxLength(100, { message: 'Password cannot exceed 100 characters' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
  })
  password: string;

  /**
   * Optional public display name shown on the user's profile.
   * Defaults to the username when omitted.
   */
  @ApiPropertyOptional({
    example: 'Tech Guru',
    description: 'Public display name (max 60 chars)',
  })
  @IsOptional()
  @IsString({ message: 'Display name must be a string' })
  @MaxLength(60, { message: 'Display name cannot exceed 60 characters' })
  @Transform(({ value }) => value?.trim())
  displayName?: string;

  /**
   * Optional URL to the user's profile avatar.
   */
  @ApiPropertyOptional({
    example: 'https://cdn.teachlink.xyz/avatars/user42.png',
  })
  @IsOptional()
  @IsUrl({}, { message: 'Avatar URL must be a valid URL' })
  @MaxLength(500, { message: 'Avatar URL cannot exceed 500 characters' })
  avatarUrl?: string;
}
