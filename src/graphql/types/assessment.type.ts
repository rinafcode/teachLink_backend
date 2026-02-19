import { ObjectType, Field, ID, Int } from '@nestjs/graphql';

@ObjectType()
export class QuestionType {
  @Field(() => ID)
  id: string;

  @Field()
  prompt: string;

  @Field()
  type: string;

  @Field(() => [String], { nullable: 'itemsAndList' })
  options?: string[];

  @Field({ nullable: true })
  correctAnswer?: string;

  @Field(() => Int)
  points: number;
}

@ObjectType()
export class AssessmentType {
  @Field(() => ID)
  id: string;

  @Field()
  title: string;

  @Field({ nullable: true })
  description?: string;

  @Field(() => Int)
  durationMinutes: number;

  @Field(() => [QuestionType], { nullable: 'itemsAndList' })
  questions?: QuestionType[];

  @Field()
  createdAt: Date;
}
