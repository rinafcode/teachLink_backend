import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
  OneToMany,
  VersionColumn,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { Course } from '../../courses/entities/course.entity';
import { Enrollment } from '../../courses/entities/enrollment.entity';
import { Role } from '../../rbac/entities/role.entity';

export enum UserRole {
  STUDENT = 'student',
  TEACHER = 'teacher',
  INSTRUCTOR = 'instructor',
  MODERATOR = 'moderator',
  ADMIN = 'admin',
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
}

/**
 * Represents the user entity.
 */
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @VersionColumn()
  version: number;

  @Column({ unique: true })
  @Index()
  email: string;

  @Column({ nullable: true })
  @Index()
  username?: string;

  @Column()
  password: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({
    type: 'enum',
    enum: UserStatus,
    default: UserStatus.ACTIVE,
  })
  status: UserStatus;

  @Column({ nullable: true })
  @Index()
  tenantId?: string;

  @Column({ nullable: true })
  profilePicture?: string;

  @Column({ default: false })
  isEmailVerified: boolean;

  @Column({ nullable: true })
  emailVerificationToken?: string;

  @Column({ type: 'timestamp', nullable: true })
  emailVerificationExpires?: Date;

  @Column({ nullable: true })
  passwordResetToken?: string;

  @Column({ type: 'timestamp', nullable: true })
  passwordResetExpires?: Date;

  @Column({ nullable: true })
  refreshToken?: string;

  @Column('text', { array: true, default: [] })
  passwordHistory: string[];

  @Column({ type: 'timestamp', nullable: true })
  lastLoginAt?: Date;

  @ManyToMany(() => Role, (role) => role.users)
  @JoinTable()
  roles: Role[];

  get role(): UserRole {
    if (this.roles && this.roles.length > 0) {
      return this.roles[0].name as UserRole;
    }
    return UserRole.STUDENT;
  }

  @OneToMany(() => Course, (course) => course.instructor)
  courses: Course[];

  @OneToMany(() => Enrollment, (enrollment) => enrollment.user)
  enrollments: Enrollment[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt?: Date;
}
