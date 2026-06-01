import { PartialType } from '@nestjs/swagger';
import { CreateExperimentDto } from './create-experiment.dto';

/**
 * Request DTO for partially updating experiment settings.
 */
export class UpdateExperimentDto extends PartialType(CreateExperimentDto) {}
