import { IsEmail, IsString, IsOptional, IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../entities/user.entity';
import { IsStrongPassword } from '../../common/validators/is-strong-password.validator';

export class CreateUserDto {
  @ApiProperty({ example: 'john.doe@example.com' })
  @IsEmail({}, { message: 'Please provide a valid email format' })
  @IsNotEmpty({ message: 'Email cannot be blank' })
  email: string;

  @ApiProperty({ example: 'StrongPass123!' })
  @IsString()
  @IsStrongPassword()
  password: string;

  @ApiProperty({ example: 'John' })
  @IsString({ message: 'First name must be a string' })
  @IsNotEmpty({ message: 'First name is required' })
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  @IsString({ message: 'Last name must be a string' })
  @IsNotEmpty({ message: 'Last name is required' })
  lastName: string;

  @ApiProperty({ enum: UserRole, required: false, default: UserRole.STUDENT })
  @IsOptional()
  @IsEnum(UserRole, { message: 'Invalid user role' })
  role?: UserRole;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString({ message: 'Profile picture must be a valid URL/string' })
  profilePicture?: string;
}
