import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID, IsObject } from 'class-validator';
import { UpdateUserDto } from './update-user.dto';

export class BulkUpdateUsersDto {
  @ApiProperty({ type: [String], description: 'List of user IDs to update' })
  @IsUUID('all', { each: true })
  @IsNotEmpty({ each: true })
  ids: string[];

  @ApiProperty({ type: UpdateUserDto, description: 'Common update data' })
  @IsObject()
  @IsNotEmpty()
  data: UpdateUserDto;
}

export class BulkDeleteUsersDto {
  @ApiProperty({ type: [String], description: 'List of user IDs to delete' })
  @IsUUID('all', { each: true })
  @IsNotEmpty({ each: true })
  ids: string[];
}
