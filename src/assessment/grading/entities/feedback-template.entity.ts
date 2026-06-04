import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';

/**
 * A reusable, mustache-style feedback template that grading can apply
 * to a `SubmissionGrade` to produce final feedback text.
 *
 * Supported placeholders rendered by `FeedbackTemplatesService.render`:
 *  - `{{score}}`       — total score awarded
 *  - `{{maxScore}}`    — total possible score
 *  - `{{percentage}}`  — `(score / maxScore) * 100` rounded to 2dp
 *  - `{{rubric}}`      — rubric name
 *  - `{{criterion.<title>}}` — points awarded for the named criterion
 *  - `{{level.<criterionTitle>}}` — selected level label for that criterion
 *  - `{{verdict}}`     — derived bucket: "Excellent" / "Good" / "Needs work"
 *
 * Templates are owned by an instructor and may be marked `isDefault`
 * to be auto-applied when no explicit template is chosen.
 */
@Entity('feedback_templates')
export class FeedbackTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  name: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ name: 'owner_id', type: 'uuid', nullable: true })
  @Index()
  ownerId?: string;

  /** When true, this template is auto-selected when none is supplied. */
  @Column({ default: false })
  isDefault: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt?: Date;
}
