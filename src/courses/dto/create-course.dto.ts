import { IsString, IsNotEmpty, IsNumber, IsOptional, MinLength, MaxLength, Min, } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
export class CreateCourseDto {
    @ApiProperty()
    @IsString({ message: 'Title must be a string' })
    @IsNotEmpty({ message: 'Course title is required' })
    @MinLength(5, { message: 'Title must be at least 5 characters long' })
    @MaxLength(100, { message: 'Title cannot exceed 100 characters' })
    title: string;
    @ApiProperty()
    @IsString({ message: 'Description must be a string' })
    @IsNotEmpty({ message: 'Course description is required' })
    @MinLength(20, { message: 'Description must be at least 20 characters long' })
    @MaxLength(5000, { message: 'Description is too long' })
    description: string;
    @ApiProperty({ required: false })
    @IsNumber({}, { message: 'Price must be a valid number' })
    @Min(0, { message: 'Price cannot be negative' })
    @IsOptional()
    price?: number;
    @ApiProperty({ required: false })
    @IsString({ message: 'Thumbnail URL must be a valid string' })
    @IsOptional()
    thumbnailUrl?: string;
}
