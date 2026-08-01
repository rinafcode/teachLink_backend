import { IsString, IsOptional, IsUUID } from 'class-validator';

export class UpdateRoleDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsUUID(undefined, { each: true })
  @IsOptional()
  permissionIds?: string[];
}
