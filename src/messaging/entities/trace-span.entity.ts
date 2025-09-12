import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum SpanKind {
  SERVER = 'server',
  CLIENT = 'client',
  PRODUCER = 'producer',
  CONSUMER = 'consumer',
  INTERNAL = 'internal',
}

@Entity('trace_spans')
@Index(['traceId'])
@Index(['parentSpanId'])
@Index(['serviceName', 'operationName'])
export class TraceSpan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  traceId: string;

  @Column()
  spanId: string;

  @Column({ nullable: true })
  parentSpanId: string;

  @Column()
  serviceName: string;

  @Column()
  operationName: string;

  @Column({
    type: 'enum',
    enum: SpanKind,
  })
  kind: SpanKind;

  @Column('timestamp')
  startTime: Date;

  @Column('timestamp', { nullable: true })
  endTime: Date;

  @Column('int', { nullable: true })
  duration: number;

  @Column('jsonb', { nullable: true })
  tags: Record<string, any>;

  @Column('jsonb', { nullable: true })
  logs: Array<{
    timestamp: Date;
    level: string;
    message: string;
    fields: Record<string, any>;
  }>;

  @Column('jsonb', { nullable: true })
  baggage: Record<string, string>;

  @Column({ nullable: true })
  status: string;

  @Column('text', { nullable: true })
  errorMessage: string;

  @CreateDateColumn()
  createdAt: Date;
}
