import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Built-in roles that ship with the platform.
 * These are protected from deletion and are used by authorization checks.
 */
export const BUILTIN_ROLE_NAMES = ['student', 'teacher', 'instructor', 'moderator', 'admin'] as const;

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

  @Column('text', { array: true, default: [] })
  permissions: string[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt?: Date;
}
