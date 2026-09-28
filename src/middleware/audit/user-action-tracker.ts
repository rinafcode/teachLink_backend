import { AuditAction, AuditCategory } from '../../audit-log/enums/audit-action.enum';

export interface IUserActionDescriptor {
  action: AuditAction;
  category: AuditCategory;
  description: string;
  metadata?: Record<string, unknown>;
}

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function isAdminSurface(path: string): boolean {
  return /(^|\/)(admin|roles|permissions|tenants|moderation|rbac)(\/|$)/.test(path);
}

export function resolveUserAction(method: string, path: string): IUserActionDescriptor {
  const normalizedMethod = method.toUpperCase();
  const normalizedPath = path.toLowerCase();
  const adminSurface = isAdminSurface(normalizedPath);

  if (normalizedPath.includes('/auth/login')) {
    return {
      action: AuditAction.LOGIN,
      category: AuditCategory.AUTHENTICATION,
      description: `User authentication attempt via ${normalizedMethod} ${path}`,
    };
  }

  if (normalizedPath.includes('/auth/logout')) {
    return {
      action: AuditAction.LOGOUT,
      category: AuditCategory.AUTHENTICATION,
      description: `User logout via ${normalizedMethod} ${path}`,
    };
  }

  if (normalizedPath.includes('/auth/register')) {
    return {
      action: AuditAction.REGISTER,
      category: AuditCategory.AUTHENTICATION,
      description: `User registration via ${normalizedMethod} ${path}`,
    };
  }

  if (normalizedMethod === 'GET') {
    return {
      action: AuditAction.DATA_VIEWED,
      category: AuditCategory.DATA_ACCESS,
      description: `${adminSurface ? 'Admin ' : ''}data access via ${normalizedMethod} ${path}`,
      metadata: {
        isAdminAction: adminSurface,
        accessType: 'read',
      },
    };
  }

  if (normalizedMethod === 'POST') {
    return {
      action: AuditAction.DATA_CREATED,
      category: WRITE_METHODS.has(normalizedMethod)
        ? AuditCategory.DATA_MODIFICATION
        : AuditCategory.DATA_ACCESS,
      description: `${adminSurface ? 'Admin ' : ''}resource creation via ${normalizedMethod} ${path}`,
      metadata: {
        isAdminAction: adminSurface,
        accessType: 'write',
      },
    };
  }

  if (normalizedMethod === 'PUT' || normalizedMethod === 'PATCH') {
    return {
      action: AuditAction.DATA_UPDATED,
      category: AuditCategory.DATA_MODIFICATION,
      description: `${adminSurface ? 'Admin ' : ''}resource update via ${normalizedMethod} ${path}`,
      metadata: {
        isAdminAction: adminSurface,
        accessType: 'write',
      },
    };
  }

  if (normalizedMethod === 'DELETE') {
    return {
      action: AuditAction.DATA_DELETED,
      category: AuditCategory.DATA_MODIFICATION,
      description: `${adminSurface ? 'Admin ' : ''}resource deletion via ${normalizedMethod} ${path}`,
      metadata: {
        isAdminAction: adminSurface,
        accessType: 'write',
      },
    };
  }

  return {
    action: AuditAction.API_CALLED,
    category: AuditCategory.DATA_ACCESS,
    description: `API call via ${normalizedMethod} ${path}`,
    metadata: {
      isAdminAction: adminSurface,
      accessType: 'general',
    },
  };
}
