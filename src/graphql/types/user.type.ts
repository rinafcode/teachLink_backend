import { ObjectType, Field, ID, registerEnumType } from '@nestjs/graphql';
import { UserRole, UserStatus } from '../../users/entities/user.entity';
import { CourseType } from './course.type';

registerEnumType(UserRole, {
  name: 'UserRole',
  description: 'User role in the system',
});

registerEnumType(UserStatus, {
  name: 'UserStatus',
  description: 'User account status',
});

@ObjectType()
export class UserType {
  @Field(() => ID)
  id: string;

  @Field()
  email: string;

  @Field({ nullable: true })
  username?: string;

  @Field()
  firstName: string;

  @Field()
  lastName: string;

  @Field(() => UserRole)
  role: UserRole;

  @Field(() => UserStatus)
  status: UserStatus;

  @Field({ nullable: true })
  tenantId?: string;

  @Field({ nullable: true })
  profilePicture?: string;

  @Field()
  isEmailVerified: boolean;

  @Field({ nullable: true })
  lastLoginAt?: Date;

  @Field(() => [CourseType], { nullable: 'itemsAndList' })
  courses?: CourseType[];

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
