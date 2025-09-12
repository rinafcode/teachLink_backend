import { IsNotEmpty, IsString, IsOptional, IsNumber } from 'class-validator';

export class CreateModuleDto {
  @IsNotEmpty()
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNotEmpty()
  @IsNumber()
  order: number;

  @IsNotEmpty()
  @IsString()
  courseId: string;
}
