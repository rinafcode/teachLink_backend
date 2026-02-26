import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from "typeorm";

@Entity("audit_logs")
export class AuditLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: string;

  @Column()
  action: string; // e.g. "TIP_SENT", "ROLE_CHANGED"

  @Column()
  entity: string; // e.g. "user:123", "proposal:456"

  @CreateDateColumn()
  timestamp: Date;
}
