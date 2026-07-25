import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for resolving an existing incident.
 */
export class ResolveIncidentDto {
  @ApiProperty({
    description: 'Free-text notes describing the resolution steps taken for the incident.',
    example: 'Restarted the service and verified health checks passed.',
  })
  @IsString({ message: 'Resolution notes must be a string' })
  @IsNotEmpty({ message: 'Resolution notes are required' })
  resolutionNotes: string;
}

/**
 * DTO for escalating an existing incident to another team or owner.
 */
export class EscalateIncidentDto {
  @ApiProperty({
    description: 'Team, role or person to escalate the incident to.',
    example: 'Platform SRE',
  })
  @IsString({ message: 'EscalatedTo must be a string' })
  @IsNotEmpty({ message: 'EscalatedTo is required' })
  escalatedTo: string;

  @ApiProperty({
    description: 'Reason why this incident requires escalation.',
    example: 'Requires infrastructure owner support to recover.',
  })
  @IsString({ message: 'Reason must be a string' })
  @IsNotEmpty({ message: 'Reason is required' })
  reason: string;
}
