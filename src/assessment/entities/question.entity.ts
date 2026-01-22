import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { QuestionType } from "../enums/question-type.enum";
import { Assessment } from "./assessment.entity";

@Entity()
export class Question {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: QuestionType })
  type: QuestionType;

  @Column()
  prompt: string;

  @Column({ type: 'json', nullable: true })
  options?: string[]; // MCQ

  @Column({ type: 'json', nullable: true })
  correctAnswer?: any;

  @Column({ default: 1 })
  points: number;

  @ManyToOne(() => Assessment, (a) => a.questions, {
    onDelete: 'CASCADE',
  })
  assessment: Assessment;
}
