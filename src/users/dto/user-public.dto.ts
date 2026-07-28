import { Exclude, Expose } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../entities/user.entity';

@Exclude()
export class UserPublicDto {
  @Expose()
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440001' })
  id: string;

  @Expose()
  @ApiPropertyOptional({ example: 'Jane Smith' })
  displayName?: string;

  @Expose()
  @ApiPropertyOptional({ example: 'https://cdn.teachlink.com/avatars/jane.jpg' })
  avatarUrl?: string;

  @Expose()
  @ApiProperty({ enum: UserRole })
  role: UserRole;
}
