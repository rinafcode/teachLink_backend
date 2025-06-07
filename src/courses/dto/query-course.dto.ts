import { IsOptional, IsString, IsBoolean, IsNumber } from "class-validator"

export class QueryCourseDto {
  @IsOptional()
  @IsString()
  search?: string

  @IsOptional()
  @IsString()
  level?: string

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean

  @IsOptional()
  @IsString()
  instructorId?: string

  @IsOptional()
  @IsNumber()
  minPrice?: number

  @IsOptional()
  @IsNumber()
  maxPrice?: number

  @IsOptional()
  @IsNumber()
  page?: number = 1

  @IsOptional()
  @IsNumber()
  limit?: number = 10

  @IsOptional()
  @IsString()
  sortBy?: string = "createdAt"

  @IsOptional()
  @IsString()
  sortOrder?: "ASC" | "DESC" = "DESC"
}
