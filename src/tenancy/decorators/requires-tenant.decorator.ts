import { SetMetadata } from '@nestjs/common';

export const TENANT_KEY = 'tenant';
export const RequiresTenant = () => SetMetadata(TENANT_KEY, true);
