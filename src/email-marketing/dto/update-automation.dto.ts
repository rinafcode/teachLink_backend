import { PartialType } from '@nestjs/swagger';
import { CreateAutomationDto } from './create-automation.dto';

/**
 * Defines the update Automation payload.
 */
export class UpdateAutomationDto extends PartialType(CreateAutomationDto) {}
