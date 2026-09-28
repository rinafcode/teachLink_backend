import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
  Unique,
  VersionColumn,
} from 'typeorm';

/**
 * Represents the translation entity.
 */
@Entity('translations')
@Unique(['namespace', 'translationKey', 'locale'])
@Index('IDX_translations_namespace_locale', ['namespace', 'locale'])
export class Translation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @VersionColumn()
  version: number;

  @Column()
  namespace: string;

  @Column({ name: 'key' })
  translationKey: string;

  @Column()
  locale: string;

  @Column({ type: 'text' })
  value: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt?: Date;
}
