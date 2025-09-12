import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum CertificateStatus {
  PENDING = 'pending',
  ISSUED = 'issued',
  REVOKED = 'revoked',
  EXPIRED = 'expired',
}

export enum CertificateType {
  SKILL = 'skill',
  COURSE_COMPLETION = 'course_completion',
  PROFESSIONAL = 'professional',
  ACADEMIC = 'academic',
  CUSTOM = 'custom',
}

@Entity('certificates')
@Index(['recipientId', 'status'])
@Index(['blockchainTxHash'], {
  unique: true,
  where: 'blockchain_tx_hash IS NOT NULL',
})
export class Certificate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({
    type: 'enum',
    enum: CertificateType,
    default: CertificateType.SKILL,
  })
  type: CertificateType;

  @Column({ type: 'uuid', name: 'recipient_id' })
  recipientId: string;

  @Column({ type: 'varchar', length: 255, name: 'recipient_name' })
  recipientName: string;

  @Column({ type: 'varchar', length: 255, name: 'recipient_email' })
  recipientEmail: string;

  @Column({ type: 'uuid', name: 'issuer_id' })
  issuerId: string;

  @Column({ type: 'varchar', length: 255, name: 'issuer_name' })
  issuerName: string;

  @Column({ type: 'varchar', length: 255, name: 'issuer_organization' })
  issuerOrganization: string;

  @Column({
    type: 'enum',
    enum: CertificateStatus,
    default: CertificateStatus.PENDING,
  })
  status: CertificateStatus;

  @Column({ type: 'jsonb', nullable: true })
  skills: string[];

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ type: 'timestamp', name: 'issued_at', nullable: true })
  issuedAt: Date;

  @Column({ type: 'timestamp', name: 'expires_at', nullable: true })
  expiresAt: Date;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'blockchain_tx_hash',
    nullable: true,
  })
  blockchainTxHash: string;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'blockchain_network',
    nullable: true,
  })
  blockchainNetwork: string;

  @Column({ type: 'text', name: 'digital_signature', nullable: true })
  digitalSignature: string;

  @Column({ type: 'text', name: 'verification_url', nullable: true })
  verificationUrl: string;

  @Column({
    type: 'varchar',
    length: 64,
    name: 'certificate_hash',
    nullable: true,
  })
  certificateHash: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
