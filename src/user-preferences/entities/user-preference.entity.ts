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

// NEW — locale for formatting (CRITICAL FOR TASK)
export enum AppLocale {
  EN_US = 'en-US',
  EN_GB = 'en-GB',
  FR_FR = 'fr-FR',
  ES_ES = 'es-ES',
  DE_DE = 'de-DE',
  AR_SA = 'ar-SA',
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

  // =========================
  // UI Preferences
  // =========================
  @Column({ type: 'enum', enum: AppTheme, default: AppTheme.SYSTEM })
  theme: AppTheme;

  @Column({ type: 'enum', enum: AppLanguage, default: AppLanguage.EN })
  language: AppLanguage;

  // NEW — REQUIRED FOR LOCALE FORMATTING
  @Column({
    type: 'enum',
    enum: AppLocale,
    default: AppLocale.EN_US,
  })
  locale: AppLocale;

  // =========================
  // TIMEZONE SUPPORT (REQUIRED)
  // =========================
  @Column({ default: 'UTC' })
  timezone: string; // e.g. Africa/Lagos, Europe/London

  // =========================
  // Notification Settings
  // =========================
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

  // =========================
  // Advanced Custom Settings
  // =========================
  @Column({ type: 'jsonb', nullable: true })
  customSettings: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}