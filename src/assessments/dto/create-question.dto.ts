import { IsString, IsOptional, IsEnum, IsNumber, IsArray, ValidateNested, Min } from "class-validator"
import { Type } from "class-transformer"
import { ApiProperty } from "@nestjs/swagger"
import { QuestionType, QuestionDifficulty } from "../entities/question.entity"
import { CreateQuestionOptionDto } from "./ate-question-option.dto"

export class CreateQuestionDto {
  @ApiProperty({ enum: QuestionType, example: QuestionType.MULTIPLE_CHOICE })
  @IsEnum(QuestionType)
  type: QuestionType

  @ApiProperty({ example: "What is the correct way to declare a variable in JavaScript?" })
  @IsString()
  questionText: string

  @ApiProperty({ example: "Variables can be declared using var, let, or const keywords", required: false })
  @IsOptional()
  @IsString()
  explanation?: string

  @ApiProperty({ example: 2, description: "Points awarded for correct answer" })
  @IsOptional()
  @IsNumber()
  @Min(0)
  points?: number

  @ApiProperty({ enum: QuestionDifficulty, example: QuestionDifficulty.MEDIUM })
  @IsOptional()
  @IsEnum(QuestionDifficulty)
  difficulty?: QuestionDifficulty

  @ApiProperty({ example: 0, description: "Order of question in assessment" })
  @IsOptional()
  @IsNumber()
  @Min(0)
  orderIndex?: number

  @ApiProperty({ example: {}, description: "Additional metadata for question", required: false })
  @IsOptional()
  metadata?: Record<string, any>

  @ApiProperty({ type: [CreateQuestionOptionDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateQuestionOptionDto)
  options?: CreateQuestionOptionDto[]
}
