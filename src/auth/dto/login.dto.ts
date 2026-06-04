import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

/**
 * Defines the login payload.
 *
 * Email is normalised to lowercase so "User@Example.com" and
 * "user@example.com" resolve to the same account.
 */
export class LoginDto {
    /**
     * The registered email address for this account.
     */
    @ApiProperty({ example: 'user@teachlink.xyz' })
    @IsEmail({}, { message: 'Please provide a valid email address' })
    @MaxLength(255, { message: 'Email must not exceed 255 characters' })
    @Transform(({ value }) => value?.toLowerCase().trim())
    email: string;

    /**
     * The account password. Minimum 8 characters.
     */
    @ApiProperty({ example: 'Secure@123', minLength: 8 })
    @IsString({ message: 'Password must be a string' })
    @MinLength(8, { message: 'Password must be at least 8 characters' })
    @MaxLength(100, { message: 'Password must not exceed 100 characters' })
    password: string;
}