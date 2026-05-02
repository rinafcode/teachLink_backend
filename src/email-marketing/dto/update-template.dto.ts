import { PartialType } from '@nestjs/swagger';
import { CreateTemplateDto } from './create-template.dto';

/**
 * Defines the update Template payload.
 */
export class UpdateTemplateDto extends PartialType(CreateTemplateDto) {}
