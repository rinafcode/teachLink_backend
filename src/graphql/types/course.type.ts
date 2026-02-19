import { ObjectType, Field, ID, Float } from '@nestjs/graphql';
import { UserType } from './user.type';

@ObjectType()
export class CourseType {
  @Field(() => ID)
  id: string;

  @Field()
  title: string;

  @Field()
  description: string;

  @Field(() => Float)
  price: number;

  @Field()
  status: string;

  @Field({ nullable: true })
  thumbnailUrl?: string;

  @Field(() => UserType, { nullable: true })
  instructor?: UserType;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
