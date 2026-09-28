import { Exclude, Expose } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { UserStatus } from '../entities/user.entity';
import { UserPublicDto } from './user-public.dto';

@Exclude()
export class UserAdminDto extends UserPublicDto {
  @Expose()
  @ApiProperty({ example: 'jane.smith@example.com' })
  email: string;

  @Expose()
  @ApiProperty({ enum: UserStatus })
  status: UserStatus;

  @Expose()
  @ApiProperty({ example: true })
  isEmailVerified: boolean;
}
