import { IsString, IsBoolean, IsOptional, IsNumber, Min } from "class-validator"
import { ApiProperty } from "@nestjs/swagger"

export class CreateQuestionOptionDto {
  @ApiProperty({ example: "let variableName = value;" })
  @IsString()
  optionText: string

  @ApiProperty({ example: true, description: "Whether this option is correct" })
  @IsBoolean()
  isCorrect: boolean

  @ApiProperty({ example: 0, description: "Order of option in question" })
  @IsOptional()
  @IsNumber()
  @Min(0)
  orderIndex?: number

  @ApiProperty({ example: "This is the modern way to declare variables", required: false })
  @IsOptional()
  @IsString()
  explanation?: string
}
