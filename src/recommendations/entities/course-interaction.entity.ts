import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('course_interactions')
export class CourseInteraction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column()
  courseId: string;

  @Column('float')
  rating: number;

  @Column('float')
  completionRate: number;

  @Column('float')
  timeSpent: number;

  @Column('jsonb')
  interactionType: string;

  @Column('jsonb')
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
