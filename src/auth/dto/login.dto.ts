import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail() email: string;
  @MinLength(6) password: string;
  @IsNotEmpty() role: string;
}

export class LoginDto {
  @IsEmail() email: string;
  @MinLength(6) password: string;
}

export class ResetPasswordDto {
  @IsEmail() email: string;
}
