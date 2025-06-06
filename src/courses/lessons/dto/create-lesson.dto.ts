import { IsNotEmpty, IsString, IsOptional, IsNumber, IsEnum, IsObject } from "class-validator"
import { LessonType } from "../entities/lesson.entity"

export class CreateLessonDto {
  @IsNotEmpty()
  @IsString()
  title: string

  @IsOptional()
  @IsString()
  description?: string

  @IsNotEmpty()
  @IsEnum(LessonType)
  type: LessonType

  @IsOptional()
  @IsObject()
  content?: any

  @IsNotEmpty()
  @IsNumber()
  order: number

  @IsOptional()
  @IsNumber()
  duration?: number

  @IsNotEmpty()
  @IsString()
  moduleId: string
}
