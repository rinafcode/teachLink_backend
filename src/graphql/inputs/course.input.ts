import { InputType, Field, Float } from '@nestjs/graphql';
import { IsString, IsNumber, IsOptional, Min } from 'class-validator';

@InputType()
export class CreateCourseInput {
  @Field()
  @IsString()
  title: string;

  @Field()
  @IsString()
  description: string;

  @Field(() => Float)
  @IsNumber()
  @Min(0)
  price: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  thumbnailUrl?: string;

  @Field()
  @IsString()
  instructorId: string;
}

@InputType()
export class UpdateCourseInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  title?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  status?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  thumbnailUrl?: string;
}

@InputType()
export class CourseFilterInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  status?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  instructorId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  search?: string;
}
