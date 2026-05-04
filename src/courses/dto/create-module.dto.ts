import { IsString, IsNotEmpty, IsInt, IsOptional, IsUUID, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Defines the create Module payload.
 */
export class CreateModuleDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    title: string;
    @ApiProperty({ required: false })
    @IsInt()
    @IsOptional()
    @IsNumber()
    order?: number;
    @ApiProperty()
    @IsUUID()
    @IsNotEmpty()
    @IsString()
    courseId: string;
}
