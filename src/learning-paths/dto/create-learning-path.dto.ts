import { IsString, IsArray, IsNotEmpty } from 'class-validator';

export class CreateLearningPathDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  goal: string;

  @IsArray()
  answers: Record<string, any>[];
}
