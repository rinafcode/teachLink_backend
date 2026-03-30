import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';

@Entity('translations')
@Unique(['namespace', 'translationKey', 'locale'])
@Index('IDX_translations_namespace_locale', ['namespace', 'locale'])
export class Translation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

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
}
