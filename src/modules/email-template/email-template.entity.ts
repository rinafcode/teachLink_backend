import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('email_templates')
export class EmailTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    unique: true,
  })
  key: string;

  @Index('IDX_email_templates_name')
  @Column()
  name: string;

  @Column()
  subject: string;

  @Column({
    type: 'text',
  })
  body: string;

  @Column({
    type: 'json',
    default: [],
  })
  variables: string[];

  @Index('IDX_email_templates_created_at')
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
