import { ApiProperty } from '@nestjs/swagger';

export type ModerationFlag = 'profanity' | 'spam' | 'openai_violation';

export class ModerationResultDto {
  @ApiProperty({ description: 'Whether the content is allowed' })
  allowed: boolean;

  @ApiProperty({ description: 'Whether the content was auto-rejected' })
  autoRejected: boolean;

  @ApiProperty({ description: 'Flags triggered', type: [String] })
  flags: ModerationFlag[];

  @ApiProperty({ description: 'Human-readable reason if rejected', required: false })
  reason?: string;
}
