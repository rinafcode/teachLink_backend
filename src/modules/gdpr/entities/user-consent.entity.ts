import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Index } from 'typeorm';

@Entity('user_consents')
export class UserConsent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  userId: string;

  @Index()
  @Column()
  consentType: string;

  @Column()
  granted: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @Column({
    nullable: true,
  })
  revokedAt?: Date;
}
