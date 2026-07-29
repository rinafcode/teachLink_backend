import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinTable,
  ManyToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Permission } from './permission.entity';
import { User } from '../../users/entities/user.entity';

/**
 * Built-in roles that ship with the platform.
 * These are protected from deletion and are used by authorization checks.
 */
export const BUILTIN_ROLE_NAMES = [
  'student',
  'teacher',
  'instructor',
  'moderator',
  'admin',
] as const;

export type BuiltinRoleName = (typeof BUILTIN_ROLE_NAMES)[number];

/**
 * Represents a role in the RBAC catalogue.
 */
@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  @Index()
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ default: false })
  isSystem: boolean;

  @ManyToMany(() => Permission, (permission) => permission.roles, { eager: true })
  @JoinTable()
  permissions: Permission[];

  @ManyToMany(() => User, (user) => user.roles)
  users: User[];

  @CreateDateColumn()
  @Index()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt?: Date;
}
