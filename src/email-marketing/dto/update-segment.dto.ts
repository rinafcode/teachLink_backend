import { PartialType } from '@nestjs/swagger';
import { CreateSegmentDto } from './create-segment.dto';

/**
 * Defines the update Segment payload.
 */
export class UpdateSegmentDto extends PartialType(CreateSegmentDto) {}
