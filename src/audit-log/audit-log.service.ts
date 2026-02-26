import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AuditLog } from "./audit-log.entity";

@Injectable()
export class AuditLogService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
  ) {}

  async record(userId: string, action: string, entity: string) {
    const log = this.auditRepo.create({ userId, action, entity });
    return this.auditRepo.save(log);
  }

  async findAll(): Promise<AuditLog[]> {
    return this.auditRepo.find({ order: { timestamp: "DESC" } });
  }

  async findByUser(userId: string): Promise<AuditLog[]> {
    return this.auditRepo.find({ where: { userId }, order: { timestamp: "DESC" } });
  }

  async findByAction(action: string): Promise<AuditLog[]> {
    return this.auditRepo.find({ where: { action }, order: { timestamp: "DESC" } });
  }
}
