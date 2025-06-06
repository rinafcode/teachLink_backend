import { PartialType } from "@nestjs/mapped-types"
import { CreateEnrollmentDto } from "./create-enrollment.dto"
import { IsNumber, IsString, IsOptional, Min, Max } from "class-validator"

export class UpdateEnrollmentDto extends PartialType(CreateEnrollmentDto) {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  progress?: number

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  rating?: number

  @IsOptional()
  @IsString()
  review?: string
}
