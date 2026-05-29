import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum AppTheme {
  LIGHT = 'light',
  DARK = 'dark',
  SYSTEM = 'system',
}

export enum AppLanguage {
  EN = 'en',
  FR = 'fr',
  ES = 'es',
  DE = 'de',
  AR = 'ar',
}

@Entity('user_preferences')
export class UserPreference {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index({ unique: true })
  userId: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn()
  user: User;

  @Column({ type: 'enum', enum: AppTheme, default: AppTheme.SYSTEM })
  theme: AppTheme;

  @Column({ type: 'enum', enum: AppLanguage, default: AppLanguage.EN })
  language: AppLanguage;

  @Column({ default: true })
  emailNotifications: boolean;

  @Column({ default: true })
  pushNotifications: boolean;

  @Column({ default: true })
  inAppNotifications: boolean;

  @Column({ default: false })
  marketingEmails: boolean;

  @Column({ default: true })
  courseUpdates: boolean;

  @Column({ default: true })
  weeklyDigest: boolean;

  @Column({ type: 'jsonb', nullable: true })
  customSettings: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}