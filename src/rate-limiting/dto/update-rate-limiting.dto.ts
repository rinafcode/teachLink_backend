import { PartialType } from '@nestjs/swagger';
import { CreateRateLimitingDto } from './create-rate-limiting.dto';

/**
 * Defines the update Rate Limiting payload.
 */
export class UpdateRateLimitingDto extends PartialType(CreateRateLimitingDto) {}
