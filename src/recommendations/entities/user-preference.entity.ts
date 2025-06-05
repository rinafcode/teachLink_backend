import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('user_preferences')
export class UserPreference {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column('jsonb')
  interests: string[];

  @Column('jsonb')
  skillLevels: Record<string, number>;

  @Column('jsonb')
  learningGoals: string[];

  @Column('float')
  engagementScore: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
