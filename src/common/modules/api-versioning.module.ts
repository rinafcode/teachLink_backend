import { Module } from '@nestjs/common';

export const API_VERSIONING_DOCUMENTATION =
  'Send X-API-Version with versioned requests. The default supported API version is 1.';

@Module({})
export class ApiVersioningModule {}
