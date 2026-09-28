import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { CohortMember } from './cohort-member.entity';
import { CohortThread } from './cohort-thread.entity';
import { CohortAssignment } from './cohort-assignment.entity';

@Entity('cohorts')
export class Cohort {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  name: string;

  @Column({ nullable: true, type: 'text' })
  description?: string;

  @Column()
  ownerId: string;

  @OneToMany(() => CohortMember, (member) => member.cohort)
  members: CohortMember[];

  @OneToMany(() => CohortThread, (thread) => thread.cohort)
  threads: CohortThread[];

  @OneToMany(() => CohortAssignment, (assignment) => assignment.cohort)
  assignments: CohortAssignment[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt?: Date;
}
