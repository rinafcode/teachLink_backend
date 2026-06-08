import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('user_consents')
export class UserConsent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

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
