import {
  Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn
} from "typeorm";
import { Question } from "./question.entity";

@Entity()
export class Assessment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ nullable: true })
  description?: string;

  @Column()
  durationMinutes: number;

  @OneToMany(() => Question, (q) => q.assessment, {
    cascade: true,
  })
  questions: Question[];

  @CreateDateColumn()
  createdAt: Date;
}
