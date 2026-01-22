import {
  Column, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn
} from "typeorm";
import { AssessmentAttempt } from "./assessment-attempt.entity";
import { Question } from "./question.entity";@Entity()
export class Answer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => AssessmentAttempt, (a) => a.answers)
  attempt: AssessmentAttempt;

  @ManyToOne(() => Question)
  question: Question;

  @Column({ type: 'json' })
  response: string| any;

  @Column({ nullable: true })
  awardedPoints?: number;
}
