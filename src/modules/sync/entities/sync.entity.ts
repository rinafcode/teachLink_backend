@Entity('sync_actions')
export class SyncAction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column()
  actionType: string;

  @Column('jsonb')
  payload: Record<string, any>;

  @Column({
    default: false,
  })
  processed: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @Column({
    nullable: true,
  })
  processedAt?: Date;
}