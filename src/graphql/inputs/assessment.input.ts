import { InputType, Field, Int } from '@nestjs/graphql';
import { IsString, IsNumber, IsOptional, IsArray, Min } from 'class-validator';

@InputType()
export class QuestionInput {
  @Field()
  @IsString()
  prompt: string;

  @Field()
  @IsString()
  type: string;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  options?: string[];

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  correctAnswer?: string;

  @Field(() => Int)
  @IsNumber()
  @Min(1)
  points: number;
}

@InputType()
export class CreateAssessmentInput {
  @Field()
  @IsString()
  title: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;

  @Field(() => Int)
  @IsNumber()
  @Min(1)
  durationMinutes: number;

  @Field(() => [QuestionInput])
  @IsArray()
  questions: QuestionInput[];
}

@InputType()
export class UpdateAssessmentInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  title?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(1)
  durationMinutes?: number;
}
