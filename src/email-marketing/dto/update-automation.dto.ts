import { PartialType } from '@nestjs/swagger';
import { CreateAutomationDto } from './create-automation.dto';

export class UpdateAutomationDto extends PartialType(CreateAutomationDto) {}
