import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

/**
 * Defines the get Users payload.
 */
export class GetUsersDto extends PaginationQueryDto {
    @IsOptional()
    @IsString()
    status?: string;
    @IsOptional()
    @IsString()
    role?: string;
}
