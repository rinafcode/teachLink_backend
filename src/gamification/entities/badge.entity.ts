import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  VersionColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { BadgeCategory } from '../enums/badge-category.enum';
import { BadgeCriteriaType } from '../enums/badge-criteria-type.enum';

@Entity('badges')
export class Badge {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @VersionColumn()
  version: number;

  @Column({ unique: true })
  name: string;

  @Column()
  description: string;

  @Column({ nullable: true })
  iconUrl: string;

  @Column({ type: 'enum', enum: BadgeCategory })
  @Index()
  category: BadgeCategory;

  @Column({ type: 'enum', enum: BadgeCriteriaType })
  criteriaType: BadgeCriteriaType;

  @Column('jsonb', { nullable: true })
  criteriaValue: Record<string, any>; // e.g. { threshold: 5 }

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: 0 })
  points: number; // bonus points awarded when badge is earned

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
