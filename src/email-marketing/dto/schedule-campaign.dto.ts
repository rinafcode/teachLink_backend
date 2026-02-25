import { IsDateString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ScheduleCampaignDto {
    @ApiProperty({ description: 'Scheduled send time (ISO 8601)', example: '2026-02-01T10:00:00Z' })
    @IsDateString()
    @IsNotEmpty()
    scheduledAt: string;
}
