import { PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MinLength, IsEmail } from 'class-validator';
import { CreateUserDto } from './create-user.dto';

/**
 * Defines the update User payload.
 */
export class UpdateUserDto extends PartialType(CreateUserDto) {
  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @IsOptional()
  @IsBoolean()
  @IsEmail()
  isEmailVerified?: boolean;
}
