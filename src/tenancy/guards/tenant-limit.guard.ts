import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { TenancyService } from '../tenancy.service';

export const LIMIT_TYPE_KEY = 'limit_type';

export function LimitType(type: 'user' | 'storage') {
  return function (_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor) {
    Reflect.defineMetadata(LIMIT_TYPE_KEY, type, descriptor.value);
  };
}

@Injectable()
export class TenantLimitGuard implements CanActivate {
  constructor(private readonly tenancyService: TenancyService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const limitType = Reflect.getMetadata(LIMIT_TYPE_KEY, context.getHandler()) as
      | string
      | undefined;

    if (!limitType) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const tenantId = await this.tenancyService.resolveTenantIdFromRequest(request);
    request.tenantId = tenantId;
    const tenant = await this.tenancyService.findOne(tenantId);

    if (limitType === 'user') {
      if (tenant.userLimit === -1) {
        return true;
      }

      if (tenant.currentUserCount >= tenant.userLimit) {
        throw new HttpException(
          {
            message: 'User limit exceeded',
            error: 'Payment Required',
            statusCode: HttpStatus.PAYMENT_REQUIRED,
          },
          HttpStatus.PAYMENT_REQUIRED,
        );
      }
    }

    if (limitType === 'storage') {
      if (tenant.storageLimit === -1) {
        return true;
      }

      const file = request.file as Express.Multer.File | undefined;
      if (!file) {
        return true;
      }

      const uploadMB = Math.ceil(file.size / (1024 * 1024));

      if (tenant.currentStorageUsage + uploadMB > tenant.storageLimit) {
        throw new HttpException(
          {
            message: 'Storage limit exceeded',
            error: 'Payment Required',
            statusCode: HttpStatus.PAYMENT_REQUIRED,
          },
          HttpStatus.PAYMENT_REQUIRED,
        );
      }
    }

    return true;
  }
}
