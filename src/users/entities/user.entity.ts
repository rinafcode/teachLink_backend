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
} from 'typeorm';
import { Course } from '../../courses/entities/course.entity';
import { Enrollment } from '../../courses/entities/enrollment.entity';
export enum UserRole {
    STUDENT = 'student',
    TEACHER = 'teacher',
    ADMIN = 'admin'
}
export enum UserStatus {
    ACTIVE = 'active',
    INACTIVE = 'inactive',
    SUSPENDED = 'suspended'
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
    enum: UserRole,
    default: UserRole.STUDENT,
  })
  role: UserRole;

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

  // Location and Currency Fields
  @Column({ nullable: true })
  @Index()
  country?: string; // Country name or full name

  @Column({ nullable: true, length: 2 })
  @Index()
  countryCode?: string; // ISO 3166-1 alpha-2 country code

  @Column({ nullable: true })
  timezone?: string; // IANA timezone identifier

  @Column({ nullable: true })
  city?: string;

  @Column({ nullable: true, length: 3, default: 'USD' })
  @Index()
  preferredCurrency?: string; // ISO 4217 currency code

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
