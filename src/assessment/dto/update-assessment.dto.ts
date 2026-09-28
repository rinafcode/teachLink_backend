import { PartialType } from '@nestjs/swagger';
import { CreateAssessmentDto } from './create-assessment.dto';

/**
 * Defines the update Assessment payload.
 */
export class UpdateAssessmentDto extends PartialType(CreateAssessmentDto) {}
