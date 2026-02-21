import { PartialType } from '@nestjs/swagger';
import { CreateRateLimitingDto } from './create-rate-limiting.dto';

export class UpdateRateLimitingDto extends PartialType(CreateRateLimitingDto) {}
