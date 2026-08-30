import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  VersionColumn,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Represents the email Template entity.
 */
@Entity('email_templates')
export class EmailTemplate {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @VersionColumn()
  version: number;

  @ApiProperty()
  @Index('IDX_email_templates_name')
  @Column()
  name: string;

  @ApiProperty()
  @Column()
  subject: string;

  @ApiProperty()
  @Column({ type: 'text' })
  htmlContent: string;

  @ApiProperty({ required: false })
  @Column({ type: 'text', nullable: true })
  textContent?: string;

  @ApiProperty({ required: false })
  @Index('IDX_email_templates_category')
  @Column({ nullable: true })
  category?: string;

  @ApiProperty({ type: [String] })
  @Column('simple-array', { nullable: true })
  variables?: string[];

  @ApiProperty({ required: false })
  @Column({ nullable: true })
  thumbnailUrl?: string;

  @ApiProperty()
  @Index('IDX_email_templates_is_active')
  @Column({ default: true })
  isActive: boolean;

  @ApiProperty()
  @Index('IDX_email_templates_created_at')
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty()
  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt?: Date;
}
