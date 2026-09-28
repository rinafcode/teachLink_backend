import { AuditAction, AuditCategory } from '../../audit-log/enums/audit-action.enum';
import { resolveUserAction } from './user-action-tracker';

describe('resolveUserAction', () => {
  it('tags GET requests on admin surfaces as admin data access', () => {
    const result = resolveUserAction('GET', '/tenants/abc/statistics');

    expect(result.action).toBe(AuditAction.DATA_VIEWED);
    expect(result.category).toBe(AuditCategory.DATA_ACCESS);
    expect(result.description).toContain('Admin data access');
    expect(result.metadata).toMatchObject({
      isAdminAction: true,
      accessType: 'read',
    });
  });

  it('tags write requests on admin surfaces as admin actions', () => {
    const result = resolveUserAction('POST', '/roles/abc/permissions/xyz');

    expect(result.action).toBe(AuditAction.DATA_CREATED);
    expect(result.category).toBe(AuditCategory.DATA_MODIFICATION);
    expect(result.metadata).toMatchObject({
      isAdminAction: true,
      accessType: 'write',
    });
  });
});
