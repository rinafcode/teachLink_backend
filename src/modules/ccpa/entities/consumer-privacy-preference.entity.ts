@Entity('consumer_privacy_preferences')
export class ConsumerPrivacyPreference {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column({ default: false })
  sellPersonalData: boolean;

  @Column({ default: false })
  sharePersonalData: boolean;

  @Column({ default: false })
  marketingTracking: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
