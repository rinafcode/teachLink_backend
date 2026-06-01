import { IsOptional, IsString, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';


export class GetUsersDto extends PaginationQueryDto {

  @ApiPropertyOptional({
    example: 'active',
    description: 'Filter by account status',
    enum: ['active', 'inactive', 'suspended', 'pending'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['active', 'inactive', 'suspended', 'pending'], {
    message: 'status must be one of: active, inactive, suspended, pending',
  })
  status?: string;

  /**
   * Filter users by assigned role.
   * Must be one of the recognised platform roles.
   */
  @ApiPropertyOptional({
    example: 'student',
    description: 'Filter by user role',
    enum: ['student', 'instructor', 'admin', 'moderator'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['student', 'instructor', 'admin', 'moderator'], {
    message: 'role must be one of: student, instructor, admin, moderator',
  })
  role?: string;
}