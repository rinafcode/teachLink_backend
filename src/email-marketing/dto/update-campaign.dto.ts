import { PartialType } from '@nestjs/swagger';
import { CreateCampaignDto } from './create-campaign.dto';

/**
 * Defines the update Campaign payload.
 */
export class UpdateCampaignDto extends PartialType(CreateCampaignDto) {}
