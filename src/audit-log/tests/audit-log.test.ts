import { AuditLogService } from "../audit-log.service";
import { Repository } from "typeorm";
import { AuditLog } from "../audit-log.entity";

describe("AuditLogService", () => {
  let service: AuditLogService;
  let repo: Repository<AuditLog>;

  beforeEach(() => {
    repo = new Repository<AuditLog>();
    service = new AuditLogService(repo as any);
  });

  it("records an audit log", async () => {
    const log = await service.record("user1", "TIP_SENT", "receiver:user2");
    expect(log.userId).toBe("user1");
    expect(log.action).toBe("TIP_SENT");
  });
});
