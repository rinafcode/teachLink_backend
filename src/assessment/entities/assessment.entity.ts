import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  VersionColumn,
} from 'typeorm';
import { Question } from './question.entity';

@Entity()
export class Assessment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @VersionColumn()
  version: number;

  @Column()
  @Index()
  title: string;

  @Column({ nullable: true })
  description?: string;

  @Column()
  @Index()
  durationMinutes: number;

  @OneToMany(() => Question, (q) => q.assessment, {
    cascade: true,
  })
  questions: Question[];

  @CreateDateColumn()
  createdAt: Date;

  @DeleteDateColumn()
  deletedAt?: Date;
}
