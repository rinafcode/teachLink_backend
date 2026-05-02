import { IsString, IsNotEmpty, IsInt, IsOptional, IsUUID, IsUrl, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Defines the create Lesson payload.
 */
export class CreateLessonDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    title: string;
    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    content?: string;
    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    @IsUrl()
    videoUrl?: string;
    @ApiProperty({ required: false })
    @IsInt()
    @IsOptional()
    @IsNumber()
    order?: number;
    @ApiProperty({ required: false })
    @IsInt()
    @IsOptional()
    @IsNumber()
    durationSeconds?: number;
    @ApiProperty()
    @IsUUID()
    @IsNotEmpty()
    @IsString()
    moduleId: string;
}
