import { PartialType } from '@nestjs/swagger';
import { CreateSegmentDto } from './create-segment.dto';

export class UpdateSegmentDto extends PartialType(CreateSegmentDto) {}
