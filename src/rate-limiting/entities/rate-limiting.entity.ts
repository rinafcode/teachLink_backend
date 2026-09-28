import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm';

/**
 * Represents the rate Limiting entity.
 *
 * Indexes added (issue #1249):
 *  - userId    — primary lookup key for per-user rate-limit checks
 *  - endpoint  — used in WHERE filters to find limits by route
 *  - (userId, endpoint) composite — covers the most common compound lookup
 *  - windowStart — used in range/cleanup queries
 */
@Entity('rate_limiting')
@Index('IDX_rate_limiting_userId', ['userId'])
@Index('IDX_rate_limiting_endpoint', ['endpoint'])
@Index('IDX_rate_limiting_userId_endpoint', ['userId', 'endpoint'])
@Index('IDX_rate_limiting_windowStart', ['windowStart'])
export class RateLimiting {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  userId: string;

  @Column({ nullable: true })
  endpoint: string;

  @Column({ nullable: true })
  windowStart: Date;

  @Column({ default: 0 })
  requestCount: number;
}
